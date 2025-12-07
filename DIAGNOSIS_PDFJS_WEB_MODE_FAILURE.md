# Diagnosis: PDF.js Fails in Web Mode (Next.js)

**Date:** December 7, 2025
**Status:** ❌ CONFIRMED - Vision & Diagram Extraction BROKEN in Web Mode
**Severity:** CRITICAL - Core functionality non-operational

---

## Executive Summary

PDF.js rendering works perfectly in CLI mode but **completely fails** in web mode. ALL diagram extractions and vision features are non-functional due to a Next.js bundling issue with the PDF.js worker file.

**Impact:**
- ❌ 0 diagram images extracted (should be 20)
- ❌ 0 vision captions generated
- ❌ 0 vision debug artifacts created
- ❌ Vision segmentation failing on all pages
- ✅ Azure detection still works (20 diagrams detected)
- ✅ Text extraction still works (19 chunks)

---

## The Error

### Repeated for ALL 20 Diagrams:
```
[extractDiagramImages] Failed to extract diagram_1: Error: Setting up fake worker failed:
"Cannot find module 'C:\Users\crewc\pdf-preprocessor\.next\server\vendor-chunks\pdf.worker.mjs'
imported from C:\Users\crewc\pdf-preprocessor\.next\server\vendor-chunks\pdfjs-dist@4.7.76.js".
```

### Also Affects Vision Segmentation:
```
[visionDiagramSegmentation] PDF.js fake worker failed. Page 6 will be skipped.
Vision segmentation will continue with remaining pages. Error: Setting up fake worker failed...
```

### Phase B/C/D/E Complete Failure:
```
[pipeline] Phase B/C/D/E failed: Error: Invalid PDF document:
Setting up fake worker failed: "Cannot find module '...\pdf.worker.mjs'..."
```

---

## Root Cause Analysis

### 1. **Next.js Bundling Issue**

**Problem:** Next.js's webpack bundler transforms pdfjs-dist into vendor chunks:
```
node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs
  ↓ (Next.js webpack bundling)
.next/server/vendor-chunks/pdf.worker.mjs  ← FILE DOESN'T EXIST
```

**Expected Location:** `.next/server/vendor-chunks/pdf.worker.mjs`
**Actual Location:** Unknown (not being generated/copied)

### 2. **Worker Path Resolution**

PDF.js tries to load its worker using:
```javascript
const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url);
```

