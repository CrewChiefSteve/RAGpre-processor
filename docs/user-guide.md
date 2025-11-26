# User Guide: Setup and Testing Instructions

## Prerequisites

Before you can use the pdf-preprocessor tool, you need to complete the following setup steps.

---

## 1. Azure Document Intelligence Setup

### Create Azure Resource

You need an Azure Document Intelligence (formerly Form Recognizer) resource:

1. **Sign in to Azure Portal**: https://portal.azure.com
2. **Create Resource**:
   - Search for "Document Intelligence" or "Form Recognizer"
   - Click "Create"
3. **Configure Resource**:
   - **Subscription**: Choose your subscription
   - **Resource Group**: Create new or use existing
   - **Region**: Choose a region close to you
   - **Name**: Pick a unique name (e.g., `my-doc-intelligence`)
   - **Pricing Tier**:
     - **F0** (Free tier): 500 pages/month, good for testing
     - **S0** (Standard): Pay-as-you-go for production
4. **Review + Create**: Wait for deployment to complete

### Get Your Credentials

After deployment:

1. Go to your Document Intelligence resource
2. Click **"Keys and Endpoint"** in the left menu
3. Copy the following:
   - **Endpoint**: Format like `https://your-resource-name.cognitiveservices.azure.com/`
   - **Key 1** or **Key 2**: A long string of characters

---

## 2. Configure Environment Variables

### Update `.env` File

Open the `.env` file in the project root and replace the placeholder values:

```bash
AZURE_DOC_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com/
AZURE_DOC_KEY=your-actual-key-here
```

