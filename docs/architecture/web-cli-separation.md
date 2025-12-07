# Web/CLI Architecture Separation

## Overview
The PDF preprocessor has two interfaces that share the same core pipeline:

1. **CLI** (`src/index.ts`) - Direct command-line usage
2. **Web** (`app/`) - Next.js web UI that spawns CLI as a child process

## Why This Architecture?

PDF.js (used for rendering PDF pages to images) cannot run inside Next.js server runtime. The Next.js webpack bundler transforms the module in ways that break the worker, despite numerous attempts to configure externals, copy workers, and adjust bundler settings.

After extensive testing and troubleshooting, we adopted a clean separation:
- **Next.js** handles HTTP, UI, job management, and database operations
- **CLI** handles all document processing (Azure, PDF.js, Vision)
- Communication happens via database (job status) and filesystem (outputs)

## Data Flow

```
Browser → Next.js API → Create Job Record (status: pending) → Return Job ID
                              ↓
                        Job Runner polls database
                              ↓
                        Spawn CLI child process
                              ↓
            CLI runs full pipeline (Azure, PDF.js, Vision)
                              ↓
                        Write results to out/jobs/{id}/
                              ↓
                        Update job status in DB (completed/failed)
                              ↓
Browser polls → Next.js API → Read job status + logs from DB → Display
                                    ↓
                        Read manifest.json from filesystem → Display results
```

## Directory Structure

```
app/                    # Next.js (UI + API routes)
  api/
    jobs/               # Job management endpoints
      [id]/
        process/        # Manual job trigger
        outputs/        # Job results
        logs/           # Job logs
lib/                    # Web-only utilities
  jobRunner.ts          # Spawns CLI child process
  jobLogger.ts          # Database logging
  db.ts                 # Prisma client
src/                    # CLI pipeline (NEVER imported by web)
  index.ts              # CLI entry point
  pipeline.ts           # Core processing pipeline
  analyzePdf.ts         # Azure Document Intelligence
  visionClient.ts       # OpenAI Vision API
  extractDiagramImages.ts # PDF.js usage (problematic in Next.js)
out/jobs/{id}/          # Job output (shared filesystem)
  manifest.json         # Results manifest
  diagrams/             # Diagram images
  tables/               # Table CSVs
  narrative/            # Text chunks
temp/uploads/           # Uploaded files (shared filesystem)
prisma/
  schema.prisma         # Database schema
  dev.db                # SQLite database (shared)
```

## Architecture Rules

### 1. Import Boundary
- **Web code (app/, lib/)** NEVER imports from **CLI code (src/)**
- Job runner spawns CLI via `child_process.spawn()`
- No direct function calls across the boundary

### 2. Job Communication
- **Job creation**: Next.js writes to database (status: pending)
- **Job pickup**: Job runner polls database, finds pending jobs
- **Job execution**: Job runner spawns CLI with command-line arguments
- **Job monitoring**: CLI stdout/stderr captured and logged to database
- **Job completion**: CLI exits, job status updated to completed/failed

### 3. Results Sharing
- **Job status**: Stored in database (Prisma + SQLite)
- **Job logs**: Stored in database (Log table)
- **Job outputs**: Written to filesystem (out/jobs/{id}/)
- **Manifest**: Written to filesystem (out/jobs/{id}/manifest.json)

### 4. Configuration
- **Job config**: Stored in database Job model (handwritingVision, captionDiagrams, etc.)
- **Environment**: Shared .env file (Azure credentials, OpenAI API key)
- **CLI arguments**: Built from Job config by job runner

## Job Runner Implementation

The job runner (`lib/jobRunner.ts`) is responsible for:

1. **Polling**: Check database every 5 seconds for pending jobs
2. **Spawning**: Launch CLI child process with appropriate arguments
3. **Logging**: Capture CLI stdout/stderr and write to database
4. **Monitoring**: Track process lifecycle (running → completed/failed)
5. **Cleanup**: Kill processes on shutdown, handle errors gracefully

Example CLI spawn:
```typescript
const args = ['run', 'cli', pdfPath, '--outDir', outDir];
if (job.captionDiagrams) args.push('--captionDiagrams');
if (job.handwritingVision) args.push('--handwritingVision');
args.push('--visionSegmentation');  // Always enabled for web jobs

const child = spawn('pnpm', args, {
  cwd: process.cwd(),
  env: { ...process.env },
  shell: true,
});
```

## Benefits of This Architecture

### 1. Clean Separation of Concerns
- Next.js focuses on web UI, HTTP, and data persistence
- CLI focuses on document processing and pipeline orchestration
- No bundler conflicts or webpack configuration headaches

### 2. Independent Development
- CLI can be developed and tested independently
- Web UI can be developed without worrying about PDF.js workers
- Each component has clear responsibilities

### 3. Better Error Handling
- CLI crashes don't crash the web server
- Process isolation prevents memory leaks
- Easy to retry failed jobs by respawning CLI

### 4. Flexibility
- CLI can be run standalone for batch processing
- Web UI can spawn multiple CLI processes (future: parallel jobs)
- Easy to deploy CLI and web separately if needed

### 5. Maintainability
- Clear boundaries make code easier to understand
- No need for complex bundler workarounds
- Standard Node.js patterns (child processes, filesystem, database)

## Known Limitations

### 1. Manifest Reading
Currently, the web UI reads job outputs from the database (`outputsJson` field), but the CLI writes outputs to `manifest.json` in the filesystem. This creates a potential gap:
- **Old approach**: Pipeline ran in-process, updated `outputsJson` in database
- **New approach**: CLI writes `manifest.json` to filesystem
- **TODO**: Web UI should read manifest.json from filesystem instead of database

### 2. Real-time Progress
The job runner parses CLI stdout for phase markers to update progress, but this is basic text parsing. Future improvements could include:
- Structured JSON logging from CLI
- Progress percentage tracking
- Real-time phase updates in database

### 3. Process Management
Currently, the job runner only processes one job at a time. Future improvements:
- Concurrent job processing (spawn multiple CLI processes)
- Job queue with priority
- Process pooling and resource limits

## Migration Notes

This architecture was implemented to solve PDF.js bundler issues in Next.js. Previous attempts included:
- Adding PDF.js to `serverComponentsExternalPackages` ❌
- Copying worker files with webpack plugins ❌
- Using `IgnorePlugin` to skip worker resolution ❌
- Configuring `resolve.alias` for worker paths ❌

The CLI spawn approach is the cleanest solution and provides better architectural separation.

## Testing

### CLI Testing
```bash
# Test CLI independently
pnpm run cli ./test.pdf --captionDiagrams --visionSegmentation
```

### Web Testing
```bash
# Start web server
pnpm run dev

# Upload PDF via web UI
# Monitor job runner logs
# Verify CLI spawns correctly
# Check job status updates
# View results in web UI
```

### Integration Testing
1. Create job via web API → Job record created with status: pending
2. Job runner picks up job → Status changes to running
3. CLI spawns and processes → Logs written to database
4. CLI completes → Status changes to completed
5. Web UI polls → Displays completed job with results

## Future Improvements

1. **Read manifest from filesystem**: Update outputs API to read manifest.json directly
2. **Structured logging**: CLI outputs JSON logs for easier parsing
3. **Progress tracking**: CLI reports progress percentage for real-time updates
4. **Concurrent jobs**: Process multiple jobs in parallel with resource limits
5. **Job cancellation**: Kill running CLI processes from web UI
6. **Retry logic**: Automatic retry for transient failures
7. **Job scheduling**: Queue jobs with priority and scheduling options
