# Phase 3: Diagram Image Extraction and Vision Captioning - Summary

## Objective
Complete the diagram pipeline by extracting diagram images from Azure-detected figures and generating Vision-based captions for RAG applications.

## Problem Statement

### Before Phase 3
```json
{
  "id": "diagram_1",
  "title": "Figure 1.1",
  "imagePath": "",           // ❌ Empty - no image saved
  "description": undefined,   // ❌ Missing - no RAG context
  "source": "azure_figure",
  "boundingBox": { ... }      // ✅ Azure provides this
}
```

### After Phase 3
```json
{
  "id": "diagram_1",
  "title": "Figure 1.1",
  "imagePath": "diagrams/images/diagram_1.png",  // ✅ Cropped image saved
  "description": "Technical diagram showing...",  // ✅ RAG-ready description
  "source": "azure_figure",
  "page": 1,
  "origin": "pdf_digital",
  "quality": "ok"
}
```

## Changes Made

### 1. Fixed Bounding Box Coordinate Conversion (`src/extractDiagramImages.ts`)

**Issue**: The existing `cropDiagramRegion()` function assumed normalized coordinates (0-1 scale), but Azure's new REST API returns coordinates in **inches** from the page origin.

**Solution**: Updated coordinate conversion to handle both Azure and Vision coordinate systems:

```typescript
// NEW: Handles Azure inches and Vision pixels
async function cropDiagramRegion(
  sourceImagePath: string,
  boundingBox: any,
  outputPath: string,
  azurePageDimensions?: { width: number; height: number } // NEW parameter
): Promise<void>
```

**Coordinate System Detection**:
1. **Vision segments** (has `_visionPixels` marker): Use pixel coordinates directly
2. **Azure figures** (has `azurePageDimensions`): Convert from inches to pixels
   ```typescript
   const scaleX = imgWidth / azurePageDimensions.width;
   const scaleY = imgHeight / azurePageDimensions.height;
   ```
3. **Fallback**: Assume normalized coordinates (legacy behavior)

### 2. Integrated Phase D PDF Renderer

**Issue**: The old `renderPdfPage()` implementation had canvas import issues that caused "Cannot read properties of undefined (reading 'createCanvas')" errors.

**Solution**: Removed custom PDF rendering and reused the working Phase D `pdfRenderer.ts`:

```typescript
// OLD (broken):
import { createCanvas } from "canvas"; // dynamic import issues
await renderPdfPage(pdfPath, pageNumber, outputPath);

// NEW (working):
import { renderSinglePageToPng } from "./pipeline/render/pdfRenderer";
await renderSinglePageToPng({
  pdfPath: normalizedPath,
  pageNumber: diagram.page!,
  pngPath: tempPagePath,
  scale: 2.0,
});
```

### 3. Added Azure Page Dimensions Support

Updated `extractDiagramImages()` signature to accept Azure result:

```typescript
export async function extractDiagramImages(
  diagrams: DiagramAsset[],
  normalizedPath: string,
  outDir: string,
  azureResult?: any // NEW: For page dimensions
): Promise<DiagramAsset[]>
```

Builds a page dimensions map from Azure:
```typescript
const pageDimensionsMap = new Map<number, { width: number; height: number }>();
if (azureResult?.pages) {
  for (const page of azureResult.pages) {
    pageDimensionsMap.set(page.pageNumber, {
      width: page.width,   // in inches
      height: page.height, // in inches
    });
  }
}
```

### 4. Wired Azure Result Through Pipeline

Updated `pipeline.ts` to pass Azure result to image extraction:

```typescript
// Phase B+: Extract diagram images
diagramsWithImages = await extractDiagramImages(
  routed.diagrams,
  normalized.normalizedPath,
  outDir,
  result // ✅ Pass Azure result for page dimensions
);
```

### 5. Vision Captioning Already Working

**No changes needed** - `diagramSummaryPipeline.ts` was already complete and working:

- Filters diagrams with `imagePath`
- Calls `captionDiagramImage()` from `visionClient.ts`
- Gracefully handles missing `OPENAI_API_KEY`
- Populates `description` field in manifest

Enabled via environment variable or CLI flag:
```bash
ENABLE_DIAGRAM_CAPTIONING=true
# or
--captionDiagrams
```

## Test Results

### Test 1: SVRA General Rules (12 pages, 20 figures)

```bash
pnpm run cli "./temp/uploads/1765022737204-SVRA-General-Rules-1_25.pdf" \
  --outDir test-svra-extraction
```

**Output**:
```
[extractDiagramImages] Loaded dimensions for 12 page(s) from Azure
[extractDiagramImages] Extracted 20/20 diagram image(s)
[diagramSummaryPipeline] Summary generation complete: 20 success, 0 failed
[exportDiagrams] Exporting 20 diagram(s) (20 with images, 20 with summaries)
```

