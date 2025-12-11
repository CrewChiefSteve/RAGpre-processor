import fs from "fs";
import path from "path";
import { ensureDir } from "./utils/fsUtils.js";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  timestamp: string;
  phase: string;
  level: LogLevel;
  message: string;
  data?: Record<string, any>;
}

export interface PipelineLogger {
  log(phase: string, level: LogLevel, message: string, data?: Record<string, any>): void;
  debug(phase: string, message: string, data?: Record<string, any>): void;
  info(phase: string, message: string, data?: Record<string, any>): void;
  warn(phase: string, message: string, data?: Record<string, any>): void;
  error(phase: string, message: string, data?: Record<string, any>): void;
  flush(): void;
}

/**
 * File-based logger for CLI standalone mode
 * Writes JSON-lines log to {outDir}/log-trace.jsonl
 */
export class FileLogger implements PipelineLogger {
  private logPath: string;
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(outDir: string) {
    ensureDir(outDir);
    this.logPath = path.join(outDir, "log-trace.jsonl");

    // Auto-flush every 100ms to keep logs updated
    this.flushInterval = setInterval(() => this.flush(), 100);
  }

  log(phase: string, level: LogLevel, message: string, data?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      phase,
      level,
      message,
      ...(data && { data }),
    };

    this.buffer.push(entry);

    // Also log to console for immediate feedback
    const prefix = `${entry.timestamp} ${entry.level.padEnd(5)} `;
    console.log(`${prefix} ${message}`, data ? JSON.stringify(data) : "");
  }

  debug(phase: string, message: string, data?: Record<string, any>): void {
    this.log(phase, "DEBUG", message, data);
  }

  info(phase: string, message: string, data?: Record<string, any>): void {
    this.log(phase, "INFO", message, data);
  }

  warn(phase: string, message: string, data?: Record<string, any>): void {
    this.log(phase, "WARN", message, data);
  }

  error(phase: string, message: string, data?: Record<string, any>): void {
    this.log(phase, "ERROR", message, data);
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    const lines = this.buffer.map((entry) => JSON.stringify(entry)).join("\n") + "\n";

    try {
      fs.appendFileSync(this.logPath, lines, "utf8");
      this.buffer = [];
    } catch (error) {
      console.error(`Failed to write log trace to ${this.logPath}:`, error);
    }
  }

  /**
   * Stop auto-flush and flush remaining buffer
   */
  close(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }
}

/**
 * Console-only logger (used when no file logging is needed)
 */
export class ConsoleLogger implements PipelineLogger {
  log(phase: string, level: LogLevel, message: string, data?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const prefix = `${timestamp} ${level.padEnd(5)} `;
    console.log(`${prefix} ${message}`, data ? JSON.stringify(data) : "");
  }

  debug(phase: string, message: string, data?: Record<string, any>): void {
    this.log(phase, "DEBUG", message, data);
  }

  info(phase: string, message: string, data?: Record<string, any>): void {
    this.log(phase, "INFO", message, data);
  }

  warn(phase: string, message: string, data?: Record<string, any>): void {
    this.log(phase, "WARN", message, data);
  }

  error(phase: string, message: string, data?: Record<string, any>): void {
    this.log(phase, "ERROR", message, data);
  }

  flush(): void {
    // No-op for console logger
  }
}
