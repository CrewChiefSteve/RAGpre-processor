# Manifest Structure Reference

## Overview

The `manifest.json` file contains all extracted content with complete metadata from Phases A-D. This file is designed for downstream RAG ingestion and processing.

---

## Top-Level Structure

```json
{
  "sourcePdf": "document.pdf",
  "origin": "pdf_digital" | "image_normalized",
  "narrativeChunks": [...],
  "tableSummaries": [...],
  "tables": [...],
  "diagrams": [...]
}
```

### Fields

- `sourcePdf` (string) - Original input filename
- `origin` (DocumentOrigin) - Source type from Phase A
- `narrativeChunks` (NarrativeChunk[]) - Text content chunks
- `tableSummaries` (NarrativeChunk[]) - Table summaries for RAG
- `tables` (TableAsset[]) - Structured table metadata
- `diagrams` (DiagramAsset[]) - Diagram/figure metadata

---

## NarrativeChunk

Text content from paragraphs, optionally enhanced with vision transcription.

```json
{
  "id": "narrative_1",
  "sectionPath": ["Page 5"],
  "text": "The suspension geometry must comply with...",
  "sourcePdf": "rulebook.pdf",
  "pageRange": [5, 5],
  "origin": "pdf_digital",
  "quality": "ok",
  "sourceImagePath": "out/normalized_photo.png"
}
```

### Fields

**Required:**
- `id` (string) - Unique identifier
- `sectionPath` (string[]) - Hierarchical section path
- `text` (string) - Content text (may be vision-transcribed)
- `sourcePdf` (string) - Source filename
- `origin` (DocumentOrigin) - "pdf_digital" | "image_normalized"
- `quality` (ContentQuality) - "ok" | "low_confidence" | "handwriting"

**Optional:**
- `pageRange` ([number, number]) - Start and end page
- `sourceImagePath` (string) - **Phase D:** Path to normalized image (image-based inputs only)

### Phase D Enhancement

When `--handwritingVision` is enabled and quality is "handwriting" or "low_confidence":
- `text` contains vision-transcribed content (not Azure OCR)
- `id` may have `_vision` suffix
- `sourceImagePath` points to the normalized image used for transcription

---

## TableAsset

Structured table metadata with Phase C merged logical tables.

```json
{
  "id": "table_1",
  "sectionPath": ["Page 12"],
  "title": "Table on pages 12–14",
  "csvPath": "tables/rulebook_table_1.csv",
  "description": "Merged table (150 rows, 5 columns)...",
  "sourcePdf": "rulebook.pdf",
  "pageRange": [12, 14],
  "origin": "pdf_digital",
  "quality": "ok",
  "headerSignature": "component | minimum | maximum | tolerance | notes",
  "headerRow": ["Component", "Minimum", "Maximum", "Tolerance", "Notes"],
  "rowCount": 150,
  "columnCount": 5
}
```

### Fields

**Required:**
- `id` (string) - Unique identifier (logical table)
- `sectionPath` (string[]) - Hierarchical section path
- `csvPath` (string) - Relative path to CSV file
- `description` (string) - Table summary text
- `sourcePdf` (string) - Source filename
- `origin` (DocumentOrigin) - "pdf_digital" | "image_normalized"
- `quality` (ContentQuality) - "ok" | "low_confidence" | "handwriting"

**Optional:**
- `title` (string) - Human-readable title
- `pageRange` ([number, number]) - Start and end page (may span multiple pages)
- `headerSignature` (string) - **Phase C:** Normalized header for grouping
- `headerRow` (string[]) - **Phase C:** Actual header cell values
- `rowCount` (number) - **Phase C:** Total data rows (excluding header)
- `columnCount` (number) - **Phase C:** Number of columns

### Phase C Enhancement

Multi-page tables are merged into logical tables:
- `id` represents the logical table, not individual page fragments
- `pageRange` shows the full span (e.g., [12, 14])
- `headerSignature` used for detecting tables to merge
- `rowCount` is the total after merging (no duplicate headers)
- Single CSV file contains all merged data

