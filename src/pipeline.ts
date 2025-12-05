import path from "path";
import { analyzePdf } from "./analyzePdf";
import { routeContent } from "./routeContent";
import { exportNarrative } from "./exportNarrative";
import { exportTables } from "./exportTables";
import { exportDiagrams } from "./exportDiagrams";
import { ensureDir, writeTextFile } from "./utils/fsUtils";
import { normalizeInput } from "./normalizeInput";
import { enrichHandwritingFromImage } from "./handwritingPipeline";
import { extractDiagramImages } from "./extractDiagramImages";
import { generateDiagramSummaries } from "./diagramSummaryPipeline";

export interface PipelineConfig {
  inputPath: string;
  outDir: string;
  tempDir?: string;
  handwritingVision?: boolean;
  captionDiagrams?: boolean;
  enableVisionSegmentation?: boolean;
  maxVisionPages?: number;
  debug?: boolean;
  visionDebug?: boolean;
}

export interface PipelineResult {
  manifest: {
    sourcePdf: string;
    origin: string;
    narrativeChunks: any[];
    tableSummaries: any[];
    tables: any[];
    diagrams: any[];
  };
  stats: {
    okCount: number;
    lowConfidenceCount: number;
    handwritingCount: number;
  };
  outputDir: string;
}

/**
 * Run the full preprocessing pipeline
 * This function is called by both the CLI and the web job runner
 */
export async function runPipeline(config: PipelineConfig): Promise<PipelineResult> {
  const {
    inputPath,
    outDir,
    tempDir = "temp",
    handwritingVision = false,
    captionDiagrams = false,
    enableVisionSegmentation = false,
    maxVisionPages = 20,
    debug = false,
    visionDebug = false
  } = config;

  // Ensure directories exist
  ensureDir(outDir);
  ensureDir(tempDir);

  // Phase A: Normalize input (PDF or image)
  const normalized = await normalizeInput(inputPath, outDir);

  // Analyze with Azure Document Intelligence
  const result = await analyzePdf(normalized.normalizedPath);
  const sourceName = path.basename(inputPath);
  const origin = normalized.origin;

  // Phase B: Route content by quality
  console.log('[pipeline] About to call routeContent with options:', {
    enableVisionSegmentation,
    maxVisionPages,
    outDir,
    debug,
    visionDebug,
    azurePageCount: result.pages?.length || 0
  });

  const routed = await routeContent(result, sourceName, origin, normalized.normalizedPath, {
    enableVisionSegmentation,
    maxVisionPages,
    outDir,
    debug,
    visionDebug
  });

  console.log('[pipeline] routeContent returned:', {
    narrativeBlocksCount: routed.narrativeBlocks.length,
    tablesCount: routed.tables.length,
    diagramsCount: routed.diagrams.length
  });

  // Phase B+: Extract diagram images if diagrams were detected
  let diagramsWithImages = routed.diagrams;
  if (routed.diagrams.length > 0) {
    console.log(`[pipeline] Extracting images for ${routed.diagrams.length} diagram(s)`);
    diagramsWithImages = await extractDiagramImages(
      routed.diagrams,
      normalized.normalizedPath,
      outDir
    );
  }

  // Phase D: Optionally enrich handwriting with vision
  let narrativeBlocks = routed.narrativeBlocks;
  if (handwritingVision || process.env.ENABLE_HANDWRITING_VISION === "true") {
    narrativeBlocks = await enrichHandwritingFromImage(narrativeBlocks);
  }

  // Phase D: Optionally generate diagram summaries with vision
  let diagramsWithSummaries = diagramsWithImages;
  if (diagramsWithImages.length > 0 && (captionDiagrams || process.env.ENABLE_DIAGRAM_CAPTIONING === "true")) {
    console.log(`[pipeline] Generating summaries for ${diagramsWithImages.length} diagram(s)`);
    diagramsWithSummaries = await generateDiagramSummaries(
      diagramsWithImages,
      outDir,
      { enableCaptioning: true }
    );
  }

  // Phase C: Export content
  // 1. Narrative -> markdown chunks
  const narrativeChunks = await exportNarrative(narrativeBlocks, outDir);

  // 2. Tables -> CSV + summary docs
  const { updatedTables, tableSummaries } = await exportTables(
    result,
    routed.tables,
    outDir
  );

  // 3. Diagrams -> JSON stubs (already have images and summaries from Phase D)
  const updatedDiagrams = await exportDiagrams(
    diagramsWithSummaries,
    outDir,
    { captionDiagrams: false } // Already captioned in Phase D if enabled
  );

  // Calculate quality statistics
  const allContent = [...narrativeChunks, ...tableSummaries];
  const okCount = allContent.filter((c) => c.quality === "ok").length;
  const lowConfidenceCount = allContent.filter((c) => c.quality === "low_confidence").length;
  const handwritingCount = allContent.filter((c) => c.quality === "handwriting").length;

  // Build manifest
  const manifest = {
    sourcePdf: sourceName,
    origin: normalized.origin,
    narrativeChunks,
    tableSummaries,
    tables: updatedTables,
    diagrams: updatedDiagrams
  };

  // Write manifest to disk
  writeTextFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  return {
    manifest,
    stats: {
      okCount,
      lowConfidenceCount,
      handwritingCount,
    },
    outputDir: outDir,
  };
}
