import fs from "fs";
import path from "path";

const TRACE_FILE = path.join(process.cwd(), "out/trace.log");

export function trace(label: string, data?: unknown) {
  const line = `[${new Date().toISOString()}] ${label}${data !== undefined ? `: ${JSON.stringify(data)}` : ""}\n`;
  try {
    // Ensure out directory exists
    const dir = path.dirname(TRACE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(TRACE_FILE, line);
  } catch (err) {
    // Fallback: if we can't write to out/, try current directory
    const fallback = path.join(process.cwd(), "trace.log");
    fs.appendFileSync(fallback, line);
  }
}
