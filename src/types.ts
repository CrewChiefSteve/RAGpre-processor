export type SectionPath = string[]; // e.g. ["3 Suspension", "3.2 Front Suspension"]

export type DocumentOrigin = "pdf_digital" | "image_normalized";

// Phase B: Content quality signal for routing
export type ContentQuality = "ok" | "low_confidence" | "handwriting";

export type NarrativeChunk = {
  id: string;
  sectionPath: SectionPath;
  text: string;
  sourcePdf: string;
  pageRange?: [number, number];
  origin: DocumentOrigin;
  quality: ContentQuality; // Phase B: content quality for routing
  sourceImagePath?: string; // Phase D: for image_normalized docs
};

export type TableAsset = {
  id: string;
  sectionPath: SectionPath;
  title?: string;
  csvPath: string;
  description: string;
  sourcePdf: string;
  pageRange?: [number, number];
  origin: DocumentOrigin;
  quality: ContentQuality; // Phase B: content quality for routing

  // Phase C: Table merging & dimension metadata
  headerSignature?: string;    // normalized header row (used for grouping)
  headerRow?: string[];        // actual header cells
  rowCount?: number;           // total data rows (excluding header)
  columnCount?: number;        // number of columns
};

export type DiagramSource = "azure_figure" | "azure_image" | "vision_segment";

export type DiagramAsset = {
  id: string;
  sectionPath: SectionPath;
  title?: string;
  imagePath: string;
  description?: string; // you'll fill this after captioning
  sourcePdf: string;
  page?: number;
  origin: DocumentOrigin;
  quality: ContentQuality; // Phase B: content quality for routing
  sourceImagePath?: string; // Phase D: for image-based diagrams
  rawCaptionText?: string; // Phase D: text from nearby paragraphs ("Figure 3.2 ...")
  boundingBox?: any; // Azure BoundingRegion with polygon coordinates
  source?: DiagramSource; // Phase B+: detection source (azure_figure, azure_image, vision_segment)
};

export type RoutedContent = {
  narrativeBlocks: NarrativeChunk[]; // before chunking
  tables: TableAsset[];
  diagrams: DiagramAsset[];
};
