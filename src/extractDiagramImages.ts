import path from "path";
import fs from "fs";
import sharp from "sharp";
import type { DiagramAsset } from "./types";
import { ensureDir } from "./utils/fsUtils";
import { renderSinglePageToPng } from "./pipeline/render/pdfRenderer";

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
 * - Uses Phase D pdfRenderer to convert PDF pages to PNG
 * - Crops diagram regions from rendered pages
 */

/**
 * Crop a diagram region from a full page image
 *
 * Handles two coordinate systems:
 * 1. Azure figures: polygon in inches (from page origin)
 * 2. Vision segments: polygon in pixels (already on rendered image)
 */
async function cropDiagramRegion(
  sourceImagePath: string,
  boundingBox: any, // Azure BoundingRegion or Vision bounding box
  outputPath: string,
  azurePageDimensions?: { width: number; height: number } // Page dimensions in inches (from Azure)
): Promise<void> {
  // Azure provides polygon points, we need to find bounding rectangle
  const polygon = boundingBox.polygon;
  if (!polygon || polygon.length === 0) {
    throw new Error("No polygon data in bounding box");
  }

  // Get rendered image dimensions
  const metadata = await sharp(sourceImagePath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions");
  }

  const imgWidth = metadata.width;
  const imgHeight = metadata.height;

  // Determine coordinate system and convert polygon to pixels
  const xCoords = [];
  const yCoords = [];

  // Check if this is a Vision segment (has _visionPixels marker)
  if (boundingBox._visionPixels) {
    // Vision coordinates are already in pixels on the rendered image
    console.log(`[cropDiagramRegion] Using Vision pixel coordinates`);
    const { x, y, width, height } = boundingBox._visionPixels;
    xCoords.push(x, x + width);
    yCoords.push(y, y + height);
  } else if (azurePageDimensions) {
    // Azure coordinates are in inches - convert to pixels
    console.log(`[cropDiagramRegion] Converting Azure inches to pixels (page: ${azurePageDimensions.width}x${azurePageDimensions.height} in, image: ${imgWidth}x${imgHeight} px)`);
    const scaleX = imgWidth / azurePageDimensions.width;
    const scaleY = imgHeight / azurePageDimensions.height;

    for (let i = 0; i < polygon.length; i += 2) {
      const xInches = polygon[i];
      const yInches = polygon[i + 1];
      xCoords.push(xInches * scaleX);
      yCoords.push(yInches * scaleY);
    }
  } else {
    // Fallback: assume normalized coordinates (0-1 scale) - legacy behavior
    console.warn(`[cropDiagramRegion] No Azure page dimensions provided, assuming normalized coordinates`);
    for (let i = 0; i < polygon.length; i += 2) {
      xCoords.push(polygon[i] * imgWidth);
      yCoords.push(polygon[i + 1] * imgHeight);
    }
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
 *
 * @param diagrams - Array of diagram assets with bounding boxes
 * @param normalizedPath - Path to normalized document (PDF or image)
 * @param outDir - Output directory for extracted images
 * @param azureResult - Optional Azure analysis result for page dimensions
 */
export async function extractDiagramImages(
  diagrams: DiagramAsset[],
  normalizedPath: string,
  outDir: string,
  azureResult?: any // AnalyzeResult from Azure Document Intelligence
): Promise<DiagramAsset[]> {
  if (diagrams.length === 0) {
    console.log("[extractDiagramImages] No diagrams to extract");
    return diagrams;
  }

  console.log(`[extractDiagramImages] Extracting ${diagrams.length} diagram image(s)`);

  // Create output directory for diagram images
  const imagesDir = path.join(outDir, "diagrams", "images");
  ensureDir(imagesDir);

  // Build a map of page numbers to dimensions (in inches) from Azure result
  const pageDimensionsMap = new Map<number, { width: number; height: number }>();
  if (azureResult?.pages) {
    for (const page of azureResult.pages) {
      const pageNum = page.pageNumber ?? 0;
      if (page.width && page.height) {
        pageDimensionsMap.set(pageNum, {
          width: page.width,
          height: page.height,
        });
      }
    }
    console.log(`[extractDiagramImages] Loaded dimensions for ${pageDimensionsMap.size} page(s) from Azure`);
  }

  const updated: DiagramAsset[] = [];
  const ext = path.extname(normalizedPath).toLowerCase();
  const isPdf = ext === ".pdf";

  if (isPdf) {
    // Group diagrams by page number for efficient rendering
    const diagramsByPage = new Map<number, DiagramAsset[]>();
    for (const diagram of diagrams) {
      if (!diagram.page) {
        console.warn(`[extractDiagramImages] Diagram ${diagram.id} has no page number, skipping`);
        updated.push(diagram);
        continue;
      }
      if (!diagramsByPage.has(diagram.page)) {
        diagramsByPage.set(diagram.page, []);
      }
      diagramsByPage.get(diagram.page)!.push(diagram);
    }

    console.log(`[extractDiagramImages] Processing ${diagramsByPage.size} unique page(s) for ${diagrams.length} diagram(s)`);

    // Process each page: render once, crop multiple diagrams
    for (const [pageNum, pageDiagrams] of diagramsByPage) {
      const tempPagePath = path.join(imagesDir, `temp_page_${pageNum}.png`);

      try {
        // Render this page ONCE
        console.log(`[extractDiagramImages] Rendering PDF page ${pageNum} (${pageDiagrams.length} diagram(s))`);
        await renderSinglePageToPng({
          pdfPath: normalizedPath,
          pageNumber: pageNum,
          pngPath: tempPagePath,
          scale: 2.0,
        });

        // Crop all diagrams from this rendered page
        for (const diagram of pageDiagrams) {
          try {
            const imageFilename = `${diagram.id}.png`;
            const imagePath = path.join(imagesDir, imageFilename);

            console.log(`[extractDiagramImages] Extracting ${diagram.id} to ${imagePath}`);

            if (diagram.boundingBox) {
              // Get page dimensions for this diagram
              const pageDims = pageDimensionsMap.get(pageNum);

              // Crop using bounding box with appropriate coordinate system
              await cropDiagramRegion(
                tempPagePath,
                diagram.boundingBox,
                imagePath,
                pageDims
              );
            } else {
              // No bounding box - copy full page as fallback
              console.warn(`[extractDiagramImages] No bounding box for ${diagram.id}, using full page`);
              await sharp(tempPagePath).toFile(imagePath);
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
      } catch (err) {
        console.error(`[extractDiagramImages] Failed to render page ${pageNum}:`, err);
        // Keep diagrams but without image paths
        for (const diagram of pageDiagrams) {
          updated.push(diagram);
        }
      } finally {
        // Clean up temp page file
        try {
          await fs.promises.unlink(tempPagePath);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    }
  } else {
    // Image-based document: process diagrams directly (no grouping needed)
    for (const diagram of diagrams) {
      try {
        const imageFilename = `${diagram.id}.png`;
        const imagePath = path.join(imagesDir, imageFilename);

        console.log(`[extractDiagramImages] Extracting ${diagram.id} from image`);

        if (diagram.boundingBox) {
          // Get page dimensions for this diagram (if available)
          const pageDims = diagram.page ? pageDimensionsMap.get(diagram.page) : undefined;

          // Crop using bounding box
          await cropDiagramRegion(
            normalizedPath,
            diagram.boundingBox,
            imagePath,
            pageDims
          );
        } else {
          // No bounding box - copy full image as fallback
          console.warn(`[extractDiagramImages] No bounding box for ${diagram.id}, using full image`);
          await sharp(normalizedPath).toFile(imagePath);
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
  }

  console.log(`[extractDiagramImages] Extracted ${updated.filter(d => d.imagePath).length}/${diagrams.length} diagram image(s)`);

  return updated;
}
