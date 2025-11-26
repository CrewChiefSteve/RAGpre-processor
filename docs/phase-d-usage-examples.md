# Phase D Usage Examples

## Overview

This document shows expected behaviors and console output for Phase D vision features in different scenarios.

---

## Scenario 1: Handwritten Note (Image-based Input)

### Input
- File: `handwritten-setup.jpg`
- Content: Handwritten racing setup notes
- Quality: Handwriting/Low confidence from Azure OCR

### Command
```bash
npm start handwritten-setup.jpg --handwritingVision
```

Or with environment variable:
```bash
export ENABLE_HANDWRITING_VISION=true
npm start handwritten-setup.jpg
```

### Expected Console Output
```
[CLI] Input: /path/to/handwritten-setup.jpg
[CLI] Output dir: /path/to/out
[normalizeInput] Detected image: /path/to/handwritten-setup.jpg
[normalizeInput] Normalized image written to: /path/to/out/normalized_handwritten-setup.png
[CLI] Normalized input: /path/to/out/normalized_handwritten-setup.png (origin: image_normalized)
[analyzePdf] Analyzing: /path/to/out/normalized_handwritten-setup.png
[analyzePdf] Pages: 1, tables: 0
[CLI] Handwriting vision enabled, enriching narrative blocks...
[handwritingPipeline] Attempting vision transcription for out/normalized_handwritten-setup.png
[handwritingPipeline] Found 3 problematic chunks out of 3 image chunks
[handwritingPipeline] Vision transcription successful (247 chars)
[exportNarrative] Blocks: 1
[exportNarrative] Wrote 1 markdown chunks.
[CLI] Routed narrative chunks: 1 (auto_ok + needs_review)
[exportTables] Azure tables: 0, logical tables: 0
[exportDiagrams] Wrote 0 diagram stubs.
[CLI] Quality distribution: 0 ok, 0 low_confidence, 1 handwriting
[CLI] Routed to auto_ok: 0, needs_review: 1
[CLI] Preprocessing complete.
```

### Expected Output

**Manifest (`out/manifest.json`):**
```json
{
  "sourcePdf": "handwritten-setup.jpg",
  "origin": "image_normalized",
  "narrativeChunks": [
    {
      "id": "narrative_1_vision",
      "sectionPath": ["Page 1"],
      "text": "Front suspension setup for race #3\nCamber: -2.5 degrees\nToe: 1/16 inch out\nRide height: 3.25 inches\nShock settings: 4 clicks compression, 8 clicks rebound\nTire pressure: 32 PSI cold\nNotes: Good grip in turn 3, slight understeer in turn 7",
      "sourcePdf": "handwritten-setup.jpg",
      "pageRange": [1, 1],
      "origin": "image_normalized",
      "quality": "handwriting",
      "sourceImagePath": "out/normalized_handwritten-setup.png"
    }
  ],
  "tableSummaries": [],
  "tables": [],
  "diagrams": []
}
```

**File (`out/needs_review/narrative/narrative_1_vision.md`):**
```markdown
Front suspension setup for race #3
Camber: -2.5 degrees
Toe: 1/16 inch out
Ride height: 3.25 inches
Shock settings: 4 clicks compression, 8 clicks rebound
Tire pressure: 32 PSI cold
Notes: Good grip in turn 3, slight understeer in turn 7
```

### Key Points
- ✅ Azure OCR text replaced with clean vision transcription
- ✅ Single `NarrativeChunk` with `_vision` suffix
- ✅ `origin: "image_normalized"`
- ✅ `quality: "handwriting"`
- ✅ `sourceImagePath` preserved for reference
- ✅ Routed to `needs_review/` due to handwriting quality

---

## Scenario 2: Technical Diagram (PDF with Diagram Image)

### Input
- File: `rulebook.pdf`
- Content: Technical diagram on page 8
- Note: Assume diagram has been extracted to `out/suspension-diagram.png`

### Command
```bash
npm start rulebook.pdf --captionDiagrams
```

Or with environment variable:
```bash
export ENABLE_DIAGRAM_CAPTIONING=true
npm start rulebook.pdf
```

