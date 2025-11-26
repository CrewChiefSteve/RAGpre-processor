# Step 5C: Hybrid Diagram Detection - Testing Guide

## Prerequisites

Before testing, ensure you have:

1. **Dependencies installed**:
   ```bash
   npm install
   npm install canvas pdfjs-dist  # Required for PDF rendering
   ```

2. **Environment variables configured** (`.env`):
   ```bash
   AZURE_DOC_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
   AZURE_DOC_KEY=your-azure-key-here
   OPENAI_API_KEY=sk-proj-your-key-here
   ENABLE_VISION_DIAGRAM_SEGMENTATION=true
   VISION_DIAGRAM_PAGE_LIMIT=20
   ```

3. **Test document**: NASCAR 2022 Weekly Series Rulebook PDF
   - Path: `C:\Users\crewc\pdf-preprocessor\test-docs\2022-Weekly-Series-Rulebook.pdf`
   - Or your own picture-heavy scanned rulebook

## Test Scenarios

### Test 1: Baseline (Azure Only)

Test that existing Azure detection still works when vision segmentation is disabled.

```bash
# Disable vision segmentation
# In .env, set: ENABLE_VISION_DIAGRAM_SEGMENTATION=false

# Build the project
npm run build

# Run preprocessing
npm start -- "test-docs/2022-Weekly-Series-Rulebook.pdf" --outDir "out/test1-azure-only"
```

**Expected output:**
```
[diagramDetection] Found 0 Azure figure(s) in document
[diagramDetection] Total diagrams: 0 (0 azure_figure, 0 azure_image, 0 vision_segment)
[exportDiagrams] No diagrams to export
```

**Verification:**
- Check `out/test1-azure-only/manifest.json` - `diagrams` array should be empty or have few items
- Check console logs - should show 0 vision_segment diagrams

### Test 2: Vision Segmentation Enabled (Default Limit)

Test vision-based detection with default page limit.

```bash
# Enable vision segmentation
# In .env, set:
# ENABLE_VISION_DIAGRAM_SEGMENTATION=true
# VISION_DIAGRAM_PAGE_LIMIT=20

# Run preprocessing
npm start -- "test-docs/2022-Weekly-Series-Rulebook.pdf" \
  --outDir "out/test2-vision-default" \
  --visionSegmentation
```

**Expected output:**
```
[diagramDetection] Found X Azure figure(s) in document
[diagramDetection] Vision segmentation enabled, scanning Y page(s) without Azure diagrams (limit: 20)
[visionDiagramSegmentation] Rendering page N to ...
[visionDiagramSegmentation] Detecting diagram regions on page N
[visionDiagramSegmentation] Found Z diagram region(s) on page N
[diagramDetection] Total diagrams: 15 (X azure_figure, 0 azure_image, Z vision_segment)
[extractDiagramImages] Extracting 15 diagram image(s)
```

**Verification:**
1. Check `out/test2-vision-default/manifest.json`:
   - `diagrams` array should have more entries than Test 1
   - Each diagram should have a `source` field
   - Should see mix of `"azure_figure"` and `"vision_segment"`

2. Check diagram images:
   ```bash
   dir out\test2-vision-default\diagrams\images
   ```
   - Should see PNG files for each diagram

3. Check diagram JSON files:
   ```bash
   dir out\test2-vision-default\auto_ok\diagrams
   dir out\test2-vision-default\needs_review\diagrams
   ```
   - Open a few JSON files, verify `source` field is present

4. Check page images (temp files):
   ```bash
   dir out\test2-vision-default\diagrams\page-images
   ```
   - Should see rendered page PNGs

### Test 3: Vision Segmentation with Custom Page Limit

Test cost control with reduced page limit.

```bash
# Run with reduced page limit
npm start -- "test-docs/2022-Weekly-Series-Rulebook.pdf" \
  --outDir "out/test3-vision-limited" \
  --visionSegmentation \
  --maxVisionPages 5
```

**Expected output:**
```
[diagramDetection] Vision segmentation enabled, scanning 5 page(s) without Azure diagrams (limit: 5)
```

**Verification:**
- Console should show vision scanning stopped after 5 pages
- Compare diagram count with Test 2 (should be fewer vision_segment diagrams)

### Test 4: Combined Vision Features

Test vision segmentation with diagram captioning enabled.

```bash
npm start -- "test-docs/2022-Weekly-Series-Rulebook.pdf" \
  --outDir "out/test4-vision-full" \
  --visionSegmentation \
  --captionDiagrams \
  --maxVisionPages 10
```

**Expected output:**
```
[diagramDetection] Total diagrams: 15 (2 azure_figure, 0 azure_image, 13 vision_segment)
[extractDiagramImages] Extracted 15/15 diagram image(s)
[pipeline] Generating summaries for 15 diagram(s)
[diagramSummaryPipeline] Captioning diagram_1 using vision model
```