**Example:**
```bash
AZURE_DOC_ENDPOINT=https://racing-docs-analyzer.cognitiveservices.azure.com/
AZURE_DOC_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**Important:**
- The endpoint must end with a `/`
- Keep the key secure - do not commit it to version control
- The `.env` file is already in `.gitignore`

---

## 3. OpenAI Setup (Optional - Phase D Vision Features)

Phase D adds optional vision features for handwriting transcription and diagram captioning. These features are **disabled by default** and require an OpenAI API key.

### Create OpenAI Account

1. **Sign up at OpenAI**: https://platform.openai.com/signup
2. **Add payment method**: Vision features require a paid account
3. **Generate API key**:
   - Go to https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Copy the key (starts with `sk-`)
   - **Important:** Save it securely - you won't see it again

### Update `.env` File

Add your OpenAI credentials to `.env`:

```bash
# Phase D: Vision features (optional)
OPENAI_API_KEY=sk-your-actual-key-here
VISION_MODEL=gpt-4o-mini
ENABLE_HANDWRITING_VISION=false
ENABLE_DIAGRAM_CAPTIONING=false
```

**Configuration:**
- `OPENAI_API_KEY` - Your OpenAI API key (required for vision features)
- `VISION_MODEL` - Model to use (default: `gpt-4o-mini` for cost-effectiveness)
  - Alternative: `gpt-4o` for higher accuracy
- `ENABLE_HANDWRITING_VISION` - Global toggle for handwriting transcription
- `ENABLE_DIAGRAM_CAPTIONING` - Global toggle for diagram captioning

**Note:** If you don't need vision features, you can skip this step. The system will work normally with just Azure Document Intelligence.

---

## 4. Install Dependencies (if not already done)

```bash
cd pdf-preprocessor
pnpm install
```

This will install:
- `sharp@^0.33.0` - Image processing
- `@azure/ai-form-recognizer@^5.0.0` - Azure SDK
- `openai@^4.0.0` - OpenAI SDK (Phase D)
- All other dependencies

**Note:** Sharp includes native binaries. The install may show a warning about build scripts - this is normal.

---

## 5. Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

**Expected output:**
```
> pdf-preprocessor@0.1.0 build
> tsc
```

No errors should appear.

---

## 6. Basic Usage

### Process a PDF Document

```bash
npm start path/to/your-document.pdf
```

**Example:**
```bash
npm start ~/Documents/TA2-Rulebook-2024.pdf
```

### Process an Image

```bash
npm start path/to/your-image.jpg
```

**Supported formats:** JPG, JPEG, PNG, HEIC, WEBP, TIFF

### Process Handwritten Notes with Vision (Phase D)

```bash
npm start handwritten-setup.jpg --handwritingVision
```

**What this does:**
- Uses OpenAI vision model to transcribe handwritten content
- Replaces low-quality Azure OCR with clean transcription
- Only applies to image-based inputs with handwriting or low confidence
- Requires `OPENAI_API_KEY` configured

### Caption Diagrams with Vision (Phase D)

```bash
npm start rulebook.pdf --captionDiagrams
```

**What this does:**
- Uses OpenAI vision model to generate technical diagram descriptions
- Describes dimensions, limits, constraints, and labeled parts
- Works with extracted diagram images
- Requires `OPENAI_API_KEY` configured

### Use Both Vision Features

```bash
npm start document.jpg --handwritingVision --captionDiagrams
```

### Specify Custom Output Directory

```bash
npm start input.pdf --outDir my-output
```

### Specify Custom Temp Directory

```bash
npm start photo.jpg --tempDir my-temp
```

---

## 7. Verify Output

After running, you should see:

### Console Output

```
[CLI] Input: /full/path/to/input.pdf
[CLI] Output dir: /full/path/to/out
[normalizeInput] Detected PDF (digital): /full/path/to/input.pdf
[CLI] Normalized input: /full/path/to/input.pdf (origin: pdf_digital)
[analyzePdf] Analyzing: /full/path/to/input.pdf
[analyzePdf] Pages: 50, tables: 5
[exportNarrative] Blocks: 234
[exportNarrative] Wrote 15 markdown chunks.
[CLI] Routed narrative chunks: 15 (auto_ok + needs_review)
[exportTables] Azure tables: 5, logical tables: 2
[exportTables] Logical tables quality: ok=1, needs_review=1
[exportTables] Merged 3 page fragments across 2 logical tables.
[CLI] Routed table summaries: 2 (auto_ok + needs_review)
[exportDiagrams] Wrote 0 diagram stubs.
[CLI] Routed diagram stubs: 0 (auto_ok + needs_review)
[CLI] Quality distribution: 14 ok, 3 low_confidence, 1 handwriting
[CLI] Routed to auto_ok: 14, needs_review: 4
[CLI] Preprocessing complete.
```

### Output Directory Structure

```
out/
├── auto_ok/                    # High-quality content (RAG-ready)
│   ├── narrative/
│   │   ├── Page_1_1.md
│   │   ├── Page_2_1.md
│   │   └── ...
│   ├── tables/
│   │   ├── input_table_1_summary.md    # RAG ingestion
│   │   └── ...
│   ├── tables_previews/                 # Phase C: Human inspection
│   │   ├── input_table_1_preview.md    # First 20 rows, markdown table
│   │   └── ...
│   └── diagrams/
│       └── diagram_1.json
├── needs_review/               # Requires human review
│   ├── narrative/
│   │   ├── Page_5_1.md       # Low confidence or handwriting
│   │   └── ...
│   ├── tables/
│   │   ├── input_table_2_summary.md
│   │   └── ...
│   ├── tables_previews/                 # Phase C: Human inspection
│   │   ├── input_table_2_preview.md
│   │   └── ...
│   └── diagrams/
│       └── diagram_2.json
├── tables/                     # CSV data (Phase C: merged logical tables)
│   ├── input_table_1.csv      # Single CSV per logical table
│   └── input_table_2.csv      # (no duplicate headers)
└── manifest.json               # Complete metadata with Phase C fields
```

### Check manifest.json

Open `out/manifest.json` and verify:

```json
{
  "sourcePdf": "input.pdf",
  "origin": "pdf_digital",
  "narrativeChunks": [
    {
      "id": "Page_1_1",
      "sectionPath": ["Page 1"],
      "text": "...",
      "sourcePdf": "input.pdf",
      "pageRange": [1, 1],
      "origin": "pdf_digital",
      "quality": "ok"
    },
    {
      "id": "Page_5_1",
      "sectionPath": ["Page 5"],
      "text": "...",
      "sourcePdf": "input.pdf",
      "pageRange": [5, 5],
      "origin": "pdf_digital",
      "quality": "low_confidence"
    }
  ],
  "tables": [...],
  "diagrams": [...]
}
```

**Key things to check:**
- ✅ `origin` field at top level
- ✅ `origin` field in each narrativeChunk
- ✅ `origin` field in each table
- ✅ `quality` field in each narrativeChunk (Phase B)
- ✅ `quality` field in each table (Phase B)
- ✅ `headerRow`, `headerSignature`, `rowCount`, `columnCount` in each table (Phase C)
- ✅ Correct origin value: `"pdf_digital"` for PDFs, `"image_normalized"` for images
- ✅ Correct quality value: `"ok"` | `"low_confidence"` | `"handwriting"`
- ✅ Tables represent merged logical tables (Phase C)

---

## 8. Test Image Input

### Prepare Test Image

Take a photo of a document page or use a scanned image.

### Process It

```bash
npm start test-page.jpg
```

### Expected Console Output

```
[normalizeInput] Detected image: /path/to/test-page.jpg
[normalizeInput] Normalized image written to: /path/to/out/normalized_test-page.png
[CLI] Normalized input: /path/to/out/normalized_test-page.png (origin: image_normalized)
```

### Verify Normalized Image

1. Open `out/normalized_test-page.png`
2. Check that it's:
   - Grayscale (no color)
   - Properly rotated (not sideways)
   - Higher contrast than original

### Check Manifest

```json
{
  "sourcePdf": "test-page.jpg",
  "origin": "image_normalized",
  "narrativeChunks": [
    {
      "origin": "image_normalized",
      ...
    }
  ]
}
```

---

## 9. Troubleshooting

### Error: "Azure config missing"

**Problem:** `.env` file not configured

**Solution:**
1. Check `.env` file exists in project root
2. Verify `AZURE_DOC_ENDPOINT` is set
3. Verify `AZURE_DOC_KEY` is set
4. Ensure no extra quotes around values

### Error: "Input file not found"

**Problem:** File path incorrect

**Solution:**
- Use absolute paths, or paths relative to project root
- On Windows, use forward slashes or escaped backslashes
- Check file actually exists: `ls path/to/file`

### Error: Sharp installation issues

**Problem:** Native module build failed

**Solution:**
```bash
# Approve sharp's build scripts if using pnpm
pnpm approve-builds