### Expected Console Output
```
[CLI] Input: /path/to/rulebook.pdf
[CLI] Output dir: /path/to/out
[normalizeInput] Detected PDF (digital): /path/to/rulebook.pdf
[CLI] Normalized input: /path/to/rulebook.pdf (origin: pdf_digital)
[analyzePdf] Analyzing: /path/to/rulebook.pdf
[analyzePdf] Pages: 50, tables: 2
[exportNarrative] Blocks: 234
[exportNarrative] Wrote 15 markdown chunks.
[CLI] Routed narrative chunks: 15 (auto_ok + needs_review)
[exportTables] Azure tables: 2, logical tables: 1
[exportTables] Logical tables quality: ok=1, needs_review=0
[exportTables] Merged 1 page fragments across 1 logical tables.
[CLI] Routed table summaries: 1 (auto_ok + needs_review)
[exportDiagrams] Diagram captioning enabled
[exportDiagrams] Captioning diagram diagram_1 from out/suspension-diagram.png
[exportDiagrams] Caption generated (342 chars)
[exportDiagrams] Wrote 1 diagram stubs.
[exportDiagrams] Vision captioning: 1/1 diagrams captioned
[CLI] Routed diagram stubs: 1 (auto_ok + needs_review)
[CLI] Quality distribution: 15 ok, 1 low_confidence, 0 handwriting
[CLI] Routed to auto_ok: 15, needs_review: 1
[CLI] Preprocessing complete.
```

### Expected Output

**Diagram JSON (`out/auto_ok/diagrams/diagram_1.json`):**
```json
{
  "id": "diagram_1",
  "sectionPath": ["Page 8"],
  "title": "Figure 3.2: Suspension Geometry",
  "imagePath": "out/suspension-diagram.png",
  "description": "This technical diagram illustrates the front suspension geometry for a racing vehicle. Key measurements shown include: wheelbase of 96 inches, track width of 60 inches, and a maximum suspension travel of 4 inches. The diagram labels critical components including the upper control arm, lower control arm, shock absorber mounting points, and wheel hub. Dimensional constraints indicate a minimum ground clearance of 2 inches and maximum camber angle of -3 degrees. All measurements comply with the technical regulations specified in Section 3.2 of the rulebook.",
  "sourcePdf": "rulebook.pdf",
  "page": 8,
  "origin": "pdf_digital",
  "quality": "ok",
  "rawCaptionText": "Figure 3.2 shows the front suspension geometry with dimensional constraints"
}
```

### Key Points
- ✅ Vision-generated technical caption
- ✅ Describes parts, dimensions, limits, constraints
- ✅ Uses `rawCaptionText` as context
- ✅ `origin: "pdf_digital"`
- ✅ `quality: "ok"`
- ✅ Routed to `auto_ok/` due to good quality

---

## Scenario 3: Combined Features (Image + Diagram)

### Input
- File: `photo-with-diagram.jpg`
- Content: Photo of document page with both handwritten notes and a technical diagram

### Command
```bash
npm start photo-with-diagram.jpg --handwritingVision --captionDiagrams
```

Or with environment variables:
```bash
export ENABLE_HANDWRITING_VISION=true
export ENABLE_DIAGRAM_CAPTIONING=true
npm start photo-with-diagram.jpg
```

### Expected Console Output
```
[CLI] Input: /path/to/photo-with-diagram.jpg
[CLI] Output dir: /path/to/out
[normalizeInput] Detected image: /path/to/photo-with-diagram.jpg
[normalizeInput] Normalized image written to: /path/to/out/normalized_photo-with-diagram.png
[CLI] Normalized input: /path/to/out/normalized_photo-with-diagram.png (origin: image_normalized)
[analyzePdf] Analyzing: /path/to/out/normalized_photo-with-diagram.png
[analyzePdf] Pages: 1, tables: 0
[CLI] Handwriting vision enabled, enriching narrative blocks...
[handwritingPipeline] Attempting vision transcription for out/normalized_photo-with-diagram.png
[handwritingPipeline] Found 2 problematic chunks out of 2 image chunks
[handwritingPipeline] Vision transcription successful (156 chars)
[exportNarrative] Blocks: 1
[exportNarrative] Wrote 1 markdown chunks.
[CLI] Routed narrative chunks: 1 (auto_ok + needs_review)
[exportTables] Azure tables: 0, logical tables: 0
[exportDiagrams] Diagram captioning enabled
[exportDiagrams] Captioning diagram diagram_1 from out/normalized_photo-with-diagram.png
[exportDiagrams] Caption generated (298 chars)
[exportDiagrams] Wrote 1 diagram stubs.
[exportDiagrams] Vision captioning: 1/1 diagrams captioned
[CLI] Routed diagram stubs: 1 (auto_ok + needs_review)
[CLI] Quality distribution: 0 ok, 0 low_confidence, 2 handwriting
[CLI] Routed to auto_ok: 0, needs_review: 2
[CLI] Preprocessing complete.
```

### Key Points
- ✅ Both vision features applied
- ✅ Handwriting transcribed from normalized image
- ✅ Diagram captioned from same image
- ✅ Both use `sourceImagePath`
- ✅ All content routed to `needs_review/`

---

## Scenario 4: Vision Features Disabled (Default)

### Input
- File: `handwritten-note.jpg`

### Command
```bash
npm start handwritten-note.jpg
```
*(No flags, features disabled by default)*

