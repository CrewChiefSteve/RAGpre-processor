/**
 * Phase B: Universal Loader + Multi-Extractor Text Layer
 * Phase C: Structure Detection + Compiler
 * Public API exports
 */

// Types
export * from "./types";

// Phase B: Loader
export { loadDocument, type LoadDocumentOptions } from "./loader";

// Phase B: Extractors
export { extractPageTextWithAzure, type AzureExtractorOptions } from "./extractors/azureTextExtractor";
export { extractPageTextWithPdfJs, type PdfJsExtractorOptions } from "./extractors/pdfjsTextExtractor";

// Phase B: Multi-extractor orchestrator
export { extractPageText, type MultiExtractorOptions } from "./pageTextExtractor";

// Phase C: Structure detection and compilation
export {
  detectStructureCandidates,
  normalizeSectionLabel,
  calculateSectionLevel,
  type SectionCandidate,
  type RuleCandidate,
} from "./structure/sectionRuleDetector";

export {
  refineStructureWithLLM,
  type RefinedSection,
  type RefinedRule,
} from "./structure/llmStructureRefiner";

export {
  compileStructure,
  flattenSectionHierarchy,
  type CompiledStructure,
} from "./structure/structureCompiler";

// Phase D: Rendering & Diagrams
export {
  renderPdfPagesToPngs,
  renderSinglePageToPng,
  type RenderPageOptions,
  type RenderedPageInfo,
  type RenderPdfPagesToPngsOptions,
  type RenderSinglePageToPngOptions,
} from "./render/pdfRenderer";

export {
  segmentAndStoreDiagrams,
  type SegmentDiagramsOptions,
  type SegmentDiagramsResult,
  type DiagramRegion,
} from "./diagrams/diagramSegmenter";

export {
  explainDiagrams,
  type ExplainDiagramsOptions,
  type ExplainDiagramsResult,
} from "./diagrams/diagramExplainer";

// Phase E: Tables + Chunking + Embeddings
export {
  extractTables,
  type ExtractTablesOptions,
  type ExtractTablesResult,
} from "./tables/tableExtractor";

export {
  generateChunksForRulebook,
  type GenerateChunksOptions,
  type GenerateChunksResult,
} from "./chunking/chunkBuilder";

export {
  embedAllChunks,
  bufferToEmbedding,
  type EmbedAllChunksOptions,
  type EmbedAllChunksResult,
} from "./embeddings/embedder";