---

## DiagramAsset

Diagram/figure metadata with extracted images and optional vision-generated captions.

**NEW in Step 2/3:** Diagrams are now automatically detected from Azure Document Intelligence, extracted as images, and optionally captioned with AI vision models.

```json
{
  "id": "diagram_1",
  "sectionPath": ["Page 8"],
  "title": "Figure 3.2",
  "imagePath": "diagrams/images/diagram_1.png",
  "description": "This technical diagram illustrates the front suspension geometry with labeled components including control arm mounting points (dimensions: 12.5\" spacing), shock absorber location (angle: 15° from vertical), and wheel center reference point. Critical constraints shown: minimum ground clearance 3.0\", maximum control arm angle 45°.",
  "sourcePdf": "rulebook.pdf",
  "page": 8,
  "origin": "pdf_digital",
  "quality": "ok",
  "sourceImagePath": null,
  "rawCaptionText": "Figure 3.2: Front Suspension Geometry"
}
```

### Fields

**Required:**
- `id` (string) - Unique identifier
- `sectionPath` (string[]) - Hierarchical section path (typically ["Page N"])
- `imagePath` (string) - **Phase B+:** Relative path to extracted diagram image (PNG)
- `sourcePdf` (string) - Source filename
- `origin` (DocumentOrigin) - "pdf_digital" | "image_normalized"
- `quality` (ContentQuality) - "ok" (confidence ≥ 0.7) | "low_confidence" (< 0.7)

**Optional:**
- `title` (string) - Human-readable title (extracted from caption if available)
- `description` (string) - **Phase D:** AI-generated technical caption describing the diagram
- `page` (number) - Page number where diagram appears
- `sourceImagePath` (string | null) - **Phase D:** Path to normalized image (image-based inputs only)
- `rawCaptionText` (string) - **Phase B:** Text from nearby paragraphs (e.g., "Figure 3.2: ...")

### Processing Pipeline

**Phase B: Detection** (`diagramDetection.ts`)
- Uses Azure Document Intelligence `figures` array
- Detects caption text from nearby paragraphs (pattern: "Figure", "Fig.", "Diagram")
- Classifies quality based on confidence scores
- Stores bounding box for extraction

**Phase B+: Image Extraction** (`extractDiagramImages.ts`)
- Crops diagram regions from source document using bounding boxes
- PDF documents: Requires optional `canvas` + `pdfjs-dist` dependencies for rendering
- Image documents: Uses normalized image from Phase A
- Adds 5% padding around diagram regions
- Saves as PNG: `{outDir}/diagrams/images/{diagramId}.png`
- Updates `imagePath` field

**Phase D: Vision Captioning** (`diagramSummaryPipeline.ts`) - Optional
- Enabled via `--captionDiagrams` flag or `ENABLE_DIAGRAM_CAPTIONING=true`
- Uses OpenAI Vision API (default: gpt-4o-mini)
- Generates technical descriptions: parts, dimensions, limits, constraints
- Uses `rawCaptionText` as context for improved accuracy
- Gracefully degrades if API key not configured

**Phase C: Export** (`exportDiagrams.ts`)
- Routes to quality buckets: `auto_ok/diagrams/` or `needs_review/diagrams/`
- Writes complete metadata as JSON (excludes internal `boundingBox` field)
- Returns full diagram objects for manifest inclusion

### Quality Classification

Diagrams use simplified quality assessment:
- **"ok"**: Confidence ≥ 0.7 or no confidence data available
- **"low_confidence"**: Confidence < 0.7
- **Note**: "handwriting" not used for diagrams (typically printed/drawn)

### Vision Caption Example

When captioning is enabled, the `description` field contains detailed technical information:

