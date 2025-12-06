/**
 * Phase B: pdf.js Text Extractor (Fallback)
 * Extracts raw text from PDFs using pdf.js when Azure is unavailable.
 */

import { NormalizedDocument, PageText, TextBlock } from "../types";

export interface PdfJsExtractorOptions {
  /** Maximum number of pages to extract (optional). */
  maxPages?: number;
}

/**
 * Extract page text using pdf.js (fallback extractor).
 * Returns PageText[] with basic text content (no tables, simpler structure).
 */
export async function extractPageTextWithPdfJs(
  doc: NormalizedDocument,
  options: PdfJsExtractorOptions = {}
): Promise<PageText[]> {
  const maxPages = options.maxPages ?? doc.pageCount;
  const pagesToExtract = Math.min(maxPages, doc.pageCount);

  console.log(`[pdfjsTextExtractor] Extracting text from ${pagesToExtract}/${doc.pageCount} pages using pdf.js`);

  // Dynamic import to avoid worker issues (server-side pdf.js)
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(doc.pdfBuffer),
    useSystemFonts: true,
    standardFontDataUrl: "pdfjs-dist/standard_fonts/",
  });

  const pdfDoc = await loadingTask.promise;
  const pageTextArray: PageText[] = [];

  // Extract text from each page
  for (let pageNum = 1; pageNum <= pagesToExtract; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combine all text items into blocks
      const blocks: TextBlock[] = [];

      if (textContent.items.length > 0) {
        // Group text items into lines/blocks
        // For simplicity, we'll create one block per text item (can be refined later)
        const textLines: string[] = [];

        for (const item of textContent.items) {
          if ("str" in item && item.str.trim()) {
            textLines.push(item.str);
          }
        }

        // Join all text into a single block (simple approach)
        if (textLines.length > 0) {
          blocks.push({
            page: pageNum,
            text: textLines.join("\n"),
            source: "pdfjs",
          });
        }
      }

      pageTextArray.push({
        page: pageNum,
        blocks,
        tables: [], // pdf.js doesn't extract tables
        confidence: 0.7, // Lower confidence than Azure
        source: "pdfjs",
      });

      console.log(`[pdfjsTextExtractor] Page ${pageNum}: extracted ${blocks.length} block(s)`);
    } catch (err) {
      console.error(`[pdfjsTextExtractor] Failed to extract page ${pageNum}:`, err);
      // Add empty page on error
      pageTextArray.push({
        page: pageNum,
        blocks: [],
        tables: [],
        confidence: 0.0,
        source: "pdfjs",
      });
    }
  }

  console.log(`[pdfjsTextExtractor] Extracted text from ${pageTextArray.length} pages`);
  return pageTextArray;
}
