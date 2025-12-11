import type { AnalyzeResult } from "./analyzePdf";
import type { DiagramAsset, DocumentOrigin, ContentQuality } from "./types";
import type {
  DetectDiagramRegionsMultiPageOptions,
} from "./visionDiagramSegmentation.types";
import path from "path";
import { trace } from "./debugTrace";

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${++idCounter}`;

export interface DiagramDetectionOptions {
  sourcePdf: string;
  origin: DocumentOrigin;
  sourceFilePath: string;
  outDir: string;
  enableVisionSegmentation?: boolean;
  maxVisionPages?: number;
  debug?: boolean;
  visionDebug?: boolean;
}

/**
 * Extract caption text from nearby paragraphs
 * Looks for paragraphs on the same page that mention "Figure", "Fig", "Diagram", etc.
 */
function extractCaptionFromParagraphs(
  result: AnalyzeResult,
  pageNumber: number
): string | undefined {
  if (!result.paragraphs) return undefined;

  // Find paragraphs on the same page
  const pageParagraphs = result.paragraphs.filter(
    (p: any) => p.boundingRegions?.[0]?.pageNumber === pageNumber
  );

  // Look for caption patterns: "Figure 3.2:", "Fig. 1:", "Diagram A:", etc.
  const captionPattern = /^(Figure|Fig\.?|Diagram|Image)\s+[\dA-Z][\dA-Z.-]*\s*:?\s*/i;

  for (const para of pageParagraphs) {
    const content = para.content?.trim();
    if (content && captionPattern.test(content)) {
      return content;
    }
  }

  return undefined;
}

/**
 * Classify diagram quality based on confidence
 * Diagrams are typically high quality unless explicitly low confidence
 */
function classifyDiagramQuality(
  confidence: number | undefined
): ContentQuality {
  if (confidence !== undefined && confidence < 0.7) {
    return "low_confidence";
  }
  return "ok";
}

/**
 * Detect diagrams from Azure Document Intelligence result using multiple sources
 *
 * This hybrid detector combines:
 * 1. Azure figures (existing)
 * 2. Azure page-level images (if available)
 * 3. Vision-based page segmentation (fallback for pages with no Azure candidates)
 */
export async function detectDiagrams(
  result: AnalyzeResult,
  options: DiagramDetectionOptions
): Promise<DiagramAsset[]> {
  const {
    sourcePdf,
    origin,
    sourceFilePath,
    outDir,
    enableVisionSegmentation = false,
    maxVisionPages = 20,
    debug = false,
  } = options;

  // ===== DIAGNOSTIC LOGGING =====
  console.log('[diagramDetection] === STARTING DIAGRAM DETECTION ===');
  console.log('[diagramDetection] Config:', {
    sourcePdf,
    origin,
    sourceFilePath,
    enableVisionSegmentation,
    maxVisionPages,
    debug,
    visionDebug: options.visionDebug,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    visionModel: process.env.VISION_MODEL,
    pageCount: result.pages?.length ?? 0,
  });

  trace("detectDiagrams called", {
    pageCount: result.pages?.length ?? 0,
    enableVision: enableVisionSegmentation,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    maxVisionPages,
    enableVisionSegmentationRaw: process.env.ENABLE_VISION_DIAGRAM_SEGMENTATION
  });

  const diagrams: DiagramAsset[] = [];
  const pagesWithDiagrams = new Set<number>();

  // Track diagram counts by source
  let azureFigureCount = 0;
  let azureImageCount = 0;
  let visionSegmentCount = 0;

  // ===== PASS 1: Azure Figures =====
  trace("starting pass 1 (Azure Figures)");

  // The new SDK returns figures directly on the result object
  const figures = result.figures;

  if (figures && Array.isArray(figures) && figures.length > 0) {
    console.log(`[diagramDetection] ✓ Found ${figures.length} Azure figure(s) in document (NEW SDK)`);

    for (const figure of figures) {
      const boundingRegion = figure.boundingRegions?.[0];
      if (!boundingRegion) continue;

      const pageNumber = boundingRegion.pageNumber ?? 1;
      pagesWithDiagrams.add(pageNumber);

      // NEW SDK: Figures now have built-in caption property
      let rawCaptionText = figure.caption?.content;

      // Fallback: Try to extract caption from nearby paragraphs if not provided
      if (!rawCaptionText) {
        rawCaptionText = extractCaptionFromParagraphs(result, pageNumber);
      }

      // Get confidence if available (may not be present in all versions)
      const confidence = (figure as any).confidence as number | undefined;
      const quality = classifyDiagramQuality(confidence);

      // Generate a title from figure.id, caption, or use default
      let title: string | undefined;

      // Try to use the figure ID (e.g., "1.1" for page 1, figure 1)
      if (figure.id) {
        title = `Figure ${figure.id}`;
      }

      // Or parse from caption text
      if (!title && rawCaptionText) {
        const match = rawCaptionText.match(/^(Figure|Fig\.?|Diagram|Image)\s+([\dA-Z][\dA-Z.-]*)/i);
        if (match) {
          title = match[0].trim();
        }
      }

      const diagramId = nextId("diagram");

      diagrams.push({
        id: diagramId,
        sectionPath: [`Page ${pageNumber}`],
        title: title ?? `Figure on page ${pageNumber}`,
        imagePath: "", // Will be filled by extractDiagramImages
        description: undefined,
        sourcePdf,
        page: pageNumber,
        origin,
        quality,
        sourceImagePath: origin === "image_normalized" ? sourceFilePath : undefined,
        rawCaptionText,
        boundingBox: boundingRegion,
        source: "azure_figure",
      });

      azureFigureCount++;

      if (debug) {
        console.log(
          `[diagramDetection] Azure figure ${diagramId} (id: ${figure.id}) on page ${pageNumber}` +
          (rawCaptionText ? ` with caption: "${rawCaptionText.slice(0, 50)}..."` : "")
        );
      }
    }
  } else {
    console.log(`[diagramDetection] No figures detected by Azure (will try vision segmentation if enabled)`);
  }

  trace("pass 1 complete (Azure Figures)", { foundCount: azureFigureCount });

  // ===== PASS 2: Azure Page-Level Images =====
  trace("starting pass 2 (Azure Page-Level Images)");
  // Check if Azure exposes page-level images (e.g., result.pages[n].images)
  // This may vary by SDK version and document type
  if (result.pages) {
    for (const page of result.pages) {
      const pageNumber = page.pageNumber ?? 0;
      const pageImages = (page as any).images;

      if (pageImages && Array.isArray(pageImages) && pageImages.length > 0) {
        for (const img of pageImages) {
          const boundingRegion = img.boundingRegions?.[0];
          if (!boundingRegion) continue;

          pagesWithDiagrams.add(pageNumber);

          const diagramId = nextId("diagram");
          const confidence = (img as any).confidence as number | undefined;
          const quality = classifyDiagramQuality(confidence);

          diagrams.push({
            id: diagramId,
            sectionPath: [`Page ${pageNumber}`],
            title: `Image on page ${pageNumber}`,
            imagePath: "",
            description: undefined,
            sourcePdf,
            page: pageNumber,
            origin,
            quality,
            sourceImagePath: origin === "image_normalized" ? sourceFilePath : undefined,
            rawCaptionText: undefined,
            boundingBox: boundingRegion,
            source: "azure_image",
          });

          azureImageCount++;

          if (debug) {
            console.log(`[diagramDetection] Azure image ${diagramId} on page ${pageNumber}`);
          }
        }
      }
    }
  }

  trace("pass 2 complete (Azure Page-Level Images)", { foundCount: azureImageCount });

  // ===== PASS 3: Vision-Based Segmentation =====
  trace("starting pass 3 (Vision-Based Segmentation)");

  const azureFoundNothing = azureFigureCount === 0 && azureImageCount === 0;
  const visionEnabled = enableVisionSegmentation && !!process.env.OPENAI_API_KEY;

  trace("vision fallback check", {
    azureFoundNothing,
    visionEnabled,
    enableVisionSegmentation,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    willRunVision: visionEnabled
  });

  if (enableVisionSegmentation && process.env.OPENAI_API_KEY) {
    const pageCount = result.pages?.length ?? 0;

    // Find pages with no diagram candidates yet
    const pagesWithoutDiagrams: number[] = [];
    for (let i = 1; i <= pageCount; i++) {
      if (!pagesWithDiagrams.has(i)) {
        pagesWithoutDiagrams.push(i);
      }
    }

    // Limit to maxVisionPages to control cost
    const pagesToScan = pagesWithoutDiagrams.slice(0, maxVisionPages);

    trace("vision segmentation page selection", {
      pagesWithoutDiagrams: pagesWithoutDiagrams.length,
      pagesToScan: pagesToScan.length,
      maxVisionPages,
      pages: pagesToScan
    });

    if (pagesToScan.length > 0) {
      console.log(
        `[diagramDetection] Vision segmentation enabled, scanning ${pagesToScan.length} page(s) ` +
        `without Azure diagrams (limit: ${maxVisionPages})`
      );

      try {
        // Compute debug output directory if debug mode is enabled
        const visionDebugOutputDir = options.visionDebug
          ? path.join(options.outDir, "debug", "vision")
          : undefined;

        // Build options for vision segmentation
        const detectOptions: DetectDiagramRegionsMultiPageOptions = {
          pdfPath: sourceFilePath,
          pages: pagesToScan,
          outDir,
          debug,
          visionDebugOptions: visionDebugOutputDir
            ? {
                enabled: true,
                outputDir: visionDebugOutputDir,
                debug,
              }
            : undefined,
        };

        // Lazy-load vision segmentation module only when needed
        // This avoids loading pdfjs-dist and canvas during Next.js page compilation
        const { detectDiagramRegionsMultiPage } = await import("./visionDiagramSegmentation");
        const visionResults = await detectDiagramRegionsMultiPage(detectOptions);

        trace("vision segmentation results", {
          pagesProcessed: visionResults.length,
          totalRegionsFound: visionResults.reduce((sum, r) => sum + r.regions.length, 0)
        });

        for (const pageResult of visionResults) {
          const { page: pageNumber, regions } = pageResult;

          for (const region of regions) {
            const diagramId = nextId("diagram");

            // Convert Vision pixel coordinates to a normalized bounding box format
            // that extractDiagramImages can use
            const boundingBox = {
              pageNumber,
              polygon: [
                region.x, region.y,
                region.x + region.width, region.y,
                region.x + region.width, region.y + region.height,
                region.x, region.y + region.height,
              ],
              // Store original pixel coordinates for reference
              _visionPixels: { x: region.x, y: region.y, width: region.width, height: region.height },
              _visionPageImage: pageResult.imagePath,
            };

            diagrams.push({
              id: diagramId,
              sectionPath: [`Page ${pageNumber}`],
              title: region.label || `Diagram on page ${pageNumber}`,
              imagePath: "",
              description: undefined,
              sourcePdf,
              page: pageNumber,
              origin,
              quality: "ok", // Default quality for Vision-detected diagrams
              sourceImagePath: origin === "image_normalized" ? sourceFilePath : pageResult.imagePath,
              rawCaptionText: undefined,
              boundingBox,
              source: "vision_segment",
            });

            visionSegmentCount++;
            pagesWithDiagrams.add(pageNumber);

            if (debug) {
              console.log(
                `[diagramDetection] Vision segment ${diagramId} on page ${pageNumber}: ` +
                `"${region.label}" at (${region.x}, ${region.y}, ${region.width}x${region.height})`
              );
            }
          }
        }
      } catch (err) {
        console.warn(
          "[diagramDetection] Vision segmentation encountered an unexpected error. " +
          "Continuing without vision-based diagrams for this job.",
          err
        );
        trace("vision segmentation unexpected error", { error: String(err) });
        // Job continues - vision segmentation is best-effort
      }
    } else if (debug) {
      console.log("[diagramDetection] No pages without Azure diagrams; skipping Vision segmentation");
      trace("vision segmentation skipped", { reason: "no_pages_without_diagrams" });
    }
  } else if (debug && enableVisionSegmentation) {
    console.log("[diagramDetection] Vision segmentation requested but OPENAI_API_KEY not set");
    trace("vision segmentation skipped", { reason: "no_openai_key" });
  }

  trace("pass 3 complete (Vision-Based Segmentation)", { foundCount: visionSegmentCount });

  // ===== SUMMARY =====
  console.log(
    `[diagramDetection] Total diagrams: ${diagrams.length} ` +
    `(${azureFigureCount} azure_figure, ${azureImageCount} azure_image, ${visionSegmentCount} vision_segment)`
  );

  return diagrams;
}

/**
 * Legacy synchronous wrapper for backward compatibility
 * Use detectDiagrams() instead for new code with Vision support
 */
export function detectDiagramsSync(
  result: AnalyzeResult,
  sourcePdf: string,
  origin: DocumentOrigin,
  sourceFilePath?: string
): DiagramAsset[] {
  // Only Azure figures, synchronous
  const diagrams: DiagramAsset[] = [];
  const figures = (result as any).figures;

  if (!figures || !Array.isArray(figures) || figures.length === 0) {
    return diagrams;
  }

  for (const figure of figures) {
    const boundingRegion = figure.boundingRegions?.[0];
    if (!boundingRegion) continue;

    const pageNumber = boundingRegion.pageNumber ?? 1;
    const rawCaptionText = extractCaptionFromParagraphs(result, pageNumber);
    const confidence = (figure as any).confidence as number | undefined;
    const quality = classifyDiagramQuality(confidence);

    let title: string | undefined;
    if (rawCaptionText) {
      const match = rawCaptionText.match(/^(Figure|Fig\.?|Diagram|Image)\s+([\dA-Z][\dA-Z.-]*)/i);
      if (match) {
        title = match[0].trim();
      }
    }

    diagrams.push({
      id: nextId("diagram"),
      sectionPath: [`Page ${pageNumber}`],
      title: title ?? `Diagram on page ${pageNumber}`,
      imagePath: "",
      description: undefined,
      sourcePdf,
      page: pageNumber,
      origin,
      quality,
      sourceImagePath: origin === "image_normalized" ? sourceFilePath : undefined,
      rawCaptionText,
      boundingBox: boundingRegion,
      source: "azure_figure",
    });
  }

  return diagrams;
}