### Expected Console Output
```
[CLI] Input: /path/to/handwritten-note.jpg
[CLI] Output dir: /path/to/out
[normalizeInput] Detected image: /path/to/handwritten-note.jpg
[normalizeInput] Normalized image written to: /path/to/out/normalized_handwritten-note.png
[CLI] Normalized input: /path/to/out/normalized_handwritten-note.png (origin: image_normalized)
[analyzePdf] Analyzing: /path/to/out/normalized_handwritten-note.png
[analyzePdf] Pages: 1, tables: 0
[exportNarrative] Blocks: 3
[exportNarrative] Wrote 3 markdown chunks.
[CLI] Routed narrative chunks: 3 (auto_ok + needs_review)
[exportTables] Azure tables: 0, logical tables: 0
[exportDiagrams] Wrote 0 diagram stubs.
[CLI] Quality distribution: 0 ok, 2 low_confidence, 1 handwriting
[CLI] Routed to auto_ok: 0, needs_review: 3
[CLI] Preprocessing complete.
```

### Key Points
- ❌ No handwriting vision logs (feature disabled)
- ❌ No diagram captioning logs (feature disabled)
- ✅ Azure OCR results used directly
- ✅ Multiple chunks from messy OCR
- ✅ All routed to `needs_review/` due to low quality

---

## Scenario 5: Vision API Key Missing

### Input
- File: `handwritten-note.jpg`
- Configuration: `OPENAI_API_KEY` not set or invalid

### Command
```bash
npm start handwritten-note.jpg --handwritingVision
```

### Expected Console Output
```
[visionClient] OPENAI_API_KEY not set. Vision features will be disabled.
[CLI] Input: /path/to/handwritten-note.jpg
[CLI] Output dir: /path/to/out
[normalizeInput] Detected image: /path/to/handwritten-note.jpg
[normalizeInput] Normalized image written to: /path/to/out/normalized_handwritten-note.png
[CLI] Normalized input: /path/to/out/normalized_handwritten-note.png (origin: image_normalized)
[analyzePdf] Analyzing: /path/to/out/normalized_handwritten-note.png
[analyzePdf] Pages: 1, tables: 0
[CLI] Handwriting vision enabled, enriching narrative blocks...
[handwritingPipeline] Attempting vision transcription for out/normalized_handwritten-note.png
[handwritingPipeline] Found 3 problematic chunks out of 3 image chunks
[handwritingPipeline] Vision transcription failed for out/normalized_handwritten-note.png
[exportNarrative] Blocks: 3
[exportNarrative] Wrote 3 markdown chunks.
[CLI] Routed narrative chunks: 3 (auto_ok + needs_review)
[exportTables] Azure tables: 0, logical tables: 0
[exportDiagrams] Wrote 0 diagram stubs.
[CLI] Quality distribution: 0 ok, 2 low_confidence, 1 handwriting
[CLI] Routed to auto_ok: 0, needs_review: 3
[CLI] Preprocessing complete.
```

### Key Points
- ⚠️ Warning at startup about missing API key
- ❌ Vision transcription returns `null`
- ✅ Falls back to original Azure OCR content
- ✅ Pipeline continues without failure
- ✅ Graceful degradation

---

## Scenario 6: Good Quality Image (Vision Skipped)

### Input
- File: `high-quality-scan.jpg`
- Content: Clean typed text with good OCR quality

### Command
```bash
npm start high-quality-scan.jpg --handwritingVision
```

### Expected Console Output
```
[CLI] Input: /path/to/high-quality-scan.jpg
[CLI] Output dir: /path/to/out
[normalizeInput] Detected image: /path/to/high-quality-scan.jpg
[normalizeInput] Normalized image written to: /path/to/out/normalized_high-quality-scan.png
[CLI] Normalized input: /path/to/out/normalized_high-quality-scan.png (origin: image_normalized)
[analyzePdf] Analyzing: /path/to/out/normalized_high-quality-scan.png
[analyzePdf] Pages: 1, tables: 0
[CLI] Handwriting vision enabled, enriching narrative blocks...
[handwritingPipeline] All 5 image chunks have good quality, skipping vision transcription
[exportNarrative] Blocks: 5
[exportNarrative] Wrote 5 markdown chunks.
[CLI] Routed narrative chunks: 5 (auto_ok + needs_review)
[exportTables] Azure tables: 0, logical tables: 0
[exportDiagrams] Wrote 0 diagram stubs.
[CLI] Quality distribution: 5 ok, 0 low_confidence, 0 handwriting
[CLI] Routed to auto_ok: 5, needs_review: 0
[CLI] Preprocessing complete.
```

### Key Points
- ✅ Feature enabled but skipped (good quality)
- ✅ Clear log explaining skip reason
- ✅ Azure OCR results sufficient
- ✅ No unnecessary API calls
- ✅ All content routed to `auto_ok/`

