import type { AnalyzeResult } from "@azure/ai-form-recognizer";
import type {
  RoutedContent,
  NarrativeChunk,
  TableAsset,
  DiagramAsset,
  DocumentOrigin,
  ContentQuality
} from "./types";
import { detectDiagrams, type DiagramDetectionOptions } from "./diagramDetection";

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${++idCounter}`;

export interface RouteContentOptions {
  enableVisionSegmentation?: boolean;
  maxVisionPages?: number;
  outDir?: string;
  debug?: boolean;
}

/**
 * Phase B: Helper to detect handwriting spans in Azure's AnalyzeResult.
 * Returns a function that checks if a given text span overlaps with any handwritten spans.
 */
function buildHandwritingSpanChecker(result: AnalyzeResult) {
  const handwritingSpans =
    result.styles
      ?.filter((s) => s.isHandwritten)
      .flatMap((s) => s.spans ?? []) ?? [];

  // Returns true if any handwriting span overlaps with [offset, offset+length)
  return (offset: number, length: number): boolean => {
    const end = offset + length;
    return handwritingSpans.some((span) => {
      const spanStart = span.offset ?? 0;
      const spanEnd = spanStart + (span.length ?? 0);
      // simple overlap check
      return spanStart < end && spanEnd > offset;
    });
  };
}

/**
 * Phase B: Map confidence + handwriting to ContentQuality.
 * - Handwritten content → "handwriting"
 * - Low confidence (<0.9) → "low_confidence"
 * - Otherwise → "ok"
 */
function classifyQuality(
  confidence: number | undefined,
  isHandwritten: boolean
): ContentQuality {
  if (isHandwritten) {
    return "handwriting";
  }
  if (confidence !== undefined && confidence < 0.9) {
    return "low_confidence";
  }
  return "ok";
}

export async function routeContent(
  result: AnalyzeResult,
  sourcePdf: string,
  origin: DocumentOrigin,
  sourceFilePath: string,
  options?: RouteContentOptions
): Promise<RoutedContent> {
  const narrativeBlocks: NarrativeChunk[] = [];
  const tables: TableAsset[] = [];

  // TODO: smarter section detection via headings hierarchy.
  // For now just use a flat sectionPath with page numbers.
  const pageCount = result.pages?.length ?? 0;

  // Phase B: Initialize handwriting span checker
  const isHandwritingSpan = buildHandwritingSpanChecker(result);

  // 1. Narrative – use paragraphs
  if (result.paragraphs) {
    for (const para of result.paragraphs) {
      const content = para.content?.trim();
      if (!content) continue;

      const pageNum = para.boundingRegions?.[0]?.pageNumber ?? 0;

      // Phase B: Paragraph-level confidence
      // Note: confidence may not be available in all Azure SDK versions
      const paraConfidence = (para as any).confidence as number | undefined;

      // Phase B: Handwriting detection based on spans
      let isHandwritten = false;
      if (para.spans && para.spans.length > 0) {
        const { offset = 0, length = 0 } = para.spans[0];
        isHandwritten = isHandwritingSpan(offset, length);
      }

      const quality = classifyQuality(paraConfidence, isHandwritten);

      narrativeBlocks.push({
        id: nextId("narrative"),
        sectionPath: [`Page ${pageNum}`],
        text: content,
        sourcePdf,
        pageRange: [pageNum, pageNum],
        origin,
        quality,
        sourceImagePath: origin === "image_normalized" ? sourceFilePath : undefined,
      });
    }
  }

  // 2. Tables
  if (result.tables) {
    for (const table of result.tables) {
      const pageNum = table.boundingRegions?.[0]?.pageNumber ?? 0;

      // Phase B: Compute table confidence from cells
      let tableConfidence: number | undefined = undefined;
      if (table.cells && table.cells.length > 0) {
        // Use the minimum cell confidence as a conservative estimate
        // Note: confidence may not be available in all Azure SDK versions
        const confidences = table.cells
          .map((cell) => (cell as any).confidence as number | undefined)
          .filter((c): c is number => c !== undefined);
        if (confidences.length > 0) {
          tableConfidence = Math.min(...confidences);
        }
      }

      // Phase B: Tables are typically printed, not handwritten
      const quality = classifyQuality(tableConfidence, false);

      // very basic summary – you'll upgrade this later
      const description = `Table from page ${pageNum} of ${sourcePdf}.`;

      // The csvPath is a logical path for now; exportTables.ts will fill it in
      const csvPath = `tables/${sourcePdf.replace(/\.[^.]+$/, "")}_table_${table.rowCount}x${table.columnCount}.csv`;

      tables.push({
        id: nextId("table"),
        sectionPath: [`Page ${pageNum}`],
        title: `Table on page ${pageNum}`,
        csvPath,
        description,
        sourcePdf,
        pageRange: [pageNum, pageNum],
        origin,
        quality
      });
    }
  }

  // 3. Diagrams / figures
  // Detect diagrams using hybrid Azure + Vision detection
  const detectionOptions: DiagramDetectionOptions = {
    sourcePdf,
    origin,
    sourceFilePath,
    outDir: options?.outDir || "out",
    enableVisionSegmentation: options?.enableVisionSegmentation || false,
    maxVisionPages: options?.maxVisionPages || 20,
    debug: options?.debug || false,
  };

  const detectedDiagrams = await detectDiagrams(result, detectionOptions);

  return { narrativeBlocks, tables, diagrams: detectedDiagrams };
}
