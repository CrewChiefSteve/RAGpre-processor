# Phase B Quick Reference

## New Modules Overview

### 1. Core Types
**File**: `src/pipeline/types.ts`

```typescript
// Main input/output types
NormalizedDocument    // PDF loaded into memory with metadata
PageText              // Extracted text for one page
TextBlock             // A paragraph/line of text
ExtractedTable        // A table with headers and rows

// Supporting types
DocumentType          // "pdf_digital" | "pdf_scanned" | "unknown"
ExtractorSource       // "azure" | "pdfjs" | "ocr"
BBox                  // Normalized bounding box (0-1 coordinates)
TextStyle             // Font family, size, bold, italic
```

### 2. Universal Loader
**File**: `src/pipeline/loader.ts`

```typescript
loadDocument(source: string, opts?: LoadDocumentOptions): Promise<NormalizedDocument>
```

Loads PDFs from local paths or URLs, validates with pdf.js, returns normalized document.

### 3. Azure Extractor
**File**: `src/pipeline/extractors/azureTextExtractor.ts`

```typescript
extractPageTextWithAzure(doc: NormalizedDocument, opts?: AzureExtractorOptions): Promise<PageText[]>
```

Calls Azure Document Intelligence, normalizes to PageText[] with blocks, tables, bboxes, styles.

### 4. pdf.js Extractor
**File**: `src/pipeline/extractors/pdfjsTextExtractor.ts`

```typescript
extractPageTextWithPdfJs(doc: NormalizedDocument, opts?: PdfJsExtractorOptions): Promise<PageText[]>
```

Fallback extractor using pdf.js for basic text extraction (no tables).

### 5. Multi-Extractor Orchestrator
**File**: `src/pipeline/pageTextExtractor.ts`

```typescript
extractPageText(doc: NormalizedDocument, opts?: MultiExtractorOptions): Promise<PageText[]>
```

**Logic**:
1. Try Azure first (if enabled)
2. On complete failure → fall back to pdf.js
3. On partial failure → use Azure pages + fill gaps with pdf.js
4. Log which extractor was used per page

## Integration Point

**File**: `src/pipeline.ts` (line ~70)

The new extractors run in Phase B, right after Phase A normalization:

```typescript
// Phase A: Normalize input
const normalized = await normalizeInput(inputPath, outDir);

// Phase B: Test new multi-extractor (parallel to existing flow)
const normalizedDoc = await loadDocument(normalized.normalizedPath);
const pageTextArray = await extractPageText(normalizedDoc, {
  useAzure: true,
  usePdfJsFallback: true,
  maxPages: maxVisionPages > 0 ? maxVisionPages : normalizedDoc.pageCount,
});
// ... logs statistics ...

// Legacy path continues (analyzePdf, routeContent, exports)
const result = await analyzePdf(normalized.normalizedPath);
// ...
```

## CLI Usage (Unchanged)

```bash
# Basic usage
pnpm run cli ./document.pdf --outDir ./output

# With options
pnpm run cli ./document.pdf --outDir ./output \
  --handwritingVision \
  --captionDiagrams \
  --visionSegmentation \
  --maxVisionPages 20
```

## Expected Log Output

```
=== Phase B: Multi-Extractor Text Layer ===
[loadDocument] Loading: C:\Users\...\document.pdf
[loadDocument] Loaded 10 pages, type: pdf_digital
[pipeline] Loaded document: 10 pages, type: pdf_digital
[pageTextExtractor] Extracting text from 10 pages (useAzure: true, usePdfJsFallback: true)
[pageTextExtractor] Attempting Azure extraction...
[azureTextExtractor] Analyzing 10 pages with Azure (model: prebuilt-layout)
[azureTextExtractor] Azure returned 10 pages, 42 paragraphs, 3 tables
[pageTextExtractor] Azure succeeded for 10 pages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
[pageTextExtractor] Final extraction summary:
  - azure: 10 page(s)
[pipeline] Multi-extractor returned 10 pages
[pipeline] Total extracted: 42 text blocks, 3 tables
=== End Phase B ===
```

## Verification

```bash
# TypeScript compilation
npx tsc --noEmit
# ✅ Clean (no errors)

# Next.js build
pnpm run build:web
# ✅ Compiled successfully
```

## What's Next

Phase B provides the foundation for:
- **Phase C**: Structure compiler (parse sections/rules)
- **Phase D**: Diagram detection and extraction
- **Phase E**: Table merging
- **Phase F**: Chunk generation
- **Phase G**: Prisma model population

Currently, the new extractors run in **testing mode** alongside the existing pipeline. Future phases will fully replace the legacy path.
