// src/debugTrace.ts
import fs from "fs";
import path from "path";

/**
 * Config
 */
const TRACE_ENABLED =
  process.env.TRACE_ENABLED === "1" ||
  process.env.TRACE_ENABLED === "true" ||
  process.env.NODE_ENV === "development";

const LOG_TO_FILE =
  process.env.TRACE_TO_FILE !== "0" &&
  process.env.TRACE_TO_FILE !== "false";

const LOG_DIR =
  process.env.TRACE_LOG_DIR ||
  path.join(process.cwd(), "out", "logs");

/**
 * Create log file path on first import
 */
let logFilePath: string | null = null;

function ensureLogFile() {
  if (!LOG_TO_FILE) return null;

  if (logFilePath) return logFilePath;

  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");

  logFilePath = path.join(LOG_DIR, `trace-${timestamp}.log`);
  return logFilePath;
}

/**
 * Internal writer
 */
function writeLine(
  level: "debug" | "info" | "warn" | "error",
  namespace: string | null,
  msg: string,
  meta?: any
) {
  if (!TRACE_ENABLED) return;

  const time = new Date().toISOString();
  const ns = namespace ? `[${namespace}]` : "";
  const metaStr =
    meta !== undefined
      ? " " +
        JSON.stringify(meta, (_k, value) =>
          value instanceof Error
            ? { message: value.message, stack: value.stack }
            : value
        )
      : "";

  const line = `${time} ${level.toUpperCase()} ${ns} ${msg}${metaStr}\n`;

  // Console output
  if (level === "error") console.error(line.trim());
  else if (level === "warn") console.warn(line.trim());
  else if (level === "info") console.info?.(line.trim());
  else console.debug(line.trim());

  // File output
  const logPath = ensureLogFile();
  if (logPath) {
    try {
      fs.appendFileSync(logPath, line);
    } catch (err) {
      console.warn(
        "[debugTrace] Failed to write to trace log file:",
        (err as any)?.message || err
      );
    }
  }
}

/**
 * Trace function with namespaces
 */
export type TraceFn = ((msg: string, meta?: any) => void) & {
  extend: (namespace: string) => TraceFn;
};

function createTrace(namespace: string | null): TraceFn {
  const fn = ((msg: string, meta?: any) => {
    writeLine("debug", namespace, msg, meta);
  }) as TraceFn;

  fn.extend = (childNs: string) => {
    const combined = namespace ? `${namespace}:${childNs}` : childNs;
    return createTrace(combined);
  };

  return fn;
}

/**
 * Public exports
 */
export const trace: TraceFn = createTrace(null);

export const traceInfo = (msg: string, meta?: any) =>
  writeLine("info", null, msg, meta);

export const traceWarn = (msg: string, meta?: any) =>
  writeLine("warn", null, msg, meta);

export const traceError = (msg: string, meta?: any) =>
  writeLine("error", null, msg, meta);

export { logFilePath };