**Verification:**
- Check `manifest.json` - diagrams should have both `source` and `description` fields filled
- Open diagram JSON files - should have detailed technical captions

### Test 5: Web UI Integration

Test that the web UI displays diagrams correctly.

```bash
# Start the web app
npm run dev
```

1. Navigate to `http://localhost:3000`
2. Upload the NASCAR 2022 rulebook
3. Enable vision segmentation in job settings (if available) or rely on .env
4. Start processing
5. Navigate to **Diagrams** tab

**Verification:**
- Gallery should show all detected diagrams
- Click on diagrams to view in modal
- Check browser console for any errors
- Verify images load correctly
- (Future) Check if `source` field is displayed (not yet implemented in UI)

### Test 6: Error Handling

Test graceful degradation when OpenAI API key is missing or invalid.

```bash
# Temporarily remove/invalid API key
# In .env, set: OPENAI_API_KEY=invalid-key

# Run preprocessing
npm start -- "test-docs/2022-Weekly-Series-Rulebook.pdf" \
  --outDir "out/test6-no-api-key" \
  --visionSegmentation
```

**Expected output:**
```
[visionClient] OPENAI_API_KEY not set. Vision features will be disabled.
[diagramDetection] Vision segmentation requested but OPENAI_API_KEY not set
[diagramDetection] Total diagrams: X (X azure_figure, 0 azure_image, 0 vision_segment)
```

**Verification:**
- Pipeline should complete without crashing
- Should fall back to Azure-only detection
- Console should show warning about missing API key

### Test 7: TypeScript Build

Verify that all TypeScript types are correct.

```bash
npx tsc --noEmit
```

**Expected output:**
- No errors or warnings

### Test 8: Next.js Build (Web App)

Verify that the web app builds correctly with new changes.

```bash
npm run build:web
```

**Expected output:**
- Build completes successfully
- No import errors related to pdfjs-dist or canvas (should be behind eval())

## Manual Verification Checklist

After running tests, manually verify:

- [ ] Diagrams are detected from both Azure and Vision sources
- [ ] Diagram count increases when vision segmentation is enabled
- [ ] Each diagram has correct `source` field in JSON export
- [ ] Diagram images are cropped correctly
- [ ] Manifest includes all diagrams with proper metadata
- [ ] Web UI displays diagrams without errors
- [ ] Cost is controlled (max 20 pages scanned by default)
- [ ] Pipeline gracefully handles missing API key
- [ ] TypeScript compiles without errors
- [ ] Next.js build succeeds

## Debugging Tips

### Vision API Not Called

If vision segmentation seems disabled:

1. Check environment variables:
   ```bash
   # PowerShell
   $env:ENABLE_VISION_DIAGRAM_SEGMENTATION
   $env:OPENAI_API_KEY
   ```

2. Check console logs for:
   ```
   [diagramDetection] Vision segmentation enabled, scanning...
   ```

3. Verify `.env` file is in project root and loaded:
   ```bash
   cat .env
   ```

### Bounding Boxes Incorrect

If diagram images are cropped incorrectly:

1. Check `diagrams/page-images/` to see rendered pages
2. Verify Vision API returned valid coordinates
3. Check console for coordinate clamping messages
4. May need to adjust padding in `extractDiagramImages.ts`

### High API Costs

If OpenAI costs are too high:

1. Reduce `VISION_DIAGRAM_PAGE_LIMIT` in `.env`
2. Use `--maxVisionPages` CLI flag with lower value
3. Check console logs for page count:
   ```
   [diagramDetection] Vision segmentation enabled, scanning X page(s)
   ```

## Comparing Results

To compare Azure-only vs Hybrid detection:

```bash
# Azure only
npm start -- "test.pdf" --outDir "out/azure"

# Hybrid
npm start -- "test.pdf" --outDir "out/hybrid" --visionSegmentation

# Compare diagram counts
# PowerShell:
(Get-Content out\azure\manifest.json | ConvertFrom-Json).diagrams.Count
(Get-Content out\hybrid\manifest.json | ConvertFrom-Json).diagrams.Count
```

## Performance Benchmarks

Track these metrics during testing:

1. **Processing time** - Should increase with vision segmentation (API latency)
2. **Diagram count** - Should increase significantly for scanned rulebooks
3. **API calls** - Track OpenAI API usage (vision calls = pages scanned)
4. **Memory usage** - PDF rendering uses more memory than Azure-only
5. **Output size** - More diagrams = larger output directory

## Next Steps After Testing

Once tests pass:

1. Test with other rulebooks and documents
2. Fine-tune `maxVisionPages` based on cost/accuracy tradeoff
3. Collect metrics on detection accuracy (manual review of diagrams)
4. Consider implementing UI features to show diagram source
5. Document any edge cases or limitations found during testing
