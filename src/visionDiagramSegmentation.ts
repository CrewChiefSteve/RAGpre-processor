import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import sharp from "sharp";

import {
  detectDiagramRegionsInImage,
  VisionDiagramRegion,
} from "./visionClient";
import { trace } from "./debugTrace";
import { renderSinglePageToPng } from "./pipeline/render/pdfRenderer";

// Re-export types from the types file (avoids loading heavy dependencies during Next.js compilation)
export type {
  VisionDebugOptions,
  VisionSegmentationOptions,
  DetectDiagramRegionsMultiPageOptions,
} from "./visionDiagramSegmentation.types";

// Import types for local use
import type {
  VisionDebugOptions,
  VisionSegmentationOptions,
  DetectDiagramRegionsMultiPageOptions,
} from "./visionDiagramSegmentation.types";

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
 * Lazily load Node-only drawing dependencies (canvas).
 *
 * We use dynamic import so this file continues to work in both:
 * - CLI (ts-node/esm)
 * - Next.js / Node server environments
 *
 * If the dependency is missing, we throw a descriptive error explaining
 * how to install it.
 */
let _canvasModulePromise: Promise<any> | null = null;

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

/**
 * Thin wrapper around the Phase D renderer.
 *
 * This is the ONLY place in the vision pipeline that touches PDF rendering.
 * It delegates completely to src/pipeline/render/pdfRenderer.ts so there is
 * no pdf.worker.mjs or pdf.js config in this file anymore.
 *
 * @param pdfPath Absolute path to the input PDF.
 * @param pageNumber 1-based page number to render.
 * @param pngPath Absolute path where the rendered PNG should be written.
 */
