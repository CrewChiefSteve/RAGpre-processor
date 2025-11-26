import path from "path";
import type { DiagramAsset } from "./types";
import { captionDiagramImage } from "./visionClient";

/**
 * Generate AI summaries for diagram images using vision models
 *
 * This module uses OpenAI Vision API to generate descriptive summaries
 * of technical diagrams, focusing on dimensions, limits, and constraints.
 *
 * Requires:
 * - OPENAI_API_KEY environment variable
 * - diagram.imagePath must be set (populated by extractDiagramImages)
 *
 * If API key is not configured, this gracefully degrades and returns
 * diagrams unchanged.
 */

/**
 * Generate summaries for all diagrams with images
 * Returns updated DiagramAsset array with description field filled
 */
export async function generateDiagramSummaries(
  diagrams: DiagramAsset[],
  outDir: string,
  options?: { enableCaptioning?: boolean }
): Promise<DiagramAsset[]> {
  const enableCaptioning =
    options?.enableCaptioning ||
    process.env.ENABLE_DIAGRAM_CAPTIONING === "true";

  if (!enableCaptioning) {
    console.log("[diagramSummaryPipeline] Diagram captioning disabled, skipping");
    return diagrams;
  }

  if (diagrams.length === 0) {
    console.log("[diagramSummaryPipeline] No diagrams to caption");
    return diagrams;
  }

  // Filter diagrams that have images
  const diagramsWithImages = diagrams.filter((d) => d.imagePath);

  if (diagramsWithImages.length === 0) {
    console.log("[diagramSummaryPipeline] No diagrams have image paths, skipping captioning");
    return diagrams;
  }

  console.log(
    `[diagramSummaryPipeline] Generating summaries for ${diagramsWithImages.length} diagram(s)`
  );

  const updated: DiagramAsset[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const diagram of diagrams) {
    if (!diagram.imagePath) {
      // Keep diagrams without images unchanged
      updated.push(diagram);
      continue;
    }

    try {
      // Build absolute path to image
      const absoluteImagePath = path.isAbsolute(diagram.imagePath)
        ? diagram.imagePath
        : path.join(outDir, diagram.imagePath);

      console.log(`[diagramSummaryPipeline] Captioning ${diagram.id}...`);

      // Call vision API with optional caption context
      const context = diagram.rawCaptionText ?? "";
      const summary = await captionDiagramImage(absoluteImagePath, context);

      if (summary) {
        updated.push({
          ...diagram,
          description: summary,
        });
        successCount++;
        console.log(
          `[diagramSummaryPipeline] Generated summary for ${diagram.id} (${summary.length} chars)`
        );
      } else {
        // API returned null (likely missing API key)
        console.warn(`[diagramSummaryPipeline] No summary generated for ${diagram.id}`);
        updated.push(diagram);
        failCount++;
      }
    } catch (err) {
      console.error(
        `[diagramSummaryPipeline] Failed to caption ${diagram.id}:`,
        err
      );
      // Keep diagram unchanged on error
      updated.push(diagram);
      failCount++;
    }
  }

  console.log(
    `[diagramSummaryPipeline] Summary generation complete: ${successCount} success, ${failCount} failed`
  );

  return updated;
}