---

## Scenario 7: PDF with No Diagrams

### Input
- File: `text-only.pdf`
- Content: Text-only document with no diagrams

### Command
```bash
npm start text-only.pdf --captionDiagrams
```

### Expected Console Output
```
[CLI] Input: /path/to/text-only.pdf
[CLI] Output dir: /path/to/out
[normalizeInput] Detected PDF (digital): /path/to/text-only.pdf
[CLI] Normalized input: /path/to/text-only.pdf (origin: pdf_digital)
[analyzePdf] Analyzing: /path/to/text-only.pdf
[analyzePdf] Pages: 10, tables: 1
[exportNarrative] Blocks: 45
[exportNarrative] Wrote 8 markdown chunks.
[CLI] Routed narrative chunks: 8 (auto_ok + needs_review)
[exportTables] Azure tables: 1, logical tables: 1
[exportTables] Logical tables quality: ok=1, needs_review=0
[CLI] Routed table summaries: 1 (auto_ok + needs_review)
[exportDiagrams] Diagram captioning enabled
[exportDiagrams] Wrote 0 diagram stubs.
[exportDiagrams] Vision captioning: 0/0 diagrams captioned
[CLI] Routed diagram stubs: 0 (auto_ok + needs_review)
[CLI] Quality distribution: 9 ok, 0 low_confidence, 0 handwriting
[CLI] Routed to auto_ok: 9, needs_review: 0
[CLI] Preprocessing complete.
```

### Key Points
- ✅ Feature enabled but no diagrams to caption
- ✅ Clear summary: 0/0 diagrams captioned
- ✅ No wasted API calls
- ✅ Pipeline continues normally

---

## Testing Checklist

### Setup
- [ ] Azure Document Intelligence credentials configured
- [ ] OpenAI API key configured (for vision features)
- [ ] Dependencies installed (`npm install`)
- [ ] Project built (`npm run build`)

### Test Cases

**Handwriting Transcription:**
- [ ] Process handwritten note with `--handwritingVision`
- [ ] Verify clean transcription in output
- [ ] Check `sourceImagePath` in manifest
- [ ] Confirm routed to `needs_review/`
- [ ] Test with vision disabled (default behavior)
- [ ] Test with missing API key (graceful fallback)

**Diagram Captioning:**
- [ ] Process document with diagrams using `--captionDiagrams`
- [ ] Verify technical caption in diagram JSON
- [ ] Check caption includes dimensions/constraints
- [ ] Confirm routed to appropriate quality bucket
- [ ] Test with no diagrams (0/0 captioned)
- [ ] Test with missing API key (graceful fallback)

**Combined Features:**
- [ ] Process image with both flags enabled
- [ ] Verify both transcription and captioning work
- [ ] Check manifest has all Phase D fields
- [ ] Confirm proper routing

**Quality Filtering:**
- [ ] Process high-quality image with vision enabled
- [ ] Verify vision skipped with clear log
- [ ] Confirm Azure OCR used directly

**Environment Variables:**
- [ ] Test `ENABLE_HANDWRITING_VISION=true`
- [ ] Test `ENABLE_DIAGRAM_CAPTIONING=true`
- [ ] Verify CLI flags override env vars

---

## Common Issues

### Issue: Vision features not working
**Check:**
- Is `OPENAI_API_KEY` set correctly?
- Are feature flags enabled (`--handwritingVision` or `--captionDiagrams`)?
- Check startup logs for API key warnings

### Issue: No vision transcription applied
**Check:**
- Is input an image? (Only works with `origin: "image_normalized"`)
- Is quality "handwriting" or "low_confidence"?
- Check logs for skip reasons

### Issue: No diagram captions generated
**Check:**
- Do diagrams have valid `imagePath`?
- Is `--captionDiagrams` flag set?
- Check logs for captioning attempts and errors

### Issue: Vision API errors
**Check:**
- Is API key valid and has quota?
- Check error messages in logs
- Verify image file exists and is readable
- Test with smaller/simpler images first

---

## Performance Notes

### API Costs
- **Handwriting transcription:** 1 API call per image-based input
- **Diagram captioning:** 1 API call per diagram
- **Model:** gpt-4o-mini (default) - cost-effective for most use cases
- **Configurable:** Set `VISION_MODEL` to use different models

### Processing Time
- **Without vision:** Fast (Azure OCR only)
- **With handwriting vision:** +2-5 seconds per image
- **With diagram captioning:** +2-5 seconds per diagram
- **Network dependent:** Varies based on image size and API latency

### Optimization Tips
- Disable vision features when not needed
- Process batches separately (handwriting vs diagrams)
- Use faster model for simple cases (`gpt-4o-mini`)
- Consider caching results for repeated processing
