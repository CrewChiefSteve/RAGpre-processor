/**
 * Phase B: Universal Loader
 * Normalizes input (local file or URL) into a NormalizedDocument.
 */

import fs from "node:fs/promises";
import { NormalizedDocument, DocumentType } from "./types";

export interface LoadDocumentOptions {
  /** If true, allow HTTP(S) URLs; otherwise assume local path only. */
  allowRemote?: boolean;
}

/**
 * Load a PDF document from a local file path (or optionally a URL).
 * Returns a NormalizedDocument with buffer, page count, and type classification.
 */
export async function loadDocument(
  source: string,
  opts: LoadDocumentOptions = {}
): Promise<NormalizedDocument> {
  console.log(`[loadDocument] Loading: ${source}`);

  // 1. Detect if source is URL vs local path
  const isUrl = source.startsWith("http://") || source.startsWith("https://");
  if (isUrl && !opts.allowRemote) {
    throw new Error("Remote URLs are not allowed. Set allowRemote: true to enable.");
  }

  // 2. Load the PDF into a Buffer
  let pdfBuffer: Buffer;
  if (isUrl) {
    // Fetch from URL
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    pdfBuffer = Buffer.from(arrayBuffer);
  } else {
    // Read from local file
    pdfBuffer = await fs.readFile(source);
  }

  // 3. Use pdf.js to get page count (and validate it's a PDF)
  let pageCount = 0;
  let documentType: DocumentType = "unknown";

  try {
    // Dynamic import to avoid worker issues (server-side pdf.js)
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      standardFontDataUrl: "pdfjs-dist/standard_fonts/",
    });

    const pdfDoc = await loadingTask.promise;
    pageCount = pdfDoc.numPages;

    // TODO: Heuristically determine if document is digital or scanned
    // For now, assume all PDFs are digital. Later we can:
    // - Check for embedded fonts vs image-only pages
    // - Analyze text extraction quality
    // - Look for OCR artifacts
    documentType = "pdf_digital";

    console.log(`[loadDocument] Loaded ${pageCount} pages, type: ${documentType}`);
  } catch (err) {
    console.error(`[loadDocument] Failed to parse PDF with pdf.js:`, err);
    throw new Error(`Invalid PDF document: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    source,
    pdfBuffer,
    pageCount,
    documentType,
  };
}
