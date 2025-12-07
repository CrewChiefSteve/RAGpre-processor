/**
 * Phase D: PDF Page Renderer
 *
 * Converts PDF pages to PNG images for diagram detection and Vision processing.
 * Uses pdf.js + node-canvas as primary renderer with graceful error handling.
 *
 * This module is the SINGLE source of truth for PDF → PNG rendering.
 * Phase D (page rendering) and Vision diagram segmentation should both call
 * into these helpers instead of setting up their own pdf.js workers.
 */

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { createRequire } from "module";
import { createCanvas } from "canvas";

import { trace } from "../../debugTrace";
// If you still need it for other Phase D logic, keep this; otherwise you can remove it
import type { NormalizedDocument } from "../types";

// Type import for proper typing (does not bundle the module)
import type * as PdfJsType from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);

// Lazy-load pdf.js LEGACY BUILD to avoid worker issues in Next.js server context
let pdfjsLibPromise: Promise<typeof PdfJsType> | null = null;

async function loadPdfJs(): Promise<typeof PdfJsType> {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist/legacy/build/pdf.mjs") as Promise<
      typeof PdfJsType
    >;
  }
  return pdfjsLibPromise;
}

/* -------------------------------------------------------------------------- */
/* Logger abstraction                                                          */
/* -------------------------------------------------------------------------- */

export type Logger = {
  debug: (msg: string, meta?: any) => void;
  info?: (msg: string, meta?: any) => void;
  warn?: (msg: string, meta?: any) => void;
  error?: (msg: string, meta?: any) => void;
};

const traceLogger: any =
  (trace as any)?.extend?.("pdfRenderer") ?? (trace as any) ?? null;

const defaultLogger: Logger = {
  debug: (msg, meta) => {
    if (traceLogger) {
      try {
        traceLogger(msg, meta);
        return;
      } catch {
        // fall through to console
      }
    }
    // eslint-disable-next-line no-console
    console.debug(`[pdfRenderer] ${msg}`, meta ?? "");
  },
  info: (msg, meta) => {
    // eslint-disable-next-line no-console
    console.info?.(`[pdfRenderer] ${msg}`, meta ?? "");
  },
  warn: (msg, meta) => {
    // eslint-disable-next-line no-console
    console.warn?.(`[pdfRenderer] ${msg}`, meta ?? "");
  },
  error: (msg, meta) => {
    // eslint-disable-next-line no-console
    console.error?.(`[pdfRenderer] ${msg}`, meta ?? "");
  },
};

/* -------------------------------------------------------------------------- */
/* NodeCanvasFactory - used by pdf.js in Node                                 */
/* -------------------------------------------------------------------------- */

class NodeCanvasFactory {
  // CRITICAL FIX: PDF.js legacy build needs this static property to access createCanvas
  // Without this, you get: "Cannot read properties of undefined (reading 'createCanvas')"
  static createCanvas = createCanvas;

  create(width: number, height: number) {
    const canvas = createCanvas(Math.floor(width), Math.floor(height));
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(
    canvasAndContext: { canvas: any; context: any },
    width: number,
    height: number
  ) {
    const canvas = canvasAndContext.canvas;
    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);
  }

  destroy(canvasAndContext: { canvas: any; context: any }) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    // Allow GC cleanup
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }

  // Some pdf.js builds may call this internally
  _createCanvas(width: number, height: number) {
    return createCanvas(Math.floor(width), Math.floor(height));
  }
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface RenderPageOptions {
  /** Scale factor for rendering (default: 2.0 for hi-res) */
  scale?: number;
}

export interface RenderSinglePageToPngOptions extends RenderPageOptions {
  /** Absolute path to the PDF file on disk */
  pdfPath: string;
  /** 1-based page number */
  pageNumber: number;
  /** Absolute path where the PNG should be written */
  pngPath: string;
  /** Optional logger (defaults to trace/console) */
  logger?: Logger;
}

export interface RenderPdfPagesToPngsOptions extends RenderPageOptions {
  /** Absolute path to the PDF file on disk */
  pdfPath: string;
  /** Output directory for PNGs */
  outDir: string;
  /** First page to render (1-based, default: 1) */
  fromPage?: number;
  /** Last page to render (1-based, default: numPages) */
  toPage?: number;
  /** Optional logger (defaults to trace/console) */
  logger?: Logger;
}

export interface RenderedPageInfo {
  pageNumber: number;
  pngPath: string;
  width: number;
  height: number;
}

/* -------------------------------------------------------------------------- */
/* Core helpers (shared by Phase D & Vision)                                  */
/* -------------------------------------------------------------------------- */

async function loadPdfDocumentFromFile(
  pdfPath: string,
  logger: Logger = defaultLogger
) {
  logger.debug("Loading PDF document from file", { pdfPath });

  // Lazy-load pdf.js LEGACY BUILD
  const pdfjsLib = await loadPdfJs();

  // Diagnostic logging to confirm pdf.js loaded and check worker config
  // Note: In legacy build, GlobalWorkerOptions is read-only, so we just read it
  try {
    logger.debug("[pdfRenderer] pdf.js loaded", {
      version: (pdfjsLib as any).version ?? "unknown",
      workerSrc: (pdfjsLib as any).GlobalWorkerOptions?.workerSrc ?? null,
      isLegacyBuild: true,
    });
  } catch (err) {
    // Ignore errors reading GlobalWorkerOptions
    logger.debug("[pdfRenderer] pdf.js loaded (legacy build)", {
      version: (pdfjsLib as any).version ?? "unknown",
    });
  }

  const data = await fsp.readFile(pdfPath);
  const pdfData = new Uint8Array(data);

  // Legacy build + disableWorker should work without any GlobalWorkerOptions config
  const loadingTask = (pdfjsLib as any).getDocument({
    data: pdfData,
    disableWorker: true, // <-- CRITICAL: Force no worker (legacy build respects this)
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
    CanvasFactory: NodeCanvasFactory, // <-- IMPORTANT: pass CLASS, not instance
  });

  const doc = await loadingTask.promise;
  logger.debug("PDF loaded", { numPages: doc.numPages });

  return doc as import("pdfjs-dist/types/src/display/api").PDFDocumentProxy;
}

