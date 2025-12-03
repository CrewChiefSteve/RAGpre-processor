import { prisma } from './db';
import { runPreprocessorForJob } from './preprocessorAdapter';
import { createJobLogger } from './jobLogger';

export interface JobRunnerConfig {
  pollInterval?: number; // milliseconds between checks for new jobs
  concurrency?: number;  // number of jobs to process concurrently (future: for now always 1)
}

class JobRunner {
  private isRunning: boolean = false;
  private pollInterval: number;
  private currentJobId: string | null = null;

  constructor(config: JobRunnerConfig = {}) {
    this.pollInterval = config.pollInterval || 5000; // default 5 seconds
  }

  /**
   * Start the job runner
   */
  start(): void {
    if (this.isRunning) {
      console.log('[JobRunner] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[JobRunner] Started');
    this.scheduleNextCheck();
  }

  /**
   * Stop the job runner
   */
  stop(): void {
    this.isRunning = false;
    console.log('[JobRunner] Stopped');
  }

  /**
   * Get the current job ID being processed
   */
  getCurrentJobId(): string | null {
    return this.currentJobId;
  }

  /**
   * Schedule the next check for pending jobs
   */
  private scheduleNextCheck(): void {
    if (!this.isRunning) return;

    setTimeout(async () => {
      await this.checkForJobs();
      this.scheduleNextCheck();
    }, this.pollInterval);
  }

  /**
   * Check for pending jobs and process them
   */
  private async checkForJobs(): Promise<void> {
    // Skip if already processing a job
    if (this.currentJobId) {
      return;
    }

    try {
      // Find the oldest pending job
      const pendingJob = await prisma.job.findFirst({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
      });

      if (!pendingJob) {
        return;
      }

      console.log(`[JobRunner] Found pending job: ${pendingJob.id}`);

      // Update job status to running
      await prisma.job.update({
        where: { id: pendingJob.id },
        data: {
          status: 'running',
          startedAt: new Date(),
        },
      });

      // Process the job
      await this.processJob(pendingJob.id);
    } catch (error) {
      console.error('[JobRunner] Error checking for jobs:', error);
    }
  }

  /**
   * Process a single job
   */
  async processJob(jobId: string): Promise<void> {
    this.currentJobId = jobId;
    const logger = createJobLogger(jobId);

    try {
      console.log(`[JobRunner] Processing job ${jobId}`);

      // Get the job from database
      const job = await prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        console.error(`[JobRunner] Job ${jobId} not found in database`);
        return;
      }

      await logger.info('system', 'Job started');

      // Run the preprocessor
      const result = await runPreprocessorForJob(job, async (phase, level, message) => {
        await logger.log(phase, level as any, message);
      });

      // Update job with results
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          phasesJson: JSON.stringify(result.phases),
          outputsJson: JSON.stringify(result.outputs),
        },
      });

      await logger.info('system', 'Job completed successfully');
      console.log(`[JobRunner] Job ${jobId} completed`);
    } catch (error: any) {
      console.error(`[JobRunner] Job ${jobId} failed:`, error);

      // Update job status to failed
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: error.message || 'Unknown error',
        },
      });

      await logger.error('system', `Job failed: ${error.message}`);
    } finally {
      this.currentJobId = null;
    }
  }
}

// Singleton instance
let jobRunnerInstance: JobRunner | null = null;

/**
 * Get the singleton job runner instance
 */
export function getJobRunner(config?: JobRunnerConfig): JobRunner {
  if (!jobRunnerInstance) {
    jobRunnerInstance = new JobRunner(config);
  }
  return jobRunnerInstance;
}

/**
 * Start the job runner (convenience function)
 */
export function startJobRunner(config?: JobRunnerConfig): JobRunner {
  const runner = getJobRunner(config);
  runner.start();
  return runner;
}

/**
 * Stop the job runner (convenience function)
 */
export function stopJobRunner(): void {
  if (jobRunnerInstance) {
    jobRunnerInstance.stop();
  }
}
