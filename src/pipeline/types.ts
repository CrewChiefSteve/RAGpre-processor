/**
 * Phase B: Universal Loader + Multi-Extractor Text Layer
 * Core types for the low-level text extraction pipeline.
 */

export type DocumentType = "pdf_digital" | "pdf_scanned" | "unknown";

/**
 * Normalized document representation after universal loading.
 * This is the input to all text extractors.
 */
export interface NormalizedDocument {
  /** Original input path or URL (for logging/debugging). */
  source: string;
  /** Raw PDF bytes. */
  pdfBuffer: Buffer;
  /** Number of pages (if known). */
  pageCount: number;
  /** Heuristic classification of document type. */
  documentType: DocumentType;
}

/**
 * Simple bounding box in normalized page coordinates (0–1).
 */
export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Identifies which extractor produced this content.
 */
export type ExtractorSource = "azure" | "pdfjs" | "ocr";

/**
 * Text style information (font, size, bold, italic).
 */
export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
}

/**
 * A block of text on a page – can be a paragraph, line, or heading.
 */
export interface TextBlock {
  /** Page number (1-indexed). */
  page: number;
  /** Text content. */
  text: string;
  /** Optional bounding box in normalized coordinates. */
  bbox?: BBox;
  /** Optional style information. */
  style?: TextStyle;
  /** Which extractor produced this block. */
  source: ExtractorSource;
}

/**
 * Structured table representation (even if rough).
 */
export interface ExtractedTable {
  /** Page number (1-indexed). */
  page: number;
  /** Optional bounding box. */
  bbox?: BBox;
  /** Optional header row. */
  headers?: string[];
  /** Table rows (array of cells). */
  rows: string[][];
  /** Which extractor produced this table. */
  source: ExtractorSource;
}

/**
 * Text content for a single page from an extractor.
 */
export interface PageText {
  /** Page number (1-indexed). */
  page: number;
  /** Text blocks on this page. */
  blocks: TextBlock[];
  /** Tables on this page. */
  tables: ExtractedTable[];
  /** Confidence score (0–1), rough heuristic. */
  confidence: number;
  /** Primary extractor for this page. */
  source: ExtractorSource;
}
