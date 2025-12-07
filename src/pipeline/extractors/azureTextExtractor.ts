/**
 * Phase B: Azure Text Extractor
 * Wraps Azure Document Intelligence API and normalizes to PageText[].
 */

import { AZURE_DOC_ENDPOINT, AZURE_DOC_KEY } from "../../config";
import { analyzePdf, type AnalyzeResult } from "../../analyzePdf";
import { NormalizedDocument, PageText, TextBlock, ExtractedTable, BBox } from "../types";

export interface AzureExtractorOptions {
  /** Azure model to use (default: "prebuilt-layout"). */
  model?: string;
}

/**
 * Extract page text using Azure Document Intelligence.
 * Returns PageText[] with normalized structure.
 */
export async function extractPageTextWithAzure(
  doc: NormalizedDocument,
  options: AzureExtractorOptions = {}
): Promise<PageText[]> {
  if (!AZURE_DOC_ENDPOINT || !AZURE_DOC_KEY) {
    throw new Error("Azure config missing. Set AZURE_DOC_ENDPOINT and AZURE_DOC_KEY.");
  }

  const model = options.model || "prebuilt-layout";
  console.log(`[azureTextExtractor] Analyzing ${doc.pageCount} pages with Azure (model: ${model})`);

  // Call the new analyzePdf function which uses the updated SDK
  // Note: analyzePdf expects a file path, but we have a buffer
  // For now, we'll need to write the buffer to a temp file
  const fs = await import("fs/promises");
  const os = await import("os");
  const pathModule = await import("path");

  const tempPath = pathModule.join(os.tmpdir(), `azure-extract-${Date.now()}.pdf`);
  await fs.writeFile(tempPath, doc.pdfBuffer);

  try {
    const result = await analyzePdf(tempPath);

    console.log(
      `[azureTextExtractor] Azure returned ${result.pages?.length ?? 0} pages, ` +
      `${result.paragraphs?.length ?? 0} paragraphs, ${result.tables?.length ?? 0} tables, ` +
      `${result.figures?.length ?? 0} figures`
    );

    // Normalize Azure result into PageText[]
    return normalizeAzureResult(result, doc.pageCount);
  } finally {
    // Clean up temp file
    await fs.unlink(tempPath).catch(() => {});
  }
}

/**
 * Normalize Azure's AnalyzeResult into our PageText[] structure.
 */