# Or reinstall
rm -rf node_modules
pnpm install
```

### Warning: "Ignored build scripts: sharp"

**Not an error!** This is a pnpm security feature.

**To enable (optional):**
```bash
pnpm approve-builds
```

### Error: "Unsupported file extension"

**Problem:** File format not recognized

**Supported formats:**
- PDFs: `.pdf`
- Images: `.jpg`, `.jpeg`, `.png`, `.heic`, `.webp`, `.tiff`, `.tif`

**Solution:** Convert your file to a supported format

### No paragraphs detected in output

**Problem:** Azure might not detect text in poor-quality images

**Solution:**
1. Ensure image is high resolution (at least 300 DPI)
2. Check that text is clearly visible
3. Try pre-processing image for better contrast
4. Verify Azure resource has quota remaining

---

## 10. Development Workflow

### Make Changes

1. Edit TypeScript files in `src/`
2. Run build: `npm run build`
3. Test: `npm start test-file.pdf`

### Watch Mode (Optional)

For rapid development:

```bash
# Terminal 1: Watch for changes
tsc --watch

# Terminal 2: Run
npm start input.pdf
```

### Clean Build

```bash
rm -rf dist/
npm run build
```

---

## 11. Next Steps

After verifying Phase A works:

### Prepare Test Documents

Collect sample documents for testing:
- ✅ Multi-page PDF
- ✅ Scanned image
- ✅ Photo from phone camera
- ✅ Document with tables
- ✅ Document with diagrams

### Test Edge Cases

- Very large PDFs (>100 pages)
- Low-quality scans
- Rotated images (90°, 180°, 270°)
- Images with HEIC format (iPhone photos)
- Documents with handwriting

### Monitor Azure Usage

1. Go to Azure Portal
2. Navigate to your Document Intelligence resource
3. Click "Metrics"
4. Monitor:
   - API calls
   - Page count
   - Errors

**Free tier limit:** 500 pages/month

### Plan for Phase B (Future)

Consider what features you need next:
- Confidence scoring
- Handwriting detection
- Better figure extraction
- Multi-language support
- Batch processing

---

## 12. Common Commands Reference

```bash
# Install dependencies
pnpm install