```json
"description": "Technical diagram showing front suspension geometry. Key components labeled:
1) Upper control arm mount (12.5\" from centerline)
2) Lower control arm mount (10.0\" from centerline, 8.0\" below upper)
3) Shock absorber mounting (15° angle from vertical)
4) Wheel center reference point
Constraints indicated: minimum ground clearance 3.0\", maximum control arm angle 45° at full compression, shock travel 4.5\" total."
```

### Dependencies

**For PDF Diagram Extraction:**
```bash
npm install canvas pdfjs-dist
```

If not installed:
- Image documents: ✅ Works (uses normalized image)
- PDF documents: ⚠️ Skipped with warning

**For Vision Captioning:**
- Set `OPENAI_API_KEY` in `.env`
- Optional: Set `VISION_MODEL` (default: "gpt-4o-mini")

---

## Example: Complete Manifest

```json
{
  "sourcePdf": "setup-notes.jpg",
  "origin": "image_normalized",
  "narrativeChunks": [
    {
      "id": "narrative_1_vision",
      "sectionPath": ["Page 1"],
      "text": "Front suspension setup for race #3\nCamber: -2.5 degrees\nToe: 1/16 inch out\nRide height: 3.25 inches\nShock settings: 4 clicks compression, 8 clicks rebound",
      "sourcePdf": "setup-notes.jpg",
      "pageRange": [1, 1],
      "origin": "image_normalized",
      "quality": "handwriting",
      "sourceImagePath": "out/normalized_setup-notes.png"
    }
  ],
  "tableSummaries": [],
  "tables": [],
  "diagrams": []
}
```

This example shows:
- **Phase A:** Image input normalized to PNG
- **Phase B:** Quality detected as "handwriting"
- **Phase D:** Vision transcription of handwritten note
- `sourceImagePath` preserved for reference

---

## Serialization

All fields are JSON-serializable:

### Primitive Types
- `string` - Text values
- `number` - Numeric values
- `boolean` - Not currently used

### Complex Types
- `string[]` - Arrays of strings (sectionPath, headerRow)
- `[number, number]` - Tuples for page ranges
- `null` / `undefined` - Optional fields omitted if not set

### Type Safety

TypeScript types ensure:
- ✅ All required fields present
- ✅ Optional fields properly typed
- ✅ No circular references
- ✅ Standard JSON types only

---

## Phase Summary

### Phase A: Input Normalization
- Adds: `origin` field (top-level and per-item)
- Values: "pdf_digital" | "image_normalized"

### Phase B: Quality Assessment
- Adds: `quality` field (per-item)
- Values: "ok" | "low_confidence" | "handwriting"
- Enables: Quality-based routing to auto_ok vs needs_review

### Phase C: Table Merging
- Adds: `headerSignature`, `headerRow`, `rowCount`, `columnCount`
- Behavior: Multi-page tables merged into logical tables
- Result: Single CSV per logical table, accurate metadata

### Phase D: Vision Features
- Adds: `sourceImagePath` (NarrativeChunk, DiagramAsset)
- Adds: `rawCaptionText` (DiagramAsset)
- Enhances: `text` in NarrativeChunk (vision transcription)
- Enhances: `description` in DiagramAsset (vision caption)
- Optional: Enabled via CLI flags or environment variables

---

## Usage for RAG Systems

### Narrative Content
```typescript
for (const chunk of manifest.narrativeChunks) {
  if (chunk.quality === "ok") {
    // Ingest directly into vector database
    await vectorDB.insert(chunk.text, {
      source: chunk.sourcePdf,
      page: chunk.pageRange?.[0],
      origin: chunk.origin
    });
  } else {
    // Flag for human review before ingestion
    await reviewQueue.add(chunk);
  }
}
```

### Table Summaries
```typescript
for (const summary of manifest.tableSummaries) {
  // Use summary text for semantic search
  await vectorDB.insert(summary.text, {
    source: summary.sourcePdf,
    pages: `${summary.pageRange?.[0]}-${summary.pageRange?.[1]}`,
    type: "table_summary"
  });
}
```

