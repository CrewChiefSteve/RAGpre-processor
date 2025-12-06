/**
 * Phase D: Diagram Segmenter
 *
 * Detects diagram regions on rendered page PNGs, crops them to individual images,
 * and stores Diagram records in Prisma with bounding boxes and metadata.
 */

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { trace } from "../../debugTrace";
import {
  detectDiagramRegionsInImage,
  VisionDiagramRegion,
} from "../../visionClient";

export interface DiagramRegion {
  /** Page number (1-indexed) */
  page: number;
  /** Bounding box in normalized coordinates [0-1] */
  bbox: { x: number; y: number; width: number; height: number };
  /** Optional label from Vision model */
  label?: string;
  /** Optional confidence score */
  confidence?: number;
}

export interface SegmentDiagramsOptions {
  /** Rulebook ID for associating diagrams */
  rulebookId: string;
  /** Rendered page images to process */
  pageImages: { page: number; imagePath: string; imageKey: string }[];
  /** Base output directory */
  outDir: string;
  /** Prisma client for database operations */
  prisma: PrismaClient;
  /** Optional: Public URL base for generating publicUrl fields */
  publicUrlBase?: string;
}

export interface SegmentDiagramsResult {
  /** Number of diagrams created */
  createdCount: number;
  /** Array of created diagram IDs */
  diagramIds: string[];
}

/**
 * Ensure directory exists
 */
async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

/**
 * Detect diagram regions on a single page using Vision.
 *
 * @param pageImagePath Path to the rendered page PNG
 * @param pageNumber Page number (1-indexed)
 * @returns Array of detected diagram regions
 */
async function detectDiagramRegionsForPage(
  pageImagePath: string,
  pageNumber: number
): Promise<DiagramRegion[]> {
  console.log(`[diagramSegmenter] Detecting diagram regions on page ${pageNumber}...`);
  trace("detectDiagramRegionsForPage called", { pageImagePath, pageNumber });

  // Check if Vision is configured
  if (!process.env.OPENAI_API_KEY) {
    console.log(`[diagramSegmenter] No OPENAI_API_KEY configured, skipping Vision detection`);
    trace("Vision not configured");
    return [];
  }

  try {
    // Call Vision client to detect diagrams
    const segmentationResult = await detectDiagramRegionsInImage({
      imagePath: pageImagePath,
      debug: false,
    });

    if (!segmentationResult || !segmentationResult.regions?.length) {
      console.log(`[diagramSegmenter] No diagrams detected on page ${pageNumber}`);
      return [];
    }

    // Get page image dimensions for normalization
    const metadata = await sharp(pageImagePath).metadata();
    const pageWidth = metadata.width ?? 1;
    const pageHeight = metadata.height ?? 1;

    // Convert Vision regions to normalized coordinates
    const regions: DiagramRegion[] = segmentationResult.regions.map((region) => {
      // Vision client should return pixel coordinates
      // We need to normalize them to [0-1] range for storage
      const xNorm = Math.max(0, Math.min(1, region.x / pageWidth));
      const yNorm = Math.max(0, Math.min(1, region.y / pageHeight));
      const wNorm = Math.max(0, Math.min(1, region.width / pageWidth));
      const hNorm = Math.max(0, Math.min(1, region.height / pageHeight));

      return {
        page: pageNumber,
        bbox: {
          x: xNorm,
          y: yNorm,
          width: wNorm,
          height: hNorm,
        },
        label: region.label,
        confidence: region.confidence,
      };
    });

    console.log(`[diagramSegmenter] Page ${pageNumber}: detected ${regions.length} diagram(s)`);
    trace("diagram regions detected", { pageNumber, count: regions.length });

    return regions;
  } catch (err: any) {
    console.error(`[diagramSegmenter] Failed to detect diagrams on page ${pageNumber}:`, err.message);
    trace("diagram detection error", { pageNumber, error: String(err) });
    return [];
  }
}

/**
 * Crop a diagram region from a page image and save it to disk.
 *
 * @param pageImagePath Source page PNG
 * @param bbox Normalized bounding box [0-1]
 * @param outputPath Where to save the cropped diagram
 * @returns Path to the cropped image, or null if failed
 */
