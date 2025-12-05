/**
 * Type definitions for vision diagram segmentation
 * Separated from implementation to avoid loading heavy dependencies during Next.js compilation
 */

export interface VisionDebugOptions {
  /**
   * Enable debug artifact generation
   */
  enabled: boolean;

  /**
   * Root output directory for debug artifacts
   * Debug files will be written to:
   * - {outputDir}/pages/*.png (rendered pages and overlays)
   * - {outputDir}/segments/*.json (segmentation results)
   */
  outputDir: string;

  /**
   * Additional debug logging (optional, reuses existing debug flag behavior)
   */
  debug?: boolean;
}

export interface VisionSegmentationOptions {
  pdfPath: string;
  pageNumber: number;
  /**
   * Optional path to a pre-rendered page image.
   * If provided, we skip PDF rendering and use this directly.
   */
  pageImagePath?: string;
  /**
   * Base output directory for temp images / crops.
   */
  outDir: string;
  debug?: boolean;
  /**
   * Vision debug options for saving debug artifacts
   */
  visionDebugOptions?: VisionDebugOptions;
}

export interface DetectDiagramRegionsMultiPageOptions {
  pdfPath: string;
  pages: number[];
  outDir: string;
  debug?: boolean;
  visionDebugOptions?: VisionDebugOptions;
}
