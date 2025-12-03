import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import sharp from "sharp";
import {
  detectDiagramRegionsInImage,
  VisionDiagramRegion,
} from "./visionClient";

/**
 * Helper: Pad page number to 3 digits
 */
function padPageNumber(pageNumber: number): string {
  return String(pageNumber).padStart(3, "0");
}

/**
 * Helper: Ensure directory exists
 */
async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

/**
 * Lazily load Node-only PDF rendering dependencies.
 *
 * We use dynamic import so this file continues to work in both:
 * - CLI (ts-node/esm) where `require` is not available
 * - Next.js / Node environments where these modules exist only on the server
 *
 * If either dependency is missing, we throw a descriptive error explaining
 * how to install them.
 */

let _canvasModulePromise: Promise<any> | null = null;
let _pdfjsModulePromise: Promise<any> | null = null;

async function loadCanvasModule() {
  if (!_canvasModulePromise) {
    _canvasModulePromise = import("canvas").catch((err) => {
      throw new Error(
        `[visionDiagramSegmentation] Failed to load "canvas". ` +
          `Make sure it is installed in the pdf-preprocessor package (e.g. "pnpm add canvas") ` +
          `and that native bindings compiled successfully. Inner error: ${
            (err as any)?.message || String(err)
          }`
      );
    });
  }
  return _canvasModulePromise;
}

async function loadPdfJsModule() {
  if (!_pdfjsModulePromise) {
    _pdfjsModulePromise = import(
      "pdfjs-dist/build/pdf.mjs"
    ).catch((err) => {
      throw new Error(
        `[visionDiagramSegmentation] Failed to load "pdfjs-dist/build/pdf.mjs". ` +
          `Make sure "pdfjs-dist" is installed (e.g. "pnpm add pdfjs-dist"). ` +
          `Inner error: ${(err as any)?.message || String(err)}`
      );
    });
  }
  return _pdfjsModulePromise;
}

/**
 * Render a single PDF page to a PNG file for vision segmentation.
 *
 * @param pdfPath Absolute path to the input PDF.
 * @param pageNumber 1-based page number to render.
 * @param pngPath Absolute path where the rendered PNG should be written.
 */
