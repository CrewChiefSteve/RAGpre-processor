import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { prisma } from './db';
import { createJobLogger } from './jobLogger';

export interface JobRunnerConfig {
  pollInterval?: number; // milliseconds between checks for new jobs
  concurrency?: number;  // number of jobs to process concurrently (future: for now always 1)
}

// Track running processes for cleanup
const runningJobs = new Map<string, ChildProcess>();

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
   * Process a single job by spawning the CLI
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

      await logger.info('system', 'Job started - spawning CLI process');

      // Build CLI arguments
      const pdfPath = job.uploadedFilePath || path.join(process.cwd(), 'temp', 'uploads', job.filename);
      const outDir = job.outputDir || path.join(process.cwd(), 'out', 'jobs', jobId);

      const args = ['run', 'cli', pdfPath, '--outDir', outDir];

      // Add optional feature flags
      if (job.captionDiagrams) {
        args.push('--captionDiagrams');
      }
      if (job.handwritingVision) {
        args.push('--handwritingVision');
      }
      // Enable vision segmentation by default for web jobs
      args.push('--visionSegmentation');

      // Add debug flag if enabled
      if (job.debug) {
        args.push('--debugVision');
      }

      await logger.info('system', `CLI command: pnpm ${args.join(' ')}`);

      // Spawn the CLI process
      await this.spawnCLIProcess(jobId, args, logger);

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

  /**
   * Spawn the CLI process and capture output
   */
  private async spawnCLIProcess(
    jobId: string,
    args: string[],
    logger: ReturnType<typeof createJobLogger>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('pnpm', args, {
        cwd: process.cwd(),
        env: { ...process.env },
        shell: true, // Required on Windows
      });

      runningJobs.set(jobId, child);

      // Capture stdout
      child.stdout?.on('data', async (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          // Parse phase from CLI output and log accordingly
          const phase = this.parsePhaseFromOutput(line);
          await logger.info(phase, line);
        }
      });

      // Capture stderr
      child.stderr?.on('data', async (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          await logger.error('system', line);
        }
      });

      // Handle completion
      child.on('close', async (code) => {
        runningJobs.delete(jobId);

        const success = code === 0;

        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: success ? 'completed' : 'failed',
            completedAt: new Date(),
          },
        });

        await logger.info(
          'system',
          `CLI process exited with code ${code}`
        );

        if (success) {
          resolve();
        } else {
          reject(new Error(`CLI exited with code ${code}`));
        }
      });

      // Handle spawn errors
      child.on('error', async (error) => {
        runningJobs.delete(jobId);

        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'failed', completedAt: new Date() },
        });

        await logger.error('system', `Failed to spawn CLI: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Parse phase identifier from CLI output
   */
  private parsePhaseFromOutput(line: string): string {
    // Look for phase markers in CLI output
    if (line.includes('[Phase A]') || line.includes('normalizeInput')) {
      return 'A';
    } else if (line.includes('[Phase B]') || line.includes('routeContent')) {
      return 'B';
    } else if (line.includes('[Phase C]') || line.includes('table')) {
      return 'C';
    } else if (line.includes('[Phase D]') || line.includes('vision')) {
      return 'D';
    } else if (line.includes('analyzePdf') || line.includes('Azure')) {
      return 'azure';
    } else if (line.includes('diagram')) {
      return 'diagrams';
    } else {
      return 'system';
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

/**
 * Cancel a specific job
 */
export function cancelJob(jobId: string): boolean {
  const child = runningJobs.get(jobId);
  if (child) {
    child.kill('SIGTERM');
    runningJobs.delete(jobId);
    return true;
  }
  return false;
}

/**
 * Cancel all running jobs (for graceful shutdown)
 */
export function cancelAllJobs(): void {
  for (const [jobId, child] of runningJobs) {
    child.kill('SIGTERM');
    runningJobs.delete(jobId);
  }
}
