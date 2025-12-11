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

// Phase B: New multi-extractor text layer
import { loadDocument } from "./pipeline/loader";
import { extractPageText } from "./pipeline/pageTextExtractor";

// Phase C: Structure detection and compilation
import { compileStructure } from "./pipeline/structure/structureCompiler";
import { PrismaClient } from "@prisma/client";
import type { PipelineLogger } from "./fileLogger";

// Phase D: Rendering & Diagrams
import { renderPdfPagesToPngs } from "./pipeline/render/pdfRenderer";
import { segmentAndStoreDiagrams } from "./pipeline/diagrams/diagramSegmenter";
import { explainDiagrams } from "./pipeline/diagrams/diagramExplainer";

// Phase E: Tables + Chunking + Embeddings
import { extractTables } from "./pipeline/tables/tableExtractor";
import { generateChunksForRulebook } from "./pipeline/chunking/chunkBuilder";
import { embedAllChunks } from "./pipeline/embeddings/embedder";

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
  logger?: PipelineLogger;
  // Phase C: Optional Prisma integration
  prisma?: PrismaClient;
  rulebookId?: string;
  skipStructureCompilation?: boolean;
  // Phase D: Diagram processing controls
  skipDiagrams?: boolean;
  maxDiagramExplanations?: number;
  publicUrlBase?: string;
  // Phase E: Chunking and embedding controls
  skipChunking?: boolean;
  skipEmbeddings?: boolean;
  embeddingModel?: string;
  embeddingBatchSize?: number;
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
    visionDebug = false,
    logger
  } = config;

  // Helper to log with optional logger
  const log = (phase: string, level: "DEBUG" | "INFO" | "WARN" | "ERROR", message: string, data?: Record<string, any>) => {
    if (logger) {
      logger.log(phase, level, message, data);
    }
  };

  // Ensure directories exist
  ensureDir(outDir);
  ensureDir(tempDir);

  log("pipeline", "INFO", "Pipeline started", { inputPath, outDir });

  // Phase A: Normalize input (PDF or image)
  const normalized = await normalizeInput(inputPath, outDir);

  // Phase B: New multi-extractor text layer
  console.log("\n=== Phase B: Multi-Extractor Text Layer ===");
  let pageTextArray: any[] = [];
  let compiledStructure: any = null;

  try {
    // Load document into normalized format
    const normalizedDoc = await loadDocument(normalized.normalizedPath);
    console.log(
      `[pipeline] Loaded document: ${normalizedDoc.pageCount} pages, type: ${normalizedDoc.documentType}`
    );

    // Extract page text using multi-extractor (Azure with pdf.js fallback)
    pageTextArray = await extractPageText(normalizedDoc, {
      useAzure: true,
      usePdfJsFallback: true,
      maxPages: maxVisionPages > 0 ? maxVisionPages : normalizedDoc.pageCount,
    });

    console.log(`[pipeline] Multi-extractor returned ${pageTextArray.length} pages`);

    // Log extraction statistics
    const blockCounts = pageTextArray.map((p) => p.blocks.length);
    const tableCounts = pageTextArray.map((p) => p.tables.length);
    const totalBlocks = blockCounts.reduce((a, b) => a + b, 0);
    const totalTables = tableCounts.reduce((a, b) => a + b, 0);

    console.log(`[pipeline] Total extracted: ${totalBlocks} text blocks, ${totalTables} tables`);
    console.log("=== End Phase B ===\n");

    // Phase C: Structure Detection + Compilation
    if (config.prisma && config.rulebookId && !config.skipStructureCompilation) {
      console.log("\n=== Phase C: Structure Detection + Compilation ===");
      try {
        compiledStructure = await compileStructure(
          pageTextArray,
          config.prisma,
          config.rulebookId,
          {
            skipLLM: !process.env.OPENAI_API_KEY, // Skip LLM if no API key
          }
        );

        console.log(
          `[pipeline] Structure compiled: ${compiledStructure.sections.length} sections, ${compiledStructure.rules.length} rules`
        );
        console.log("=== End Phase C ===\n");
      } catch (err) {
        console.error("[pipeline] Phase C structure compilation failed:", err);
        console.log("Continuing without structure compilation...\n");
      }
    } else {
      console.log("[pipeline] Phase C: Skipping structure compilation (no Prisma client or rulebookId provided)\n");
    }

    // Phase D: Rendering & Diagrams
    if (config.prisma && config.rulebookId && !config.skipDiagrams) {
      console.log("\n=== Phase D: Rendering & Diagrams ===");
      try {
        // Step 1: Render all pages to PNG
        console.log("[pipeline] Phase D: Rendering pages to PNG...");
        const renderedPages = await renderPdfPagesToPngs({
          pdfPath: normalized.normalizedPath,
          outDir: path.join(outDir, "pages"),
          scale: 2.0,
        });

        // Transform to format expected by segmentAndStoreDiagrams
        const pageImages = renderedPages.map((page) => ({
          page: page.pageNumber,
          imagePath: page.pngPath,
          imageKey: `rulebooks/${config.rulebookId}/pages/page-${page.pageNumber}.png`,
        }));

        console.log(`[pipeline] Phase D: Rendered ${pageImages.length}/${normalizedDoc.pageCount} pages`);

        // Step 2: Segment diagrams and store in Prisma
        console.log("[pipeline] Phase D: Segmenting diagrams...");
        const segmentResult = await segmentAndStoreDiagrams({
          rulebookId: config.rulebookId,
          pageImages,
          outDir,
          prisma: config.prisma,
          publicUrlBase: config.publicUrlBase,
        });
        console.log(`[pipeline] Phase D: Created ${segmentResult.createdCount} diagram(s)`);

        // Step 3: Explain diagrams with Vision (if configured)
        if (process.env.OPENAI_API_KEY && segmentResult.createdCount > 0) {
          console.log("[pipeline] Phase D: Explaining diagrams...");
          const explainResult = await explainDiagrams({
            rulebookId: config.rulebookId,
            prisma: config.prisma,
            visionProvider: "openai",
            maxDiagrams: config.maxDiagramExplanations ?? 50,
          });
          console.log(`[pipeline] Phase D: Updated ${explainResult.updatedCount} diagram(s) with explanations`);
        } else if (!process.env.OPENAI_API_KEY) {
          console.log("[pipeline] Phase D: Skipping diagram explanations (OPENAI_API_KEY not set)");
        } else {
          console.log("[pipeline] Phase D: No diagrams to explain");
        }

        console.log("=== End Phase D ===\n");
      } catch (err) {
        console.error("[pipeline] Phase D rendering & diagrams failed:", err);
        console.log("Continuing without diagram processing...\n");
      }
    } else if (config.skipDiagrams) {
      console.log("[pipeline] Phase D: Skipping diagram processing (skipDiagrams=true)\n");
    } else {
      console.log("[pipeline] Phase D: Skipping diagram processing (no Prisma client or rulebookId provided)\n");
    }

    // Phase E: Tables + Chunking + Embeddings
    if (config.prisma && config.rulebookId && !config.skipChunking) {
      console.log("\n=== Phase E: Tables + Chunking + Embeddings ===");
      try {
        // Step 1: Extract tables from PageText
        console.log("[pipeline] Phase E: Extracting tables...");
        const tableResult = await extractTables({
          rulebookId: config.rulebookId,
          pageTextArray,
          prisma: config.prisma,
        });
        console.log(`[pipeline] Phase E: Extracted ${tableResult.count} table(s)`);

        // Step 2: Generate chunks
        console.log("[pipeline] Phase E: Generating chunks...");
        const chunkResult = await generateChunksForRulebook({
          rulebookId: config.rulebookId,
          prisma: config.prisma,
        });
        console.log(
          `[pipeline] Phase E: Generated ${chunkResult.count} chunk(s) ` +
            `(rules: ${chunkResult.breakdown.rules}, narratives: ${chunkResult.breakdown.narratives}, ` +
            `tables: ${chunkResult.breakdown.tables}, diagrams: ${chunkResult.breakdown.diagrams})`
        );

        // Step 3: Generate embeddings (if not disabled)
        if (!config.skipEmbeddings) {
          console.log("[pipeline] Phase E: Generating embeddings...");
          const embedResult = await embedAllChunks({
            rulebookId: config.rulebookId,
            prisma: config.prisma,
            model: config.embeddingModel,
            batchSize: config.embeddingBatchSize,
          });
          console.log(
            `[pipeline] Phase E: Embedded ${embedResult.embedded} chunk(s), skipped ${embedResult.skipped}`
          );
        } else {
          console.log("[pipeline] Phase E: Skipping embeddings (skipEmbeddings=true)");
        }

        console.log("=== End Phase E ===\n");
      } catch (err) {
        console.error("[pipeline] Phase E tables/chunking/embeddings failed:", err);
        console.log("Continuing without Phase E...\n");
      }
    } else if (config.skipChunking) {
      console.log("[pipeline] Phase E: Skipping chunking and embeddings (skipChunking=true)\n");
    } else {
      console.log("[pipeline] Phase E: Skipping chunking and embeddings (no Prisma client or rulebookId provided)\n");
    }
  } catch (err) {
    console.error("[pipeline] Phase B/C/D/E failed:", err);
    console.log("Continuing with legacy extraction path...\n");
  }

  // Analyze with Azure Document Intelligence (legacy path - keep for backward compatibility)
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
      outDir,
      result // Pass Azure result for page dimensions
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

  log("pipeline", "INFO", "Pipeline completed successfully", {
    okCount,
    lowConfidenceCount,
    handwritingCount,
    narrativeChunks: narrativeChunks.length,
    tables: updatedTables.length,
    diagrams: updatedDiagrams.length,
  });

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
