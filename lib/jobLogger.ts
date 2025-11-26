import { prisma } from './db';

export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Create a logger for a specific job
 */
export function createJobLogger(jobId: string) {
  return {
    /**
     * Log a message to the database
     */
    async log(phase: string, level: LogLevel, message: string): Promise<void> {
      try {
        await prisma.log.create({
          data: {
            jobId,
            phase,
            level,
            message,
          },
        });
      } catch (error) {
        console.error(`Failed to write log for job ${jobId}:`, error);
      }
    },

    /**
     * Convenience methods
     */
    async info(phase: string, message: string): Promise<void> {
      return this.log(phase, 'info', message);
    },

    async warn(phase: string, message: string): Promise<void> {
      return this.log(phase, 'warn', message);
    },

    async error(phase: string, message: string): Promise<void> {
      return this.log(phase, 'error', message);
    },
  };
}