async function cropDiagramRegion(
  pageImagePath: string,
  bbox: { x: number; y: number; width: number; height: number },
  outputPath: string
): Promise<string | null> {
  try {
    // Ensure output directory exists
    await ensureDir(path.dirname(outputPath));

    // Get page dimensions
    const metadata = await sharp(pageImagePath).metadata();
    const pageWidth = metadata.width ?? 1;
    const pageHeight = metadata.height ?? 1;

    // Convert normalized coords to pixels
    const left = Math.max(0, Math.round(bbox.x * pageWidth));
    const top = Math.max(0, Math.round(bbox.y * pageHeight));
    const width = Math.max(1, Math.round(bbox.width * pageWidth));
    const height = Math.max(1, Math.round(bbox.height * pageHeight));

    // Crop and save
    await sharp(pageImagePath)
      .extract({ left, top, width, height })
      .toFile(outputPath);

    trace("diagram cropped", { outputPath, bbox: { left, top, width, height } });
    return outputPath;
  } catch (err: any) {
    console.error(`[diagramSegmenter] Failed to crop diagram:`, err.message);
    trace("diagram crop error", { error: String(err) });
    return null;
  }
}

/**
 * Segment diagrams from rendered page images and store them in Prisma.
 *
 * This is the main entry point for Phase D diagram segmentation.
 *
 * For each page:
 * 1. Detect diagram regions using Vision
 * 2. Crop each diagram to a separate PNG file
 * 3. Create Diagram records in Prisma with metadata
 *
 * @param options Segmentation configuration
 * @returns Result with counts and IDs
 */
export async function segmentAndStoreDiagrams(
  options: SegmentDiagramsOptions
): Promise<SegmentDiagramsResult> {
  const { rulebookId, pageImages, outDir, prisma, publicUrlBase } = options;

  console.log(`[diagramSegmenter] Processing ${pageImages.length} pages for diagrams...`);
  trace("segmentAndStoreDiagrams called", {
    rulebookId,
    pageCount: pageImages.length,
  });

  const diagramIds: string[] = [];
  const diagramsDir = path.join(outDir, "rulebooks", rulebookId, "diagrams");
  await ensureDir(diagramsDir);

  for (const pageInfo of pageImages) {
    const { page, imagePath } = pageInfo;

    // Skip if page image doesn't exist
    if (!fs.existsSync(imagePath)) {
      console.warn(`[diagramSegmenter] Page ${page} image not found: ${imagePath}`);
      continue;
    }

    // Detect diagram regions on this page
    const regions = await detectDiagramRegionsForPage(imagePath, page);

    if (regions.length === 0) {
      continue; // No diagrams on this page
    }

    // Process each detected diagram
    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      const diagramIndex = i + 1;

      // Generate paths
      const diagramFilename = `page-${page}-d${diagramIndex}.png`;
      const diagramPath = path.join(diagramsDir, diagramFilename);
      const imageKey = `rulebooks/${rulebookId}/diagrams/${diagramFilename}`;
      const publicUrl = publicUrlBase ? `${publicUrlBase}/${imageKey}` : null;

      // Crop the diagram
      const croppedPath = await cropDiagramRegion(imagePath, region.bbox, diagramPath);

      if (!croppedPath) {
        console.warn(`[diagramSegmenter] Failed to crop diagram on page ${page}, index ${diagramIndex}`);
        continue;
      }

      // Store in Prisma
      try {
        const diagram = await prisma.diagram.create({
          data: {
            rulebookId,
            page,
            boundingBox: JSON.stringify(region.bbox),
            imageKey,
            publicUrl,
            // caption, explanation, tags, refersToRuleCode will be filled by diagramExplainer
          },
        });

        diagramIds.push(diagram.id);
        console.log(`[diagramSegmenter] Created diagram ${diagram.id} for page ${page}, key: ${imageKey}`);
        trace("diagram created in DB", {
          diagramId: diagram.id,
          page,
          imageKey,
        });
      } catch (err: any) {
        console.error(`[diagramSegmenter] Failed to create diagram record:`, err.message);
        trace("diagram DB insert error", { error: String(err) });
      }

      // Small delay to avoid overwhelming the Vision API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`[diagramSegmenter] Created ${diagramIds.length} diagram(s)`);
  trace("segmentAndStoreDiagrams complete", { createdCount: diagramIds.length });

  return {
    createdCount: diagramIds.length,
    diagramIds,
  };
}
