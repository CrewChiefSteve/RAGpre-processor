# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
npm install

# Build the TypeScript project
npm run build

# Run the CLI (after building)
npm start

# Run in development mode (with ts-node)
npm run dev
```

## Architecture

This is a document preprocessing tool that uses Azure Document Intelligence to analyze PDFs and images, then exports structured content in different formats.

**Processing Pipeline:**
1. **Phase A: Input Normalization** (`src/normalizeInput.ts`) - Universal loader that accepts both PDFs and images:
   - PDFs → passed through unchanged (marked as `pdf_digital`)
   - Images (JPG, PNG, HEIC, etc.) → normalized using sharp (auto-rotate, grayscale, contrast boost) and marked as `image_normalized`
2. `analyzePdf.ts` - Calls Azure Document Intelligence API to analyze the normalized document
3. **Phase B: Quality Assessment & Routing** (`src/routeContent.ts`) - Routes Azure output with quality signals:
   - **Phase B+: Hybrid Diagram Detection** (`src/diagramDetection.ts`) - Multi-source diagram detection:
     - Azure figures (primary source)
     - Azure page-level images (if available)
     - Vision-based page segmentation (fallback for pages without Azure diagrams)
     - Controlled via `ENABLE_VISION_DIAGRAM_SEGMENTATION` environment variable
     - Respects `VISION_DIAGRAM_PAGE_LIMIT` for cost control
     - Each diagram tagged with `source` field: "azure_figure" | "azure_image" | "vision_segment"
   - Assesses content quality using Azure confidence scores and handwriting detection
   - Assigns `ContentQuality`: "ok" | "low_confidence" | "handwriting"
   - Routes content into three categories: narrative text, tables, and diagrams
   - Propagates both `DocumentOrigin` and `ContentQuality` metadata through all content items
4. **Phase C: Robust Table Handling** (`src/exportTables.ts`) - Merges multi-page tables:
   - Detects tables that span multiple pages using header signature matching
   - Merges page fragments into single logical tables (no duplicate headers)
   - Exports single CSV per logical table with complete data
   - Generates RAG summaries and Markdown previews (first 20 rows)
   - Routes outputs to `auto_ok/` or `needs_review/` based on combined quality
   - Populates enhanced metadata: `headerRow`, `headerSignature`, `rowCount`, `columnCount`
5. **Phase D: Vision-based Enhancement** (optional) - Uses OpenAI vision models:
   - `visionClient.ts` - OpenAI integration for vision tasks
   - `handwritingPipeline.ts` - Transcribes handwritten notes from images
   - Replaces low-quality Azure OCR with clean vision transcriptions
   - Generates technical captions for diagrams (dimensions, limits, constraints)
   - Optional features controlled via CLI flags (`--handwritingVision`, `--captionDiagrams`)
   - Gracefully degrades if API key not configured
   - Tracks source images via `sourceImagePath` field
6. Export modules process and route each category:
   - `exportNarrative.ts` - Generates markdown chunks, routes to `auto_ok/` or `needs_review/` based on quality
   - `exportTables.ts` - Implements Phase C table merging, exports CSVs, summaries, and previews
   - `exportDiagrams.ts` - Exports diagram stubs with optional vision captions, routes to `auto_ok/` or `needs_review/`

**Configuration:**
- Environment variables in `.env` store credentials:
  - Azure Document Intelligence: `AZURE_DOC_ENDPOINT`, `AZURE_DOC_KEY`
  - OpenAI (Phase D, optional): `OPENAI_API_KEY`, `VISION_MODEL`
  - Vision features: `ENABLE_HANDWRITING_VISION`, `ENABLE_DIAGRAM_CAPTIONING`
  - Hybrid diagram detection: `ENABLE_VISION_DIAGRAM_SEGMENTATION`, `VISION_DIAGRAM_PAGE_LIMIT`
  - Vision Debug Mode: `ENABLE_VISION_DEBUG` (generates debug artifacts for vision-based diagram detection)
- `config.ts` handles environment loading
- `types.ts` contains shared TypeScript interfaces:
  - `DocumentOrigin` - tracks document source ("pdf_digital" | "image_normalized")
  - `ContentQuality` - tracks content quality ("ok" | "low_confidence" | "handwriting")
  - `DiagramSource` - tracks diagram detection source ("azure_figure" | "azure_image" | "vision_segment")
  - `sourceImagePath` (Phase D) - tracks normalized image file for vision processing
  - `rawCaptionText` (Phase D) - stores figure captions for diagram context

**Utilities:**
- `utils/fsUtils.ts` - File system helpers (mkdirp, writeFile)
- `utils/chunkText.ts` - Text chunking logic for narrative content

**Architecture Diagrams:**
- `docs/architecture/database.md` - ER diagram showing database schema (Prisma + SQLite)
- `docs/architecture/pipeline.md` - Complete pipeline flow chart (CLI + Web modes, all phases)

**Documentation:**
- `docs/phase-a-summary.md` - Complete implementation details for Phase A (input normalization)
- `docs/phase-b-summary.md` - Complete implementation details for Phase B (quality assessment & routing)
- `docs/phase-c-summary.md` - Complete implementation details for Phase C (table merging)
- `docs/phase-d-summary.md` - Complete implementation details for Phase D (vision features)
- `docs/phase-d-usage-examples.md` - Phase D usage scenarios and expected outputs
- `docs/step-5c-hybrid-detection.md` - Step 5C: Hybrid diagram detection implementation (Azure + Vision)
- `docs/step-5c-testing-guide.md` - Step 5C: Testing guide and verification procedures
- `docs/manifest-structure.md` - Complete manifest.json structure reference
- `docs/user-guide.md` - Setup instructions and user guide
- `CLAUDE.md` - This file, architecture overview