### Table Data
```typescript
for (const table of manifest.tables) {
  // Load CSV for structured queries
  const csvData = await loadCSV(table.csvPath);

  // Index header for searchability
  await searchIndex.add({
    id: table.id,
    headers: table.headerRow,
    rowCount: table.rowCount,
    source: table.sourcePdf
  });
}
```

### Diagrams
```typescript
for (const diagram of manifest.diagrams) {
  // Use vision-generated description for search
  if (diagram.description) {
    await vectorDB.insert(diagram.description, {
      source: diagram.sourcePdf,
      page: diagram.page,
      type: "diagram",
      imagePath: diagram.imagePath
    });
  }
}
```

---

## Validation

### Required Field Checks
```typescript
function validateManifest(manifest: any): boolean {
  // Top-level
  if (!manifest.sourcePdf || !manifest.origin) return false;

  // Narrative chunks
  for (const chunk of manifest.narrativeChunks || []) {
    if (!chunk.id || !chunk.text || !chunk.origin || !chunk.quality) {
      return false;
    }
  }

  // Tables
  for (const table of manifest.tables || []) {
    if (!table.id || !table.csvPath || !table.origin || !table.quality) {
      return false;
    }
  }

  // Diagrams
  for (const diagram of manifest.diagrams || []) {
    if (!diagram.id || !diagram.imagePath || !diagram.origin || !diagram.quality) {
      return false;
    }
  }

  return true;
}
```

### Origin Validation
```typescript
function validateOrigin(manifest: any): boolean {
  const validOrigins = ["pdf_digital", "image_normalized"];

  // Check top-level
  if (!validOrigins.includes(manifest.origin)) return false;

  // Check all items
  const allItems = [
    ...manifest.narrativeChunks || [],
    ...manifest.tableSummaries || [],
    ...manifest.tables || [],
    ...manifest.diagrams || []
  ];

  return allItems.every(item => validOrigins.includes(item.origin));
}
```

### Quality Validation
```typescript
function validateQuality(manifest: any): boolean {
  const validQualities = ["ok", "low_confidence", "handwriting"];

  const allItems = [
    ...manifest.narrativeChunks || [],
    ...manifest.tableSummaries || [],
    ...manifest.tables || [],
    ...manifest.diagrams || []
  ];

  return allItems.every(item => validQualities.includes(item.quality));
}
```

---

## File Locations

### Manifest
- **Path:** `out/manifest.json`
- **Format:** JSON
- **Encoding:** UTF-8

### Referenced Files

**Narrative chunks:**
- Exported to: `out/auto_ok/narrative/*.md` or `out/needs_review/narrative/*.md`
- Not referenced by path in manifest (inline text)

**Table summaries:**
- Exported to: `out/auto_ok/tables/*.md` or `out/needs_review/tables/*.md`
- Not referenced by path in manifest (inline text)

**Table data (CSVs):**
- Path: `out/tables/*.csv`
- Referenced in manifest via `csvPath` field

**Diagram images:**
- Path: `out/diagrams/images/*.png`
- Referenced in manifest via `imagePath` field (relative path)
- May also have `sourceImagePath` for normalized images (image-based inputs)

**Diagram metadata:**
- Exported to: `out/auto_ok/diagrams/*.json` or `out/needs_review/diagrams/*.json`
- Complete metadata including image paths and descriptions

---

## Version History

### v0.1.0 (Phases A-D)
- ✅ Phase A: DocumentOrigin tracking
- ✅ Phase B: ContentQuality routing
- ✅ Phase B: Diagram detection from Azure figures
- ✅ Phase B+: Diagram image extraction with bounding boxes
- ✅ Phase C: Table merging metadata
- ✅ Phase D: Vision features (sourceImagePath, rawCaptionText)
- ✅ Phase D: Vision-based diagram captioning

Future enhancements may include:
- Section hierarchy detection
- Multi-page diagram support
- Multi-language support
- Custom quality thresholds
- OCR diagram text extraction