function normalizeAzureResult(result: AnalyzeResult, expectedPageCount: number): PageText[] {
  const pageTextMap: Map<number, PageText> = new Map();

  // Initialize all pages
  for (let i = 1; i <= expectedPageCount; i++) {
    pageTextMap.set(i, {
      page: i,
      blocks: [],
      tables: [],
      confidence: 1.0, // Default confidence
      source: "azure",
    });
  }

  // Extract paragraphs as text blocks
  if (result.paragraphs) {
    for (const para of result.paragraphs) {
      const content = para.content?.trim();
      if (!content) continue;

      const pageNum = para.boundingRegions?.[0]?.pageNumber ?? 1;
      const pageText = pageTextMap.get(pageNum);
      if (!pageText) continue;

      // Extract bounding box (normalized to 0-1)
      let bbox: BBox | undefined;
      const br = para.boundingRegions?.[0];
      if (br?.polygon && result.pages) {
        const azurePage = result.pages.find((p) => p.pageNumber === pageNum);
        if (azurePage) {
          bbox = normalizeBoundingBox(br.polygon, azurePage.width, azurePage.height);
        }
      }

      // Extract style (if available)
      const style = extractTextStyle(para, result);

      pageText.blocks.push({
        page: pageNum,
        text: content,
        bbox,
        style,
        source: "azure",
      });
    }
  }

  // Extract tables
  if (result.tables) {
    for (const table of result.tables) {
      const pageNum = table.boundingRegions?.[0]?.pageNumber ?? 1;
      const pageText = pageTextMap.get(pageNum);
      if (!pageText) continue;

      // Extract bounding box
      let bbox: BBox | undefined;
      const br = table.boundingRegions?.[0];
      if (br?.polygon && result.pages) {
        const azurePage = result.pages.find((p) => p.pageNumber === pageNum);
        if (azurePage) {
          bbox = normalizeBoundingBox(br.polygon, azurePage.width, azurePage.height);
        }
      }

      // Convert Azure table to our format
      const rowCount = table.rowCount ?? 0;
      const columnCount = table.columnCount ?? 0;
      const headers: string[] = [];
      const rows: string[][] = [];

      // Initialize rows
      for (let r = 0; r < rowCount; r++) {
        rows.push(new Array(columnCount).fill(""));
      }

      // Fill cells
      if (table.cells) {
        for (const cell of table.cells) {
          const rowIdx = cell.rowIndex ?? 0;
          const colIdx = cell.columnIndex ?? 0;
          const content = cell.content ?? "";

          if (rowIdx < rowCount && colIdx < columnCount) {
            rows[rowIdx][colIdx] = content;
          }
        }
      }

      // First row is headers (if available)
      if (rows.length > 0) {
        headers.push(...rows[0]);
        rows.shift(); // Remove header from data rows
      }

      pageText.tables.push({
        page: pageNum,
        bbox,
        headers: headers.length > 0 ? headers : undefined,
        rows,
        source: "azure",
      });
    }
  }

  // Calculate page-level confidence (average of paragraph confidences)
  for (const [pageNum, pageText] of pageTextMap) {
    const confidences: number[] = [];

    // Try to extract confidence from paragraphs on this page
    if (result.paragraphs) {
      for (const para of result.paragraphs) {
        const paraPage = para.boundingRegions?.[0]?.pageNumber ?? 1;
        if (paraPage === pageNum) {
          const paraConfidence = (para as any).confidence as number | undefined;
          if (paraConfidence !== undefined) {
            confidences.push(paraConfidence);
          }
        }
      }
    }

    // Set page confidence
    if (confidences.length > 0) {
      pageText.confidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    }
  }

  return Array.from(pageTextMap.values());
}

/**
 * Normalize Azure polygon to 0-1 bounding box.
 * Azure polygon can be either Point2D[] or number[] depending on SDK version.
 */
function normalizeBoundingBox(polygon: any, pageWidth?: number, pageHeight?: number): BBox | undefined {
  if (!polygon || !pageWidth || !pageHeight) {
    return undefined;
  }

  let xs: number[] = [];
  let ys: number[] = [];

  // Handle Point2D[] format (newer SDK)
  if (Array.isArray(polygon) && polygon.length > 0 && typeof polygon[0] === 'object' && 'x' in polygon[0]) {
    xs = polygon.map((p: any) => p.x);
    ys = polygon.map((p: any) => p.y);
  }
  // Handle number[] format (older SDK)
  else if (Array.isArray(polygon) && polygon.length >= 8 && typeof polygon[0] === 'number') {
    xs = [polygon[0], polygon[2], polygon[4], polygon[6]];
    ys = [polygon[1], polygon[3], polygon[5], polygon[7]];
  } else {
    return undefined;
  }

  if (xs.length === 0 || ys.length === 0) {
    return undefined;
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX / pageWidth,
    y: minY / pageHeight,
    width: (maxX - minX) / pageWidth,
    height: (maxY - minY) / pageHeight,
  };
}

/**
 * Extract text style from Azure paragraph (if available).
 */
function extractTextStyle(para: any, result: AnalyzeResult): any {
  // Azure styles are global, check if this paragraph's span matches any style
  if (!result.styles || !para.spans || para.spans.length === 0) {
    return undefined;
  }

  const paraSpan = para.spans[0];
  const paraStart = paraSpan.offset ?? 0;
  const paraEnd = paraStart + (paraSpan.length ?? 0);

  for (const style of result.styles) {
    if (!style.spans) continue;

    for (const styleSpan of style.spans) {
      const styleStart = styleSpan.offset ?? 0;
      const styleEnd = styleStart + (styleSpan.length ?? 0);

      // Check if spans overlap
      if (styleStart < paraEnd && styleEnd > paraStart) {
        // Found a matching style
        return {
          fontFamily: (style as any).fontFamily,
          fontSize: (style as any).fontSize,
          bold: (style as any).fontWeight === "bold",
          italic: (style as any).fontStyle === "italic",
        };
      }
    }
  }

  return undefined;
}