**Verification**:
- ✅ 20 PNG files in `test-svra-extraction/diagrams/images/`
- ✅ All diagram JSONs have `imagePath` populated
- ✅ All diagram JSONs have `description` populated
- ✅ Manifest contains complete diagram data

## Files Modified

1. **`src/extractDiagramImages.ts`**
   - Fixed `cropDiagramRegion()` coordinate conversion
   - Added Azure page dimensions support
   - Removed broken custom PDF rendering
   - Integrated Phase D `renderSinglePageToPng()`
   - Removed obsolete `checkPdfRenderingAvailable()` check

2. **`src/pipeline.ts`**
   - Updated `extractDiagramImages()` call to pass Azure result

## Dependencies

- ✅ `canvas` (already installed)
- ✅ `pdfjs-dist` (already installed, Phase 2)
- ✅ `sharp` (already installed)
- ✅ Phase D `pdfRenderer.ts` (Phase 2 fix)
- ✅ `visionClient.ts` (existing)
- ✅ `diagramSummaryPipeline.ts` (existing, no changes needed)

## Environment Variables

Vision captioning requires:
```bash
OPENAI_API_KEY=sk-...
VISION_MODEL=gpt-4o-mini  # or gpt-4o
ENABLE_DIAGRAM_CAPTIONING=true  # Optional, or use --captionDiagrams flag
```

## Usage

### Basic (extraction only, no Vision):
```bash
pnpm run cli input.pdf --outDir output
```

### With Vision captioning:
```bash
# Via environment variable
ENABLE_DIAGRAM_CAPTIONING=true pnpm run cli input.pdf --outDir output

# Via CLI flag
pnpm run cli input.pdf --outDir output --captionDiagrams
```

### Full pipeline (extraction + captioning + Vision segmentation):
```bash
pnpm run cli input.pdf \
  --outDir output \
  --captionDiagrams \
  --visionSegmentation \
  --maxVisionPages 20
```

## Architecture

The complete diagram flow is now:

1. **Phase B: Detection** (`diagramDetection.ts`)
   - Azure figures (primary)
   - Azure page-level images (if available)
   - Vision-based segmentation (fallback)
   - Returns `DiagramAsset[]` with `boundingBox`

2. **Phase B+: Extraction** (`extractDiagramImages.ts`) ⭐ THIS PHASE
   - Render PDF pages to PNG (Phase D renderer)
   - Convert Azure coordinates (inches → pixels)
   - Crop diagram regions using bounding boxes
   - Save to `diagrams/images/`
   - Populate `imagePath` field

3. **Phase D: Captioning** (`diagramSummaryPipeline.ts`)
   - Filter diagrams with images
   - Call OpenAI Vision API
   - Generate technical descriptions
   - Populate `description` field

4. **Phase C: Export** (`exportDiagrams.ts`)
   - Route by quality (`auto_ok` vs `needs_review`)
   - Export JSON metadata
   - Include in manifest

## Success Criteria

All met ✅:

1. **Images Extracted**
   - [x] `diagrams/images/` contains PNG files for each Azure figure
   - [x] Files are properly cropped (not full pages)
   - [x] `imagePath` field populated in manifest

2. **Captions Generated** (when enabled)
   - [x] `description` field has RAG-useful text
   - [x] Descriptions mention specific content
   - [x] Failures logged but don't crash pipeline

3. **Manifest Complete**
   - [x] All fields populated (`imagePath`, `description`, `source`, etc.)
   - [x] 20/20 diagrams have images and summaries

4. **Vision-detected diagrams also work**
   - [x] Diagrams from Pass 3 (vision_segment) supported via `_visionPixels`

## Known Limitations

1. **Vision API Cost**: Generating captions for 20 diagrams costs ~$0.20 with gpt-4o-mini
2. **Processing Time**: Each diagram requires page rendering + cropping + Vision call (~2-3 sec/diagram)
3. **Coordinate Systems**: Assumes Azure returns inches and Vision returns pixels (validated for current SDK versions)

## Next Steps (Optional Enhancements)

1. **Caching**: Cache rendered pages to avoid re-rendering for multiple diagrams on same page
2. **Batch Processing**: Process diagrams in parallel to reduce total time
3. **Quality Check**: Validate extracted images (size, aspect ratio) before captioning
4. **Fallback Captions**: Use Azure's figure captions as fallback when Vision API fails

## Conclusion

Phase 3 is **complete and tested**. The diagram pipeline now:
- ✅ Detects diagrams (Phase 1 - Azure SDK)
- ✅ Renders PDFs (Phase 2 - PDF.js fix)
- ✅ **Extracts images (Phase 3 - THIS PHASE)**
- ✅ **Generates captions (Phase 3 - THIS PHASE)**
- ✅ Exports to manifest

All 20 SVRA rulebook diagrams extracted successfully with images and Vision-generated descriptions.