# Build TypeScript
npm run build

# Process PDF
npm start document.pdf

# Process image
npm start photo.jpg

# Custom output directory
npm start input.pdf --outDir custom-out

# Custom temp directory
npm start input.jpg --tempDir custom-temp

# Get help
npm start --help

# Development mode (auto-restart)
npm run dev input.pdf
```

---

## 13. File Locations

### Configuration
- `.env` - Azure credentials (do not commit!)
- `tsconfig.json` - TypeScript settings
- `package.json` - Dependencies and scripts

### Source Code
- `src/index.ts` - CLI entry point
- `src/normalizeInput.ts` - Universal loader
- `src/analyzePdf.ts` - Azure integration
- `src/routeContent.ts` - Content routing
- `src/export*.ts` - Export modules

### Output
- `out/` - Processed output (default)
- `temp/` - Normalized images (default)
- `dist/` - Compiled JavaScript (from build)

### Documentation
- `docs/phase-a-summary.md` - Phase A (input normalization) implementation
- `docs/phase-b-summary.md` - Phase B (quality routing) implementation
- `docs/phase-c-summary.md` - Phase C (table merging) implementation
- `docs/phase-d-summary.md` - Phase D (vision features) implementation
- `docs/phase-d-usage-examples.md` - Phase D usage scenarios
- `docs/manifest-structure.md` - Complete manifest reference
- `docs/user-guide.md` - This file
- `CLAUDE.md` - Architecture overview

---

## 14. Support and Resources

### Azure Documentation
- [Document Intelligence Overview](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/)
- [Pricing](https://azure.microsoft.com/en-us/pricing/details/ai-document-intelligence/)
- [Quota Limits](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/service-limits)

### Sharp Documentation
- [Sharp API Reference](https://sharp.pixelplumbing.com/)
- [Image Operations](https://sharp.pixelplumbing.com/api-operation)

### OpenAI Documentation (Phase D)
- [OpenAI Platform](https://platform.openai.com/)
- [Vision API Guide](https://platform.openai.com/docs/guides/vision)
- [Pricing](https://openai.com/api/pricing/)

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## Quick Start Checklist

### Required Setup
- [ ] Azure Document Intelligence resource created
- [ ] Azure endpoint and key copied
- [ ] `.env` file updated with Azure credentials
- [ ] Dependencies installed (`pnpm install`)
- [ ] Project builds successfully (`npm run build`)

### Basic Testing
- [ ] Test PDF processed successfully
- [ ] Test image processed successfully
- [ ] Manifest.json generated correctly

### Phase A (Input Normalization)
- [ ] PDFs pass through unchanged (origin: pdf_digital)
- [ ] Images normalized with sharp (origin: image_normalized)
- [ ] All content has origin metadata

### Phase B (Quality Routing)
- [ ] Manifest.json contains quality field
- [ ] All chunks/tables have quality metadata
- [ ] Output routed to auto_ok/ and needs_review/ directories
- [ ] Quality distribution logged correctly

### Phase C (Table Merging)
- [ ] Tables merged across pages
- [ ] Table previews generated in tables_previews/
- [ ] Tables have headerRow, rowCount, columnCount metadata
- [ ] Single CSV per logical table

### Phase D (Vision Features - Optional)
- [ ] OpenAI API key configured (if using vision)
- [ ] Handwriting transcription works with --handwritingVision
- [ ] Diagram captioning works with --captionDiagrams
- [ ] Vision features gracefully disabled without API key
- [ ] sourceImagePath populated for image-based content

---

*Need help? Check the troubleshooting section or review:*
- *`docs/phase-a-summary.md` for Phase A (input normalization) details*
- *`docs/phase-b-summary.md` for Phase B (quality assessment & routing) details*
- *`docs/phase-c-summary.md` for Phase C (table merging) details*
- *`docs/phase-d-summary.md` for Phase D (vision features) details*
- *`docs/phase-d-usage-examples.md` for Phase D usage scenarios*