async function renderPageToPngFile(
  doc: import("pdfjs-dist/types/src/display/api").PDFDocumentProxy,
  pageNumber: number,
  pngPath: string,
  scale: number,
  logger: Logger = defaultLogger
): Promise<RenderedPageInfo> {
  logger.debug("Rendering page to PNG", { pageNumber, pngPath, scale });

  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const factory = new NodeCanvasFactory();
  const { canvas, context } = factory.create(viewport.width, viewport.height);

  const renderContext = {
    canvasContext: context,
    viewport,
  };

  await page.render(renderContext as any).promise;

  const buffer: Buffer = canvas.toBuffer("image/png");
  await fsp.mkdir(path.dirname(pngPath), { recursive: true });
  await fsp.writeFile(pngPath, buffer);

  factory.destroy({ canvas, context });

  const result: RenderedPageInfo = {
    pageNumber,
    pngPath,
    width: viewport.width,
    height: viewport.height,
  };

  logger.debug("Page rendered", result);
  return result;
}

/* -------------------------------------------------------------------------- */
/* Public API: single-page render (for Vision)                                */
/* -------------------------------------------------------------------------- */

/**
 * Renders a single PDF page to a PNG file.
 *
 * This is the helper that `visionDiagramSegmentation.ts` should call instead
 * of setting up its own pdf.js / worker logic.
 */
export async function renderSinglePageToPng(
  options: RenderSinglePageToPngOptions
): Promise<RenderedPageInfo> {
  const {
    pdfPath,
    pageNumber,
    pngPath,
    scale = 2.0,
    logger = defaultLogger,
  } = options;

  logger.debug("renderSinglePageToPng called", {
    pdfPath,
    pageNumber,
    pngPath,
    scale,
  });

  const doc = await loadPdfDocumentFromFile(pdfPath, logger);

  if (pageNumber < 1 || pageNumber > doc.numPages) {
    logger.warn?.("Page out of range in renderSinglePageToPng", {
      pageNumber,
      numPages: doc.numPages,
    });
    throw new Error(
      `Page ${pageNumber} is out of range for document with ${doc.numPages} pages`
    );
  }

  return renderPageToPngFile(doc, pageNumber, pngPath, scale, logger);
}

/* -------------------------------------------------------------------------- */
/* Public API: multi-page render (Phase D main renderer)                      */
/* -------------------------------------------------------------------------- */

/**
 * Renders a range of pages of the given PDF file to PNG images.
 *
 * PNG file names will be of the form:
 *   `<outDir>/page-<pageNumber>.png`
 */
export async function renderPdfPagesToPngs(
  options: RenderPdfPagesToPngsOptions
): Promise<RenderedPageInfo[]> {
  const {
    pdfPath,
    outDir,
    fromPage,
    toPage,
    scale = 2.0,
    logger = defaultLogger,
  } = options;

  logger.debug("renderPdfPagesToPngs called", {
    pdfPath,
    outDir,
    fromPage,
    toPage,
    scale,
  });

  const doc = await loadPdfDocumentFromFile(pdfPath, logger);

  const start = fromPage ?? 1;
  const end = toPage ?? doc.numPages;

  if (start < 1 || start > doc.numPages) {
    throw new Error(
      `fromPage ${start} is out of range for document with ${doc.numPages} pages`
    );
  }
  if (end < start || end > doc.numPages) {
    throw new Error(
      `toPage ${end} is out of range (start=${start}) for document with ${doc.numPages} pages`
    );
  }

  await fsp.mkdir(outDir, { recursive: true });

  const results: RenderedPageInfo[] = [];

  for (let pageNumber = start; pageNumber <= end; pageNumber++) {
    const pngPath = path.join(outDir, `page-${pageNumber}.png`);

    const info = await renderPageToPngFile(
      doc,
      pageNumber,
      pngPath,
      scale,
      logger
    );
    results.push(info);
  }

  logger.info?.("PDF page rendering complete", {
    pdfPath,
    outDir,
    count: results.length,
  });

  return results;
}

/* -------------------------------------------------------------------------- */
/* Optional external fallback (placeholder)                                   */
/* -------------------------------------------------------------------------- */

/**
 * Placeholder for an external renderer fallback (e.g., using `pdftoppm`).
 * Currently this is NOT implemented and always returns null.
 */
export async function tryExternalFallbackRender(
  _pdfPath: string,
  _pageNumber: number,
  _pngPath: string,
  _logger: Logger = defaultLogger
): Promise<RenderedPageInfo | null> {
  const fallbackCmd = process.env.PDF_RENDER_FALLBACK_CMD;

  if (!fallbackCmd) {
    defaultLogger.warn?.(
      "Fallback renderer not configured. Set PDF_RENDER_FALLBACK_CMD to enable external rendering."
    );
    return null;
  }

  defaultLogger.info?.(
    `Fallback rendering requested but not yet implemented (cmd=${fallbackCmd})`
  );
  return null;
}