async function renderPdfPageToPng(
  pdfPath: string,
  pageNumber: number,
  pngPath: string
): Promise<string> {
  // Ensure directory exists
  const dir = path.dirname(pngPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Avoid work if the PNG already exists
  if (fs.existsSync(pngPath)) {
    return pngPath;
  }

  console.log(
    `[visionDiagramSegmentation] Rendering page ${pageNumber} of ${pdfPath} to PNG at ${pngPath}`
  );

  // Load dependencies lazily
  const [canvasModule, pdfjsLibAny] = await Promise.all([
    loadCanvasModule(),
    loadPdfJsModule(),
  ]);

  const canvasNs: any =
    canvasModule && (canvasModule as any).createCanvas
      ? canvasModule
      : (canvasModule as any).default || canvasModule;
  const { createCanvas } = canvasNs;

  const pdfjsLib: any =
    pdfjsLibAny && typeof (pdfjsLibAny as any).getDocument === "function"
      ? pdfjsLibAny
      : (pdfjsLibAny as any).default || pdfjsLibAny;

  // Read PDF data and render the requested page
  const pdfData = fs.readFileSync(pdfPath);
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(pageNumber);

  const viewport = page.getViewport({ scale: 2.0 }); // 2x for better quality
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");

  // pdfjs types are loose, cast to any to avoid type issues with canvasContext
  await page.render({ canvasContext: context as any, viewport }).promise;

  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(pngPath, buffer);

  console.log(
    `[visionDiagramSegmentation] Wrote rendered page PNG: ${pngPath} (${buffer.length} bytes)`
  );

  return pngPath;
}

/**
 * Options for running vision-based diagram segmentation on a single page.
 */
export interface VisionSegmentationOptions {
  pdfPath: string;
  pageNumber: number;
  /**
   * Optional path to a pre-rendered page image.
   * If provided, we skip PDF rendering and use this directly.
   */
  pageImagePath?: string;
  /**
   * Base output directory for temp images / crops.
   */
  outDir: string;
  debug?: boolean;
  /**
   * Vision debug options for saving debug artifacts
   */
  visionDebugOptions?: VisionDebugOptions;
}

/**
 * Result for a single detected diagram region with normalized + pixel coords.
 */
export interface DiagramRegionResult {
  id: string;
  page: number;
  quality: "ok" | "needs_review";
  /**
   * Optional label from the vision model
   */
  label?: string;
  /**
   * Bounding box in normalized coordinates [0..1]
   */
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * Bounding box in absolute pixel coordinates on the rendered page image.
   */
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
  /**
   * Path to the cropped diagram image.
   */
  imagePath: string;
  /**
   * Raw region details from the vision model.
   */
  rawRegion: VisionDiagramRegion;
  /**
   * Raw JSON (if the vision client provides it).
   */
  rawJson?: any;
}

export interface VisionDiagramRegionWithId extends VisionDiagramRegion {
  id: string;
  page: number;
  rawJson?: any;
}

export interface VisionSegmentationResult {
  page: number;
  imagePath: string;
  regions: DiagramRegionResult[];
}

/**
 * Options for vision debug mode
 * Controls whether and where to save debug artifacts during vision segmentation
 */
export interface VisionDebugOptions {
  /**
   * Enable debug artifact generation
   */
  enabled: boolean;

  /**
   * Root output directory for debug artifacts
   * Debug files will be written to:
   * - {outputDir}/pages/*.png (rendered pages and overlays)
   * - {outputDir}/segments/*.json (segmentation results)
   */
  outputDir: string;

  /**
   * Additional debug logging (optional, reuses existing debug flag behavior)
   */
  debug?: boolean;
}

/**
 * Options for multi-page diagram detection
 */
export interface DetectDiagramRegionsMultiPageOptions {
  pdfPath: string;
  pages: number[];
  outDir: string;
  debug?: boolean;
  visionDebugOptions?: VisionDebugOptions;
}

/**
 * Debug segment file structure
 */
interface VisionDebugSegmentFile {
  page: number;
  imagePath: string;
  regions: DiagramRegionResult[];
  rawJson?: any;
  metadata: {
    timestamp: string;
    model: string;
    imageWidth: number;
    imageHeight: number;
  };
}

/**
 * Create an overlay image with diagram boxes drawn on the page
 */
async function createOverlayImage(
  sourceImagePath: string,
  regions: DiagramRegionResult[],
  outputPath: string,
  imageWidth: number,
  imageHeight: number
): Promise<void> {
  // Load canvas module dynamically (same pattern as PDF rendering)
  const canvasModule = await loadCanvasModule();
  const canvasNs: any =
    canvasModule && (canvasModule as any).createCanvas
      ? canvasModule
      : (canvasModule as any).default || canvasModule;
  const { createCanvas, loadImage } = canvasNs;

  // Load the source image
  const image = await loadImage(sourceImagePath);
  const canvas = createCanvas(imageWidth, imageHeight);
  const ctx = canvas.getContext("2d");

  // Draw the base image
  ctx.drawImage(image, 0, 0, imageWidth, imageHeight);

  // Draw boxes and labels for each region
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];

    // Draw green rectangle
    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 4;
    ctx.strokeRect(region.xPx, region.yPx, region.widthPx, region.heightPx);

    // Draw index label
    ctx.font = "24px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    const labelText = String(i + 1);
    const labelX = region.xPx + 10;
    const labelY = region.yPx + 30;
    ctx.strokeText(labelText, labelX, labelY);
    ctx.fillText(labelText, labelX, labelY);
  }

  // Save the overlay image
  const buffer = canvas.toBuffer("image/png");
  await fsp.writeFile(outputPath, buffer);
}

/**
 * Run the vision model on a single page to detect diagram regions.
 */
