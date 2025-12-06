/**
 * Phase B: Multi-Extractor Orchestrator
 * Coordinates Azure and pdf.js extractors with intelligent fallback.
 */

import { NormalizedDocument, PageText } from "./types";
import { extractPageTextWithAzure } from "./extractors/azureTextExtractor";
import { extractPageTextWithPdfJs } from "./extractors/pdfjsTextExtractor";

export interface MultiExtractorOptions {
  /** Use Azure Document Intelligence (default: true). */
  useAzure?: boolean;
  /** Use pdf.js as fallback (default: true). */
  usePdfJsFallback?: boolean;
  /** Maximum pages to extract (optional). */
  maxPages?: number;
}

/**
 * Extract page text from a document using multiple extractors.
 * Tries Azure first, falls back to pdf.js on failure.
 * Returns PageText[] covering all requested pages.
 */
export async function extractPageText(
  doc: NormalizedDocument,
  options: MultiExtractorOptions = {}
): Promise<PageText[]> {
  const {
    useAzure = true,
    usePdfJsFallback = true,
    maxPages = doc.pageCount,
  } = options;

  console.log(
    `[pageTextExtractor] Extracting text from ${doc.pageCount} pages ` +
    `(useAzure: ${useAzure}, usePdfJsFallback: ${usePdfJsFallback})`
  );

  // Validate options
  if (!useAzure && !usePdfJsFallback) {
    throw new Error("At least one extractor must be enabled (Azure or pdf.js)");
  }

  let pageTextArray: PageText[] = [];
  let azureSuccess = false;

  // Try Azure first (if enabled)
  if (useAzure) {
    try {
      console.log("[pageTextExtractor] Attempting Azure extraction...");
      pageTextArray = await extractPageTextWithAzure(doc, {});
      azureSuccess = true;

      // Log which pages Azure returned
      const azurePages = pageTextArray.map((p) => p.page).sort((a, b) => a - b);
      console.log(
        `[pageTextExtractor] Azure succeeded for ${azurePages.length} pages: [${azurePages.join(", ")}]`
      );

      // Check if we got all expected pages
      const expectedPages = Math.min(maxPages, doc.pageCount);
      if (azurePages.length < expectedPages) {
        console.warn(
          `[pageTextExtractor] Azure returned ${azurePages.length}/${expectedPages} pages ` +
          `(missing some pages)`
        );
      }
    } catch (err) {
      console.error(`[pageTextExtractor] Azure extraction failed:`, err);
      azureSuccess = false;
      pageTextArray = [];
    }
  }

  // If Azure failed completely, try pdf.js fallback
  if (!azureSuccess && usePdfJsFallback) {
    console.log("[pageTextExtractor] Falling back to pdf.js for all pages...");
    try {
      pageTextArray = await extractPageTextWithPdfJs(doc, { maxPages });
      const pdfjsPages = pageTextArray.map((p) => p.page).sort((a, b) => a - b);
      console.log(
        `[pageTextExtractor] pdf.js fallback succeeded for ${pdfjsPages.length} pages: [${pdfjsPages.join(", ")}]`
      );
    } catch (err) {
      console.error(`[pageTextExtractor] pdf.js fallback also failed:`, err);
      throw new Error(
        `All extractors failed. Azure: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  } else if (azureSuccess && usePdfJsFallback) {
    // Azure succeeded but may have missing pages - check for gaps
    const azurePageSet = new Set(pageTextArray.map((p) => p.page));
    const missingPages: number[] = [];

    for (let i = 1; i <= Math.min(maxPages, doc.pageCount); i++) {
      if (!azurePageSet.has(i)) {
        missingPages.push(i);
      }
    }

    // If there are missing pages, fill them with pdf.js
    if (missingPages.length > 0) {
      console.log(
        `[pageTextExtractor] Azure missing ${missingPages.length} pages: [${missingPages.join(", ")}]`
      );
      console.log("[pageTextExtractor] Using pdf.js to fill missing pages...");

      try {
        // Extract only missing pages with pdf.js
        // (For simplicity, we'll extract all pages and filter - can optimize later)
        const pdfjsPages = await extractPageTextWithPdfJs(doc, { maxPages });

        for (const pdfjsPage of pdfjsPages) {
          if (missingPages.includes(pdfjsPage.page)) {
            pageTextArray.push(pdfjsPage);
            console.log(`[pageTextExtractor] pdf.js filled page ${pdfjsPage.page}`);
          }
        }

        // Sort by page number
        pageTextArray.sort((a, b) => a.page - b.page);
      } catch (err) {
        console.error(`[pageTextExtractor] pdf.js gap-filling failed:`, err);
        // Continue with what we have from Azure
      }
    }
  }

  // Final validation
  if (pageTextArray.length === 0) {
    throw new Error("No pages were successfully extracted");
  }

  // Log final extraction summary
  const sources = new Map<string, number>();
  for (const page of pageTextArray) {
    sources.set(page.source, (sources.get(page.source) || 0) + 1);
  }

  console.log("[pageTextExtractor] Final extraction summary:");
  for (const [source, count] of sources) {
    console.log(`  - ${source}: ${count} page(s)`);
  }

  return pageTextArray;
}
