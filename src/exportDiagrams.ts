import path from "path";
import { ensureDir, writeTextFile } from "./utils/fsUtils";
import type { DiagramAsset } from "./types";

/**
 * Phase C: Export diagram metadata as JSON files
 *
 * Diagrams should already have:
 * - imagePath filled by extractDiagramImages()
 * - description filled by generateDiagramSummaries() (if captioning enabled)
 *
 * This function routes and exports diagram JSON files to appropriate quality buckets.
 */
export async function exportDiagrams(
  diagrams: DiagramAsset[],
  outDir: string,
  options?: { captionDiagrams?: boolean }
): Promise<DiagramAsset[]> {
  const dirAuto = path.join(outDir, "auto_ok", "diagrams");
  const dirReview = path.join(outDir, "needs_review", "diagrams");
  ensureDir(dirAuto);
  ensureDir(dirReview);

  if (diagrams.length === 0) {
    console.log(`[exportDiagrams] No diagrams to export`);
    return [];
  }

  const updated: DiagramAsset[] = [];
  const diagramsWithImages = diagrams.filter(d => d.imagePath).length;
  const diagramsWithSummaries = diagrams.filter(d => d.description).length;

  console.log(
    `[exportDiagrams] Exporting ${diagrams.length} diagram(s) ` +
    `(${diagramsWithImages} with images, ${diagramsWithSummaries} with summaries)`
  );

  for (const diagram of diagrams) {
    // Route based on quality
    const qualityBucket =
      diagram.quality === "ok" ? "auto_ok" : "needs_review";

    const baseDir =
      qualityBucket === "auto_ok" ? dirAuto : dirReview;

    const jsonPath = path.join(baseDir, `${diagram.id}.json`);

    // Export complete diagram metadata (all fields from DiagramAsset)
    const exportData = {
      id: diagram.id,
      sectionPath: diagram.sectionPath,
      title: diagram.title,
      imagePath: diagram.imagePath,
      description: diagram.description,
      sourcePdf: diagram.sourcePdf,
      page: diagram.page,
      origin: diagram.origin,
      quality: diagram.quality,
      sourceImagePath: diagram.sourceImagePath,
      rawCaptionText: diagram.rawCaptionText,
      source: diagram.source, // Detection source (azure_figure, azure_image, vision_segment)
      // Note: boundingBox excluded from JSON export (internal metadata)
    };

    writeTextFile(jsonPath, JSON.stringify(exportData, null, 2));
    updated.push(diagram); // Keep full diagram object for manifest
  }

  console.log(
    `[exportDiagrams] Exported ${updated.length} diagram(s): ` +
    `${updated.filter(d => d.quality === "ok").length} to auto_ok, ` +
    `${updated.filter(d => d.quality !== "ok").length} to needs_review`
  );

  return updated;
}