export async function detectDiagramRegionsWithVision(
  options: VisionSegmentationOptions
): Promise<VisionSegmentationResult> {
  const { pdfPath, pageNumber, outDir, debug, visionDebugOptions } = options;

  console.log('[visionDiagramSegmentation] === VISION SEGMENTATION CALLED ===');
  console.log('[visionDiagramSegmentation] Page:', pageNumber, 'PDF:', pdfPath);

  // Either use provided page image or render one from the PDF.
  let pageImagePath = options.pageImagePath;
  if (!pageImagePath) {
    const tempPagePath = path.join(
      outDir,
      "temp",
      "vision-pages",
      `page-${pageNumber}.png`
    );
    pageImagePath = await renderPdfPageToPng(pdfPath, pageNumber, tempPagePath);
  }

  console.log(
    `[visionDiagramSegmentation] Detecting diagram regions on page ${pageNumber} using image: ${pageImagePath}`
  );

  const segmentationResult = await detectDiagramRegionsInImage({
    imagePath: pageImagePath,
    debug,
  });

  if (!segmentationResult || !segmentationResult.regions?.length) {
    console.log(
      `[visionDiagramSegmentation] No diagram regions detected on page ${pageNumber}`
    );
    return {
      page: pageNumber,
      imagePath: pageImagePath,
      regions: [],
    };
  }

  // We need the page image dimensions to convert normalized coords to pixels
  const pageImage = sharp(pageImagePath);
  const metadata = await pageImage.metadata();
  const pageWidth = metadata.width ?? 0;
  const pageHeight = metadata.height ?? 0;

  if (!pageWidth || !pageHeight) {
    console.warn(
      `[visionDiagramSegmentation] Could not read image dimensions for ${pageImagePath}`
    );
  }

  const results: DiagramRegionResult[] = [];

  for (let i = 0; i < segmentationResult.regions.length; i++) {
    const region = segmentationResult.regions[i];

    // Vision client should give us normalized [0..1] coords.
    const xNorm = Math.max(0, Math.min(1, region.x));
    const yNorm = Math.max(0, Math.min(1, region.y));
    const wNorm = Math.max(0, Math.min(1, region.width));
    const hNorm = Math.max(0, Math.min(1, region.height));

    const xPx = Math.round(xNorm * pageWidth);
    const yPx = Math.round(yNorm * pageHeight);
    const widthPx = Math.round(wNorm * pageWidth);
    const heightPx = Math.round(hNorm * pageHeight);

    const id = `vision_segment_p${pageNumber}_${i + 1}`;
    const cropDir = path.join(outDir, "diagrams", "vision-crops");
    const cropPath = path.join(cropDir, `${id}.png`);

    if (!fs.existsSync(cropDir)) {
      fs.mkdirSync(cropDir, { recursive: true });
    }

    // Crop the diagram region from the page image
    await sharp(pageImagePath)
      .extract({
        left: Math.max(0, xPx),
        top: Math.max(0, yPx),
        width: Math.max(1, widthPx),
        height: Math.max(1, heightPx),
      })
      .toFile(cropPath);

    const quality: "ok" | "needs_review" =
      region.confidence && region.confidence < 0.6 ? "needs_review" : "ok";

    results.push({
      id,
      page: pageNumber,
      quality,
      label: region.label,
      x: xNorm,
      y: yNorm,
      width: wNorm,
      height: hNorm,
      xPx,
      yPx,
      widthPx,
      heightPx,
      imagePath: cropPath,
      rawRegion: region,
      rawJson: segmentationResult.rawJson,
    });
  }

  console.log(
    `[visionDiagramSegmentation] Page ${pageNumber}: detected ${results.length} diagram region(s)`
  );

  // ===== DEBUG ARTIFACT GENERATION =====
  if (visionDebugOptions?.enabled) {
    try {
      const debugRoot = visionDebugOptions.outputDir;
      const pagesDir = path.join(debugRoot, "pages");
      const segmentsDir = path.join(debugRoot, "segments");

      // Ensure debug directories exist
      await ensureDir(pagesDir);
      await ensureDir(segmentsDir);

      const padded = padPageNumber(pageNumber);
      const pagePngPath = path.join(pagesDir, `page-${padded}.png`);
      const overlayPngPath = path.join(pagesDir, `page-${padded}_overlay.png`);
      const segmentsJsonPath = path.join(segmentsDir, `page-${padded}_segments.json`);

      // 1. Save raw page PNG (copy from rendered page)
      await fsp.copyFile(pageImagePath, pagePngPath);
      if (visionDebugOptions.debug) {
        console.log(`[visionDebug] Saved raw page: ${pagePngPath}`);
      }

      // 2. Create overlay PNG with diagram boxes
      await createOverlayImage(pageImagePath, results, overlayPngPath, pageWidth, pageHeight);
      if (visionDebugOptions.debug) {
        console.log(`[visionDebug] Saved overlay: ${overlayPngPath}`);
      }

      // 3. Write segments JSON
      const debugJson: VisionDebugSegmentFile = {
        page: pageNumber,
        imagePath: `pages/page-${padded}.png`,
        regions: results,
        rawJson: segmentationResult.rawJson,
        metadata: {
          timestamp: new Date().toISOString(),
          model: process.env.VISION_MODEL || "gpt-4o-mini",
          imageWidth: pageWidth,
          imageHeight: pageHeight,
        },
      };

      await fsp.writeFile(
        segmentsJsonPath,
        JSON.stringify(debugJson, null, 2),
        "utf8"
      );
      if (visionDebugOptions.debug) {
        console.log(`[visionDebug] Saved segments JSON: ${segmentsJsonPath}`);
      }
    } catch (error) {
      console.error(`[visionDebug] Failed to save debug artifacts for page ${pageNumber}:`, error);
    }
  }

  return {
    page: pageNumber,
    imagePath: pageImagePath,
    regions: results,
  };
}

/**
 * Run vision-based diagram detection across multiple pages.
 *
 * This is what the hybrid diagram detection pipeline calls when it needs
 * to backfill diagrams on pages Azure didn't flag as figures/images.
 */
export async function detectDiagramRegionsMultiPage(
  options: DetectDiagramRegionsMultiPageOptions
): Promise<VisionSegmentationResult[]> {
  const { pdfPath, pages, outDir, debug, visionDebugOptions } = options;
  const results: VisionSegmentationResult[] = [];

  for (const pageNumber of pages) {
    const result = await detectDiagramRegionsWithVision({
      pdfPath,
      pageNumber,
      outDir,
      debug,
      visionDebugOptions,
    });

    results.push(result);

    // Small delay to avoid hammering the vision API
    if (pages.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}