async function renderPdfPageToPng(
  pdfPath: string,
  pageNumber: number,
  pngPath: string
): Promise<string | null> {
  const dir = path.dirname(pngPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Avoid work if the PNG already exists
  if (fs.existsSync(pngPath)) {
    trace("renderPdfPageToPng: page PNG already exists", {
      pageNumber,
      pngPath,
    });
    return pngPath;
  }

  trace("renderPdfPageToPng (vision) delegating to pdfRenderer", {
    pdfPath,
    pageNumber,
    pngPath,
  });

  try {
    const result = await renderSinglePageToPng({
      pdfPath,
      pageNumber,
      pngPath,
      // logger is optional; pdfRenderer will use its own trace/console logger
    });

    console.log(
      `[visionDiagramSegmentation] Wrote rendered page PNG: ${result.pngPath} (${result.width}x${result.height})`
    );

    return result.pngPath;
  } catch (err: any) {
    const msg = String(err?.message || err);

    // Preserve the old "fake worker" defensive path (should not happen anymore,
    // but we keep it for compatibility with existing logging/monitoring).
    if (msg.includes("Setting up fake worker failed")) {
      console.warn(
        `[visionDiagramSegmentation] PDF.js fake worker failed. Page ${pageNumber} will be skipped. ` +
          `Vision segmentation will continue with remaining pages. Error: ${msg}`
      );
      trace("PDF.js worker error caught - graceful skip (via pdfRenderer)", {
        pageNumber,
        error: msg,
      });
      return null;
    }

    // For all other errors, rethrow so real bugs surface during development
    throw err;
  }
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
   * Bounding box in pixel coordinates
   */
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
  /**
   * Optional model confidence score
   */
  confidence?: number;
  /**
   * Filesystem path to the cropped diagram image
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

// VisionDebugOptions and DetectDiagramRegionsMultiPageOptions now imported from .types file

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
  // Load canvas module dynamically
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

  // Write overlay image
  const buffer = canvas.toBuffer("image/png");
  await ensureDir(path.dirname(outputPath));
  await fsp.writeFile(outputPath, buffer);
}

/**
 * Detect diagram regions on a single page using Vision.
 *
 * - Renders the page to PNG (via Phase D pdfRenderer) if no pageImagePath is provided
 * - Calls detectDiagramRegionsInImage(...)
 * - Converts normalized [0..1] coords into pixel coords
 * - Crops diagram regions to individual PNGs
 * - Optionally writes debug overlay + JSON if VisionDebugOptions is enabled
 */
export async function detectDiagramRegionsWithVision(
  options: VisionSegmentationOptions
): Promise<VisionSegmentationResult> {
  const { pdfPath, pageNumber, outDir, debug, visionDebugOptions } = options;

  console.log(
    "[visionDiagramSegmentation] === VISION SEGMENTATION CALLED ==="
  );
  console.log(
    "[visionDiagramSegmentation] Page:",
    pageNumber,
    "PDF:",
    pdfPath
  );

  // Either use provided page image or render one from the PDF.
  let pageImagePath = (options as any).pageImagePath as string | undefined;
  if (!pageImagePath) {
    const tempPagePath = path.join(
      outDir,
      "temp",
      "vision-pages",
      `page-${pageNumber}.png`
    );

    pageImagePath =
      (await renderPdfPageToPng(pdfPath, pageNumber, tempPagePath)) ??
      undefined;

    // If rendering failed (e.g., underlying renderer error), return empty result gracefully
    if (!pageImagePath) {
      console.warn(
        `[visionDiagramSegmentation] Page ${pageNumber} could not be rendered. Returning empty result.`
      );
      return {
        page: pageNumber,
        imagePath: "",
        regions: [],
      };
    }
  }

  trace("page rendered", {
    pageNum: pageNumber,
    imagePath: pageImagePath,
    imageExists: fs.existsSync(pageImagePath),
    imageSize: fs.existsSync(pageImagePath)
      ? fs.statSync(pageImagePath).size
      : 0,
  });

  console.log(
    `[visionDiagramSegmentation] Detecting diagram regions on page ${pageNumber} using image: ${pageImagePath}`
  );

  const segmentationResult = await detectDiagramRegionsInImage({
    imagePath: pageImagePath,
    debug,
  });

  trace("vision result for page", {
    pageNum: pageNumber,
    regionsFound: segmentationResult?.regions?.length ?? 0,
    hasRawJson: !!segmentationResult?.rawJson,
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
      `[visionDiagramSegmentation] Unable to determine image size for page ${pageNumber}. Returning empty result.`
    );
    return {
      page: pageNumber,
      imagePath: pageImagePath,
      regions: [],
    };
  }

  console.log(
    `[visionDiagramSegmentation] Page image size: ${pageWidth}x${pageHeight}`
  );

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
      (region as any).confidence && (region as any).confidence < 0.6
        ? "needs_review"
        : "ok";

    const result: DiagramRegionResult = {
      id,
      page: pageNumber,
      quality,
      label: (region as any).label,
      x: xNorm,
      y: yNorm,
      width: wNorm,
      height: hNorm,
      xPx,
      yPx,
      widthPx,
      heightPx,
      confidence: (region as any).confidence,
      imagePath: cropPath,
      rawRegion: region,
      rawJson: (segmentationResult as any).rawJson,
    };

    results.push(result);
  }

  // If debug options are provided, write debug artifacts
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
      const overlayPngPath = path.join(
        pagesDir,
        `page-${padded}_overlay.png`
      );
      const segmentsJsonPath = path.join(
        segmentsDir,
        `page-${padded}_segments.json`
      );

      // 1. Save raw page PNG (copy from rendered page)
      await fsp.copyFile(pageImagePath, pagePngPath);
      if (visionDebugOptions.debug) {
        console.log(`[visionDebug] Saved raw page: ${pagePngPath}`);
      }

      // 2. Create overlay PNG with diagram boxes
      await createOverlayImage(
        pageImagePath,
        results,
        overlayPngPath,
        pageWidth,
        pageHeight
      );
      if (visionDebugOptions.debug) {
        console.log(`[visionDebug] Saved overlay: ${overlayPngPath}`);
      }

      // 3. Write segments JSON
      const debugJson: VisionDebugSegmentFile = {
        page: pageNumber,
        imagePath: `pages/page-${padded}.png`,
        regions: results,
        rawJson: (segmentationResult as any).rawJson,
        metadata: {
          timestamp: new Date().toISOString(),
          model: process.env.VISION_MODEL ?? "gpt-4o-mini",
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
        console.log(`[visionDebug] Wrote segments JSON: ${segmentsJsonPath}`);
      }
    } catch (err: any) {
      console.warn(
        `[visionDebug] Failed to write debug artifacts for page ${pageNumber}: ${
          err?.message || String(err)
        }`
      );
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

  console.log(
    "[visionDiagramSegmentation] === MULTI-PAGE VISION SEGMENTATION ==="
  );
  console.log("[visionDiagramSegmentation] Pages:", pages.join(", "));

  const results: VisionSegmentationResult[] = [];

  for (const pageNumber of pages) {
    try {
      const result = await detectDiagramRegionsWithVision({
        pdfPath,
        pageNumber,
        outDir,
        debug,
        visionDebugOptions,
      } as VisionSegmentationOptions);

      results.push(result);

      // Small delay to avoid hammering the vision API
      if (pages.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err: any) {
      const msg = String(err?.message || err);

      // Log the error but continue with other pages
      console.warn(
        `[visionDiagramSegmentation] Failed to process page ${pageNumber}. ` +
          `Continuing with remaining pages. Error: ${msg}`
      );
      trace("vision segmentation page error", { pageNumber, error: msg });

      // Push an empty result for this page so we maintain page number correspondence
      results.push({
        page: pageNumber,
        imagePath: "",
        regions: [],
      });
    }
  }

  return results;
}
