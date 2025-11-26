// Job status types
export type JobStatus = "pending" | "running" | "completed" | "failed";

// Job configuration
export interface JobConfig {
  chunkSize: number;           // e.g. 800
  chunkOverlap: number;        // e.g. 150
  maxPages?: number;           // optional limit
  enableTables: boolean;       // table handling
  handwritingVision: boolean;  // Phase D feature toggle
  captionDiagrams: boolean;    // Phase D feature toggle
  debug: boolean;
}

// Phase status
export type PhaseStatusValue = "not_started" | "running" | "completed" | "failed";

export interface PhaseStatus {
  status: PhaseStatusValue;
  startedAt?: string;
  completedAt?: string;
  logs?: string[];             // phase-local logs
  error?: string | null;
}

// Phase statuses for all pipeline phases
export interface PhaseStatuses {
  A?: PhaseStatus; // normalization
  B?: PhaseStatus; // quality assessment/routing
  C?: PhaseStatus; // exports
  D?: PhaseStatus; // vision enrichment
}

// Complete job representation
export interface PreprocessJob {
  id: string;                  // UUID
  filename: string;
  status: JobStatus;
  config: JobConfig;
  documentType?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string | null;
  phases: PhaseStatuses;
  uploadedFilePath?: string;
  outputDir?: string;
}

// Chunk output
export interface ChunkOutput {
  id: string;
  order: number;
  text: string;
  tokenCount?: number;
  metadata?: Record<string, any>;
}

// Job outputs
export interface JobOutputs {
  rawText?: string;
  cleanedText?: string;
  chunks?: ChunkOutput[];
  manifest?: any;              // corresponds to manifest.json
}

// Settings
export interface Settings {
  id: number;
  chunkSize: number;
  chunkOverlap: number;
  maxPages?: number;
  enableTables: boolean;
  handwritingVision: boolean;
  captionDiagrams: boolean;
  debug: boolean;
  updatedAt: string;
}

// Helper function to convert DB job to PreprocessJob
export function dbJobToPreprocessJob(dbJob: any): PreprocessJob {
  const phases = dbJob.phasesJson ? JSON.parse(dbJob.phasesJson) : {};

  return {
    id: dbJob.id,
    filename: dbJob.filename,
    status: dbJob.status as JobStatus,
    config: {
      chunkSize: dbJob.chunkSize,
      chunkOverlap: dbJob.chunkOverlap,
      maxPages: dbJob.maxPages ?? undefined,
      enableTables: dbJob.enableTables,
      handwritingVision: dbJob.handwritingVision,
      captionDiagrams: dbJob.captionDiagrams,
      debug: dbJob.debug,
    },
    documentType: dbJob.documentType ?? undefined,
    createdAt: dbJob.createdAt.toISOString(),
    updatedAt: dbJob.updatedAt.toISOString(),
    startedAt: dbJob.startedAt?.toISOString(),
    completedAt: dbJob.completedAt?.toISOString(),
    error: dbJob.error ?? undefined,
    phases: phases,
    uploadedFilePath: dbJob.uploadedFilePath ?? undefined,
    outputDir: dbJob.outputDir ?? undefined,
  };
}

// Helper function to get job outputs
export function dbJobToOutputs(dbJob: any): JobOutputs {
  return dbJob.outputsJson ? JSON.parse(dbJob.outputsJson) : {};
}
