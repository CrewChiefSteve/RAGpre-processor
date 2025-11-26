import path from 'path';
import { Job } from '@prisma/client';
import { runPipeline } from '../src/pipeline';
import type { JobOutputs, PhaseStatuses, ChunkOutput } from './types/job';

export interface PreprocessorResult {
  outputs: JobOutputs;
  phases: PhaseStatuses;
}

/**
 * Run the preprocessor pipeline for a given job
 * This adapter wraps the existing pipeline and returns results in the format expected by the job runner
 */
export async function runPreprocessorForJob(
  job: Job,
  onLog?: (phase: string, level: string, message: string) => Promise<void>
): Promise<PreprocessorResult> {
  const log = onLog || (async () => {});

  // Initialize phase statuses
  const phases: PhaseStatuses = {
    A: { status: 'not_started' },
    B: { status: 'not_started' },
    C: { status: 'not_started' },
    D: { status: 'not_started' },
  };

  try {
    // Validate job has uploaded file
    if (!job.uploadedFilePath) {
      throw new Error('Job does not have an uploaded file path');
    }

    // Create job-specific output directory
    const outputDir = path.join(process.cwd(), 'out', 'jobs', job.id);

    await log('system', 'info', `Starting preprocessing for job ${job.id}`);

    // Phase A: Input normalization
    phases.A = { status: 'running', startedAt: new Date().toISOString() };
    await log('A', 'info', 'Starting input normalization');

    // Phase B, C, D will be tracked by the pipeline
    // For now, we'll run the full pipeline and track completion
    const pipelineStart = Date.now();

    // Get vision segmentation settings from environment
    const enableVisionSegmentation = process.env.ENABLE_VISION_DIAGRAM_SEGMENTATION === "true";
    const maxVisionPages = parseInt(process.env.VISION_DIAGRAM_PAGE_LIMIT || "20", 10);

    const result = await runPipeline({
      inputPath: job.uploadedFilePath,
      outDir: outputDir,
      tempDir: path.join(process.cwd(), 'temp'),
      handwritingVision: job.handwritingVision,
      captionDiagrams: job.captionDiagrams,
      enableVisionSegmentation,
      maxVisionPages,
      debug: job.debug,
    });

    const pipelineEnd = Date.now();
    const duration = ((pipelineEnd - pipelineStart) / 1000).toFixed(2);

    // Mark all phases as completed
    const completedAt = new Date().toISOString();
    phases.A = { status: 'completed', startedAt: phases.A.startedAt, completedAt };
    phases.B = { status: 'completed', startedAt: phases.A.completedAt, completedAt };
    phases.C = { status: 'completed', startedAt: phases.B.completedAt, completedAt };

    // Phase D is optional
    if (job.handwritingVision || job.captionDiagrams) {
      phases.D = { status: 'completed', startedAt: phases.C.completedAt, completedAt };
    }

    await log('system', 'info', `Pipeline completed in ${duration}s`);
    await log('system', 'info', `Quality: ${result.stats.okCount} ok, ${result.stats.lowConfidenceCount} low_confidence, ${result.stats.handwritingCount} handwriting`);

    // Build chunks from narrative chunks
    const chunks: ChunkOutput[] = result.manifest.narrativeChunks.map((chunk: any, index: number) => ({
      id: chunk.id,
      order: index,
      text: chunk.text,
      tokenCount: chunk.text ? Math.ceil(chunk.text.split(/\s+/).length * 1.3) : 0, // rough estimate
      metadata: {
        sectionPath: chunk.sectionPath,
        pageRange: chunk.pageRange,
        quality: chunk.quality,
        origin: chunk.origin,
      },
    }));

    // TODO: Extract raw and cleaned text from pipeline
    // For now, we'll use the narrative chunks as the primary text
    const rawText = result.manifest.narrativeChunks
      .map((c: any) => c.text)
      .join('\n\n');

    const outputs: JobOutputs = {
      rawText,
      cleanedText: rawText, // TODO: differentiate raw vs cleaned
      chunks,
      manifest: result.manifest,
    };

    return {
      outputs,
      phases,
    };
  } catch (error: any) {
    await log('system', 'error', `Pipeline failed: ${error.message}`);

    // Mark the current phase as failed
    const failedPhase = Object.keys(phases).find(
      (key) => phases[key as keyof PhaseStatuses]?.status === 'running'
    ) as keyof PhaseStatuses | undefined;

    if (failedPhase) {
      const phase = phases[failedPhase];
      if (phase) {
        phase.status = 'failed';
        phase.completedAt = new Date().toISOString();
        phase.error = error.message;
      }
    } else {
      // If no phase was running, mark Phase A as failed
      phases.A = {
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: error.message,
      };
    }

    throw error;
  }
}