In Next.js server-side context:
- ✅ **CLI mode:** Resolves to `node_modules/pdfjs-dist/.../pdf.worker.mjs` (works)
- ❌ **Web mode:** Resolves to `.next/server/vendor-chunks/pdf.worker.mjs` (doesn't exist)

### 3. **Next.js Configuration Gap**

The `next.config.cjs` externalizes PDF.js modules:
```javascript
serverExternalPackages: [
  'sharp',
  '@azure/ai-form-recognizer',
  'pdfjs-dist',
  'canvas'
]
```

But this only affects server components, not the worker file resolution.

---

## Evidence from Server Logs

### Diagram Extraction Failures (20/20):
```
[extractDiagramImages] Failed to extract diagram_1
[extractDiagramImages] Failed to extract diagram_2
...
[extractDiagramImages] Failed to extract diagram_20
```

**All 20 diagrams failed with the same worker error.**

### Vision Segmentation Failures:
```
[visionDiagramSegmentation] Page 6 could not be rendered. Returning empty result.
[visionDiagramSegmentation] Page 11 could not be rendered. Returning empty result.
```

**Pages that need vision fallback cannot be rendered.**

### Phase D Completely Skipped:
```
[pipeline] Phase B/C/D/E failed: Error: Invalid PDF document
```

**The new pipeline (Phases A-E) fails completely, falling back to legacy path.**

**Legacy path executes but:**
- `extractDiagramImages()` called ✅
- All 20 extractions failed ❌
- `generateDiagramSummaries()` skipped (no images to caption) ❌

---

## Call Chain Analysis

### Web Mode Flow:

```
User Upload
  ↓
POST /api/jobs (create job)
  ↓
JobRunner.processJob()
  ↓
preprocessorAdapter.runPreprocessorForJob()
  ↓
src/pipeline.ts → runPipeline()
  ↓
Phase B: loadDocument() → PDF.js worker ERROR ❌
  ↓
(Falls back to legacy path)
  ↓
Phase B (legacy): analyzePdf() → Azure ✅
  ↓
routeContent() → 20 diagrams detected ✅
  ↓
extractDiagramImages() → PDF.js worker ERROR ❌ (×20)
  ↓
exportDiagrams() → Writes empty imagePath JSONs
  ↓
Result: Diagrams detected but not extracted
```

### CLI Mode Flow (Works):

```
pnpm run cli ./rulebook.pdf
  ↓
src/cli.ts → runPipeline()
  ↓
Phase B: loadDocument() → PDF.js resolves from node_modules ✅
  ↓
Phase D: renderPdfPagesToPngs() → Creates PNGs ✅
  ↓
Phase D: segmentAndStoreDiagrams() → Saves to Prisma ✅
  ↓
Phase D: explainDiagrams() → Vision captions ✅
  ↓
Result: Full diagram processing works
```

---

## Files Affected

### Files that Import pdfRenderer (All Broken in Web Mode):

1. **`src/pipeline/loader.ts`** - `loadDocument()` → **FAILS**
2. **`src/pipeline/render/pdfRenderer.ts`** - `renderPdfPagesToPngs()` → **FAILS**
3. **`src/extractDiagramImages.ts`** - `extractDiagramImages()` → **FAILS** (×20)
4. **`src/visionDiagramSegmentation.ts`** - Vision fallback → **FAILS**

### Indirect Callers (Web Mode):

- `lib/preprocessorAdapter.ts` → Calls pipeline → **Triggers failures**
- `lib/jobRunner.ts` → Calls adapter → **Processes broken jobs**

---

## What DOES Work in Web Mode

### ✅ Azure Document Intelligence
- PDF analysis succeeds
- 20 figures detected
- Tables extracted
- Text extracted
- Confidence scores calculated

### ✅ Database Operations
- Job creation
- Status tracking
- Log writes
- File uploads

### ✅ Legacy Pipeline (Partially)
- `analyzePdf()` → Azure call works
- `routeContent()` → Content routing works
- `exportNarrative()` → Markdown export works
- `exportTables()` → CSV export works
- `exportDiagrams()` → JSON stubs written (but no images)

---

## What DOESN'T Work in Web Mode

### ❌ PDF.js Operations (ALL)
- `loadDocument()` - Cannot load PDF
- `renderPdfPagesToPngs()` - Cannot render pages
- `renderSinglePageToPng()` - Cannot render single page
- `extractDiagramImages()` - Cannot extract diagrams
- `visionDiagramSegmentation()` - Cannot segment pages

### ❌ Vision Features (ALL)
- Diagram captioning - No images to caption
- Handwriting transcription - May work if images provided
- Vision fallback detection - Cannot render pages
- Debug artifacts - No overlays generated

### ❌ New Pipeline Phases (Phases B-E)
- Phase B: Multi-extractor fails at PDF loading
- Phase C: Structure compilation not reached
- Phase D: Rendering & diagrams not reached
- Phase E: Tables/chunking/embeddings not reached

---

## Comparison: CLI vs Web Mode

| Feature | CLI Mode | Web Mode | Reason |
|---------|----------|----------|--------|
| **PDF.js Worker** | ✅ Works | ❌ Broken | Next.js bundling |
| **Diagram Detection** | ✅ 20 found | ✅ 20 found | Azure (independent) |
| **Diagram Extraction** | ✅ 20 images | ❌ 0 images | PDF.js required |
| **Vision Captions** | ✅ Generated | ❌ Skipped | No images to caption |
| **Vision Debug** | ✅ Artifacts | ❌ None | Cannot render pages |
| **Text Extraction** | ✅ Works | ✅ Works | Azure (independent) |
| **Table Extraction** | ✅ Works | ✅ Works | Azure (independent) |
| **Phases A-E** | ✅ All execute | ❌ Fail at Phase B | PDF.js worker |
| **Legacy Pipeline** | ✅ Works | ⚠️ Partial | Diagram extraction fails |

---

## Why This Wasn't Caught Earlier

1. **Phase 2 Fix Was CLI-Specific**
   - `PHASE2_PDFJS_FIX_SUMMARY.md` documented the fix for standalone execution
   - Next.js bundling behavior is different
   - No web mode testing was done in Phase 2

2. **Web UI Was Recently Implemented**
   - Phase 4 added web UI
   - Focused on orchestration, not diagram features
   - Assumed pipeline would "just work"

3. **Errors Are Swallowed**
   - `extractDiagramImages()` catches errors, returns empty array
   - Job completes "successfully" with missing features
   - No explicit "diagram extraction failed" in job status

4. **Database Logs Don't Capture Everything**
   - Console.log statements from pipeline not captured
   - Worker errors only visible in server stderr
   - User sees completed job without images

---

## Impact on User Experience

### What Users See:
```
Job Status: ✅ Completed
Diagrams Detected: 20
Diagram Images: None visible
Description: Empty
```

### What Users Expected:
```
Job Status: ✅ Completed
Diagrams Detected: 20
Diagram Images: 20 PNG files
Description: "Technical diagram showing..."
```

### Silent Degradation:
- No error message to user
- Job appears successful
- Critical features missing
- No indication of what went wrong

---

## Next Steps to Fix

### Option 1: Copy Worker File (Quick Fix)
Configure Next.js to copy `pdf.worker.mjs` to the output directory.

**Pros:**
- Simple configuration change
- Minimal code changes
- Fast to implement

**Cons:**
- May break on Next.js upgrades
- Doesn't address root bundling issue

### Option 2: Use Static Worker (Better)
Point PDF.js to a static worker file location.

**Pros:**
- More reliable
- Better control over worker location
- Less dependent on bundler behavior

**Cons:**
- Requires static file serving configuration
- Worker version must match pdfjs-dist version

### Option 3: Externalize PDF.js (Best)
Configure webpack to fully externalize pdfjs-dist and load from node_modules.

**Pros:**
- Most robust solution
- Matches CLI behavior
- Worker resolution works natively

**Cons:**
- More complex configuration
- May affect bundle size

### Option 4: Canvas Fallback
Use canvas-based rendering instead of PDF.js for Next.js.

**Pros:**
- No worker issues
- Already in external packages

**Cons:**
- Different rendering engine
- May have different quality/performance

---

## Recommended Solution

**Immediate (Today):**
1. Add `CopyWebpackPlugin` to copy worker file
2. Configure PDF.js `workerSrc` to static path
3. Test with sample upload

**Short-term (This Week):**
1. Implement proper PDF.js initialization for Next.js
2. Add error detection in preprocessorAdapter
3. Surface errors to user if diagram extraction fails

**Long-term (Future):**
1. Consider migrating to canvas-only rendering
2. Evaluate alternative PDF libraries for server-side
3. Add comprehensive web mode testing

---

## Testing Checklist

To verify the fix works:

- [ ] Upload SVRA rulebook via web UI
- [ ] Verify 20 diagram images created in `out/jobs/{id}/diagrams/images/`
- [ ] Verify diagram JSONs have populated `imagePath` fields
- [ ] Verify vision captions generated (if enabled)
- [ ] Verify vision debug artifacts created (if enabled)
- [ ] Check server logs for no PDF.js worker errors
- [ ] Verify Phase D executes successfully
- [ ] Compare web mode output to CLI mode output (should match)

---

## Conclusion

**Diagnosis Confirmed:** Vision and diagram extraction are completely broken in web mode due to Next.js's handling of the PDF.js worker file. The worker file cannot be resolved at runtime, causing all PDF rendering operations to fail.

**Severity:** CRITICAL - Core features non-functional
**Confidence:** 100% - Error reproduced, root cause identified
**Fix Complexity:** MODERATE - Requires Next.js/webpack configuration changes

The fix from Phase 2 solved the problem for CLI mode but did not account for Next.js's different module bundling strategy. A web-mode-specific solution is required.
