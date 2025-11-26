# Step 5C: Hybrid Diagram Detection - Implementation Summary

## Overview

This implementation adds **hybrid diagram detection** to the preprocessing pipeline, combining three detection sources to maximize diagram discovery in picture-heavy, scanned rulebooks:

1. **Azure Document Intelligence figures** (existing)
2. **Azure page-level images** (if available in API response)
3. **Vision-based page segmentation** (fallback for pages with no Azure diagrams)

## Key Features

- **Backward compatible**: Existing behavior unchanged when vision segmentation is disabled
- **Cost-controlled**: Only scans pages without Azure diagrams, up to a configurable limit
- **Source tracking**: Each diagram tagged with detection source for debugging and quality assessment
- **Graceful degradation**: Falls back to Azure-only detection if OpenAI API key not configured

## Architecture Changes

### 1. DiagramAsset Extension (types.ts)

Added `source` field to track diagram detection source:

```typescript
export type DiagramSource = "azure_figure" | "azure_image" | "vision_segment";

export type DiagramAsset = {
  // ... existing fields ...
  source?: DiagramSource; // Detection source
}
```

### 2. Vision Segmentation Module (visionDiagramSegmentation.ts)

New module providing:
- `detectDiagramRegionsWithVision()` - Single page vision segmentation
- `detectDiagramRegionsMultiPage()` - Batch processing for multiple pages
- PDF page rendering using pdfjs-dist + canvas
- Bounding box validation and clamping

### 3. Hybrid Detection Logic (diagramDetection.ts)

Three-pass detection system:

**Pass 1: Azure Figures**
- Uses existing Azure Document Intelligence figure detection
- Tags diagrams with `source: "azure_figure"`

**Pass 2: Azure Page-Level Images**
- Checks for `result.pages[n].images` from Azure SDK
- Tags diagrams with `source: "azure_image"`

**Pass 3: Vision Segmentation**
- Only runs on pages with NO diagrams from Pass 1 or 2
- Respects `maxVisionPages` limit for cost control
- Calls OpenAI Vision API with structured JSON prompt
- Tags diagrams with `source: "vision_segment"`

### 4. Pipeline Integration

**pipeline.ts**
- Added `enableVisionSegmentation` and `maxVisionPages` to `PipelineConfig`
- Passes options to `routeContent()`

**routeContent.ts**
- Now async to support vision detection
- Passes detection options to `detectDiagrams()`

**exportDiagrams.ts**
- Includes `source` field in JSON exports

### 5. CLI and Web Integration

**CLI (index.ts)**
- New flags: `--visionSegmentation`, `--maxVisionPages`

**Web Jobs (preprocessorAdapter.ts)**
- Reads vision settings from environment variables

## Environment Variables

```bash
# Enable Vision-based diagram segmentation
ENABLE_VISION_DIAGRAM_SEGMENTATION=true

# Maximum number of pages to scan with Vision (cost control)
VISION_DIAGRAM_PAGE_LIMIT=20

# OpenAI API key (required for vision features)
OPENAI_API_KEY=sk-proj-...

# Vision model to use
VISION_MODEL=gpt-4o-mini
```

## Usage

### CLI Mode

```bash
# Enable vision segmentation with default limit (20 pages)
npm start -- path/to/rulebook.pdf --visionSegmentation

# Custom page limit
npm start -- path/to/rulebook.pdf --visionSegmentation --maxVisionPages 10

# Combined with other vision features
npm start -- path/to/rulebook.pdf \
  --visionSegmentation \
  --captionDiagrams \
  --maxVisionPages 15
```

### Web Mode

Set environment variables in `.env`:

```bash
ENABLE_VISION_DIAGRAM_SEGMENTATION=true
VISION_DIAGRAM_PAGE_LIMIT=20
```

All web jobs will automatically use vision segmentation if enabled.

## Output Format

### Diagram JSON Export

Each diagram in `auto_ok/diagrams/` or `needs_review/diagrams/` includes:

```json
{
  "id": "diagram_1",
  "sectionPath": ["Page 5"],
  "title": "Roll cage diagram",
  "imagePath": "diagrams/images/diagram_1.png",
  "description": "...",
  "sourcePdf": "rulebook.pdf",
  "page": 5,
  "origin": "pdf_digital",
  "quality": "ok",
  "source": "vision_segment"
}
```

### Manifest Structure

The `manifest.json` includes all diagrams with their `source` field:

```json
{
  "diagrams": [
    {
      "id": "diagram_1",
      "source": "azure_figure",
      ...
    },
    {
      "id": "diagram_2",
      "source": "vision_segment",
      ...
    }
  ]
}
```

## Logging

Console output shows diagram counts by source:

```
[diagramDetection] Found 2 Azure figure(s) in document
[diagramDetection] Vision segmentation enabled, scanning 8 page(s) without Azure diagrams (limit: 20)
[diagramDetection] Total diagrams: 15 (2 azure_figure, 0 azure_image, 13 vision_segment)
```

## Cost Control

Vision segmentation respects several limits:

1. **Only scans pages without Azure diagrams** - Reduces redundant API calls
2. **Page limit** - Configurable via `maxVisionPages` (default: 20)
3. **Rate limiting** - 500ms delay between page scans
4. **Graceful failure** - Errors logged but don't crash pipeline

## Backward Compatibility

- If `ENABLE_VISION_DIAGRAM_SEGMENTATION` is not set or false, behavior is identical to before
- If `OPENAI_API_KEY` is not set, vision features are skipped with a warning
- Existing diagrams without `source` field are treated as Azure figures
- UI components work unchanged (manifest structure compatible)

## Known Limitations

1. Vision model may occasionally return invalid JSON - handled with try/catch
2. Bounding box coordinates are approximate - may need manual refinement
3. Vision API costs can accumulate on large documents - use `maxVisionPages` limit
4. Azure page-level images may not be available in all SDK versions

## Next Steps (Future Improvements)

1. **Better heuristics** - Prioritize pages likely to contain diagrams
2. **Quality estimation** - Assign confidence scores to vision-detected diagrams
3. **UI enhancements** - Show detection source in Diagrams tab
4. **Batch optimization** - Process multiple pages in parallel
5. **Prompt tuning** - Improve vision model accuracy for specific diagram types
6. **Cost tracking** - Log estimated API costs per job
