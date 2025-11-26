import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  detectDiagramRegionsInImage,
  VisionDiagramRegion,
} from "./visionClient";

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
      "pdfjs-dist/legacy/build/pdf.js"
    ).catch((err) => {
      throw new Error(
        `[visionDiagramSegmentation] Failed to load "pdfjs-dist/legacy/build/pdf.js". ` +
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
 * Run the vision model on a single page to detect diagram regions.
 */
export async function detectDiagramRegionsWithVision(
  options: VisionSegmentationOptions
): Promise<VisionSegmentationResult> {
  const { pdfPath, pageNumber, outDir, debug } = options;

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
  pdfPath: string,
  pages: number[],
  outDir: string,
  debug?: boolean
): Promise<VisionSegmentationResult[]> {
  const results: VisionSegmentationResult[] = [];

  for (const pageNumber of pages) {
    const result = await detectDiagramRegionsWithVision({
      pdfPath,
      pageNumber,
      outDir,
      debug,
    });

    results.push(result);

    // Small delay to avoid hammering the vision API
    if (pages.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}
