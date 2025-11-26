Production Deploy Guide – pdf-preprocessor

This document explains what to do when you’re ready to run the pdf-preprocessor in a production environment instead of “dev mode” with ts-node.

1. Goals of the Production Setup

In production we want:

Compiled JavaScript, not on-the-fly TypeScript via ts-node

Stable, repeatable builds (CI/CD friendly)

Safe environment variables (no secrets in code)

Predictable CLI usage for batch jobs, cron, or other systems

Controllable costs for Azure + OpenAI vision features

Everything below is aimed at that.

2. Package.json: Production Scripts
2.1. Make sure you have a build script

In package.json, confirm you have:

"scripts": {
  "build": "tsc",
  "start": "ts-node src/index.ts",        // dev
  "start:prod": "node dist/index.js"      // production
}


build compiles all .ts files into dist/

start is for local development (ts-node)

start:prod is what you’ll use in production

3. Build the Project

From the project root:

npm install          # or pnpm install, once per environment
npm run build        # produces dist/index.js and other JS files


Check that dist/ contains:

dist/index.js

dist/analyzePdf.js

dist/routeContent.js

dist/exportNarrative.js

dist/exportTables.js

dist/exportDiagrams.js

dist/utils/...

If tsc reports errors, fix those before deploying.

4. Runtime Command in Production

In production you’ll no longer use ts-node.
Instead, run:

npm run build
npm run start:prod -- <input-path> --outDir ./out


Examples:

# Process a single rulebook PDF
npm run start:prod -- desktop/TA2rules.pdf --outDir ./out/ta2

# Process a scanned handwritten setup sheet
npm run start:prod -- scans/setup-sheet-01.jpg --outDir ./out/setup-01


Note: Everything after -- is passed to your CLI (yargs) just like dev.

5. Environment Variables for Production

Production should not use a .env checked into source control.
Instead, set environment variables via:

Your server’s environment (systemd, Docker, hosting provider)

A secrets manager (Azure Key Vault, etc.)

The key values you need:

# Azure Document Intelligence
AZURE_DOC_ENDPOINT="https://<your-resource>.cognitiveservices.azure.com/"
AZURE_DOC_KEY="<your-azure-doc-intelligence-key>"

# OpenAI Vision (Phase D - optional but recommended)
OPENAI_API_KEY="<your-openai-key>"
VISION_MODEL="gpt-4o-mini"   # or gpt-50-mini, etc.

# Vision feature flags
ENABLE_HANDWRITING_VISION=true   # or false if you don't want vision used
ENABLE_DIAGRAM_CAPTIONING=true   # or false if you don't want diagram captioning

Production recommendation

Rulebooks / clean PDFs only?
You can set both ENABLE_HANDWRITING_VISION and ENABLE_DIAGRAM_CAPTIONING to false to reduce cost.

Scanned notes + diagrams?
Set them to true so you get the full benefit of Phase D.

6. Directory Layout & Permissions

In production, make sure:

out/ (or your chosen output directory) is writable by the process.

If you use a temp directory for normalized images, it is also writable and has enough disk space.

Example structure:

/opt/pdf-preprocessor/
  dist/            # compiled JS
  docs/            # docs, not needed at runtime
  out/             # processed output (narrative, tables, diagrams)
  logs/            # optional log files


You can run:

cd /opt/pdf-preprocessor
npm run start:prod -- /data/rulebooks/TA2rules.pdf --outDir /data/processed/ta2

7. Logging & Monitoring

For production, consider:

Running with a process manager (PM2, systemd, Docker) that:

Restarts on failure

Captures stdout/stderr

Redirecting logs to a file or logging service:

npm run start:prod -- /data/rulebooks/TA2rules.pdf --outDir /data/processed/ta2 >> logs/ta2.log 2>&1


If logs get too noisy:

You can reduce console.log calls in the code

Or add a simple LOG_LEVEL env var in the future

8. Cost Control & Safety Switches

Because this tool can call Azure and OpenAI Vision, keep these in mind:

Vision features off by default in production until you’re comfortable:

ENABLE_HANDWRITING_VISION=false

ENABLE_DIAGRAM_CAPTIONING=false

Turn them on only after:

You’ve tested with sample docs

You’ve verified outputs and checked cost impact

You can also use CLI flags as a temporary override instead of env vars:

npm run start:prod -- TA2rules.pdf --captionDiagrams --handwritingVision

9. CI/CD Checklist

When wiring this into CI/CD (GitHub Actions, Azure DevOps, etc.):

Install and build

npm ci
npm run build


Run a small smoke test

Include a tiny sample PDF or image in the repo (test-data/mini.pdf).

Run:

npm run start:prod -- test-data/mini.pdf --outDir ./out/test-mini


Ensure the job passes and out/test-mini is populated.

Package artifacts

Only dist/ + package.json + pnpm-lock.yaml (or package-lock.json) are required to run.

Source .ts files are optional on the server.

10. Operational Playbook (Quick Reference)

When you’re ready for production, this is the short version:

Build once

npm run build


Set environment variables for:

AZURE_DOC_ENDPOINT

AZURE_DOC_KEY

OPENAI_API_KEY

VISION_MODEL

ENABLE_HANDWRITING_VISION

ENABLE_DIAGRAM_CAPTIONING

Run the processor

npm run start:prod -- /path/to/input.pdf --outDir /path/to/output


Inspect output

outDir/auto_ok/... → content safe to ingest directly into RAG.

outDir/needs_review/... → content you should eyeball in Cursor/VS Code.

Hook into your RAG ingestion

Consume manifest.json in outDir to load:

Narrative chunks

Table summaries

Logical tables (CSVs)

Diagram JSON (with captions, if enabled)