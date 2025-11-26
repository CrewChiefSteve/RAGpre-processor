import path from "path";
import fs from "fs";
import sharp from "sharp";
import type { DiagramAsset } from "./types";
import { ensureDir } from "./utils/fsUtils";

/**
 * Extract diagram images from a document
 *
 * This module extracts diagram regions as image files from the source document.
 *
 * For image-based documents (image_normalized origin):
 * - Uses the normalized image from Phase A
 * - Crops diagram regions using bounding boxes
 *
 * For PDF documents (pdf_digital origin):
 * - Requires PDF-to-image rendering (see note below)
 * - Crops diagram regions from rendered pages
 *
 * NOTE: PDF rendering requires additional dependencies:
 * - Install: npm install canvas pdfjs-dist
 * - pdfjs-dist: Mozilla's PDF renderer
 * - canvas: Node.js canvas implementation for PDF rendering
 *
 * If these dependencies are not installed, PDF diagram extraction will be skipped
 * with a warning message.
 */

/**
 * Check if PDF rendering dependencies are available
 */
function checkPdfRenderingAvailable(): boolean {
  try {
    // Try to dynamically require - will throw if not installed
    eval("require.resolve('canvas')");
    eval("require.resolve('pdfjs-dist')");
    return true;
  } catch {
    return false;
  }
}

/**
 * Render a PDF page to PNG (requires canvas + pdfjs-dist)
 */
async function renderPdfPage(
  pdfPath: string,
  pageNumber: number,
  outputPath: string
): Promise<void> {
  // Dynamic require to avoid webpack bundling errors
  // Using eval to prevent webpack from resolving at build time
  const pdfjsLib = eval("require('pdfjs-dist')");
  const { createCanvas } = eval("require('canvas')");

  // Load PDF
  const loadingTask = pdfjsLib.getDocument(pdfPath);
  const pdf = await loadingTask.promise;

  // Get page
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for quality

  // Create canvas
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");

  // Render page
  await page.render({
    canvasContext: context as any,
    viewport: viewport,
  }).promise;

  // Save as PNG
  const buffer = canvas.toBuffer("image/png");
  await fs.promises.writeFile(outputPath, buffer);
}

/**
 * Crop a diagram region from a full page image
 * Azure bounding boxes are in normalized coordinates (0-1 scale)
 */
async function cropDiagramRegion(
  sourceImagePath: string,
  boundingBox: any, // Azure BoundingRegion polygon
  outputPath: string
): Promise<void> {
  // Azure provides polygon points, we need to find bounding rectangle
  const polygon = boundingBox.polygon;
  if (!polygon || polygon.length === 0) {
    throw new Error("No polygon data in bounding box");
  }

  // Get image dimensions to convert normalized coordinates
  const metadata = await sharp(sourceImagePath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions");
  }

  const imgWidth = metadata.width;
  const imgHeight = metadata.height;

  // Convert polygon to pixel coordinates and find bounding rectangle
  const xCoords = [];
  const yCoords = [];

  for (let i = 0; i < polygon.length; i += 2) {
    const x = polygon[i] * imgWidth;
    const y = polygon[i + 1] * imgHeight;
    xCoords.push(x);
    yCoords.push(y);
  }

  const left = Math.max(0, Math.floor(Math.min(...xCoords)));
  const top = Math.max(0, Math.floor(Math.min(...yCoords)));
  const right = Math.min(imgWidth, Math.ceil(Math.max(...xCoords)));
  const bottom = Math.min(imgHeight, Math.ceil(Math.max(...yCoords)));

  const width = right - left;
  const height = bottom - top;

  // Add small padding (5% on each side)
  const padding = Math.floor(Math.min(width, height) * 0.05);
  const paddedLeft = Math.max(0, left - padding);
  const paddedTop = Math.max(0, top - padding);
  const paddedWidth = Math.min(imgWidth - paddedLeft, width + 2 * padding);
  const paddedHeight = Math.min(imgHeight - paddedTop, height + 2 * padding);

  // Crop and save
  await sharp(sourceImagePath)
    .extract({
      left: paddedLeft,
      top: paddedTop,
      width: paddedWidth,
      height: paddedHeight,
    })
    .toFile(outputPath);
}

/**
 * Extract diagram images from document
 * Returns updated DiagramAsset array with imagePath filled
 */
export async function extractDiagramImages(
  diagrams: DiagramAsset[],
  normalizedPath: string,
  outDir: string
): Promise<DiagramAsset[]> {
  if (diagrams.length === 0) {
    console.log("[extractDiagramImages] No diagrams to extract");
    return diagrams;
  }

  console.log(`[extractDiagramImages] Extracting ${diagrams.length} diagram image(s)`);

  // Create output directory for diagram images
  const imagesDir = path.join(outDir, "diagrams", "images");
  ensureDir(imagesDir);

  const updated: DiagramAsset[] = [];
  const ext = path.extname(normalizedPath).toLowerCase();
  const isPdf = ext === ".pdf";

  // Check PDF rendering availability
  if (isPdf && !checkPdfRenderingAvailable()) {
    console.warn(
      "[extractDiagramImages] PDF rendering dependencies not installed.\n" +
      "  To enable PDF diagram extraction, run:\n" +
      "  npm install canvas pdfjs-dist\n" +
      "  Skipping diagram extraction for now."
    );
    return diagrams.map(d => ({ ...d, imagePath: "" }));
  }

  for (const diagram of diagrams) {
    try {
      const imageFilename = `${diagram.id}.png`;
      const imagePath = path.join(imagesDir, imageFilename);

      // Step 1: Get full page image
      let pageImagePath: string;

      if (isPdf) {
        // Render PDF page to temp image
        const tempPagePath = path.join(imagesDir, `temp_page_${diagram.page}.png`);

        console.log(`[extractDiagramImages] Rendering PDF page ${diagram.page} for ${diagram.id}`);
        await renderPdfPage(normalizedPath, diagram.page!, tempPagePath);

        pageImagePath = tempPagePath;
      } else {
        // Use normalized image from Phase A
        pageImagePath = normalizedPath;
      }

      // Step 2: Crop diagram region using bounding box
      console.log(`[extractDiagramImages] Extracting ${diagram.id} to ${imagePath}`);

      if (diagram.boundingBox) {
        // Crop using Azure bounding box
        await cropDiagramRegion(pageImagePath, diagram.boundingBox, imagePath);
      } else {
        // No bounding box - copy full page as fallback
        console.warn(`[extractDiagramImages] No bounding box for ${diagram.id}, using full page`);
        await sharp(pageImagePath).toFile(imagePath);
      }

      // Clean up temp file if PDF
      if (isPdf) {
        try {
          await fs.promises.unlink(pageImagePath);
        } catch (err) {
          // Ignore cleanup errors
        }
      }

      updated.push({
        ...diagram,
        imagePath: path.relative(outDir, imagePath),
      });

      console.log(`[extractDiagramImages] Successfully extracted ${diagram.id}`);
    } catch (err) {
      console.error(`[extractDiagramImages] Failed to extract ${diagram.id}:`, err);
      // Keep diagram but without image path
      updated.push(diagram);
    }
  }

  console.log(`[extractDiagramImages] Extracted ${updated.filter(d => d.imagePath).length}/${diagrams.length} diagram image(s)`);

  return updated;
}
