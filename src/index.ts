#!/usr/bin/env node
import path from "path";
import { randomUUID } from "crypto";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { runPipeline } from "./pipeline";
import { FileLogger } from "./fileLogger";

const argv = yargs(hideBin(process.argv))
  .command(
    "$0 <input>",
    "Preprocess a PDF or image into narrative, tables, and diagram assets",
    (y) =>
      y
        .positional("input", {
          type: "string",
          describe: "Path to input PDF or image (JPG, PNG, HEIC, etc.)"
        })
        .option("outDir", {
          type: "string",
          default: "out",
          describe: "Output directory"
        })
        .option("tempDir", {
          type: "string",
          default: "temp",
          describe: "Temp directory for normalized images"
        })
        .option("handwritingVision", {
          type: "boolean",
          default: false,
          describe: "Use vision model to transcribe handwriting for image-based inputs"
        })
        .option("captionDiagrams", {
          type: "boolean",
          default: false,
          describe: "Use vision model to caption diagram images"
        })
        .option("visionSegmentation", {
          type: "boolean",
          default: false,
          describe: "Use vision model to detect diagrams on pages without Azure diagrams"
        })
        .option("maxVisionPages", {
          type: "number",
          default: 20,
          describe: "Maximum number of pages to scan with vision segmentation"
        })
        .option("debugVision", {
          type: "boolean",
          default: false,
          describe: "Enable vision debug mode (save rendered page PNGs, diagram overlays, and segmentation JSON under debug/vision/)"
        }),
    async (args) => {
      const inputPath = path.resolve(args.input as string);
      const tempDir = path.resolve(args.tempDir as string);

      // Resolve outDir to absolute path for comparison
      let outDir = path.resolve(args.outDir as string);
      const defaultOutDir = path.resolve("out");

      // Detect execution mode:
      // 1. Web UI spawn: outDir contains "/jobs/" (e.g., "out/jobs/{cuid}")
      // 2. CLI standalone with default: outDir is default "out" -> create "out/jobs/{uuid}/"
      // 3. CLI standalone with custom: user specified custom path -> use as-is with log trace
      const isSpawnedByWeb = outDir.includes(path.sep + "jobs" + path.sep);
      const isDefaultOutDir = outDir === defaultOutDir;
      let jobId: string | null = null;
      let logger: FileLogger | undefined = undefined;

      if (isSpawnedByWeb) {
        // Web UI spawn mode - use provided outDir, no logger (web uses DB logging)
        console.log(`[CLI] Spawned by web UI mode`);
        console.log(`[CLI] Input: ${inputPath}`);
        console.log(`[CLI] Output dir: ${outDir}`);
      } else if (isDefaultOutDir) {
        // CLI standalone with default outDir - generate job ID and create job folder
        jobId = randomUUID();
        outDir = path.join(outDir, "jobs", jobId);

        console.log(`[CLI] Standalone mode - Job ID: ${jobId}`);
        console.log(`[CLI] Input: ${inputPath}`);
        console.log(`[CLI] Output dir: ${outDir}`);

        // Create file-based logger for standalone mode
        logger = new FileLogger(outDir);
        logger.info("cli", "CLI standalone job started", { jobId, inputPath, outDir });
      } else {
        // CLI standalone with custom outDir - use as-is but create log trace
        console.log(`[CLI] Standalone mode with custom output directory`);
        console.log(`[CLI] Input: ${inputPath}`);
        console.log(`[CLI] Output dir: ${outDir}`);

        // Create file-based logger for custom outDir
        logger = new FileLogger(outDir);
        logger.info("cli", "CLI standalone job started (custom outDir)", { inputPath, outDir });
      }

      try {
        const result = await runPipeline({
          inputPath,
          outDir,
          tempDir,
          handwritingVision: args.handwritingVision as boolean,
          captionDiagrams: args.captionDiagrams as boolean,
          enableVisionSegmentation: args.visionSegmentation as boolean,
          maxVisionPages: args.maxVisionPages as number,
          debug: false,
          visionDebug: args.debugVision as boolean,
          logger,
        });

        console.log(
          `[CLI] Quality distribution: ${result.stats.okCount} ok, ${result.stats.lowConfidenceCount} low_confidence, ${result.stats.handwritingCount} handwriting`
        );
        console.log(
          `[CLI] Routed to auto_ok: ${result.stats.okCount}, needs_review: ${
            result.stats.lowConfidenceCount + result.stats.handwritingCount
          }`
        );

        console.log("[CLI] Preprocessing complete.");

        if (logger) {
          logger.info("cli", "Job completed successfully", {
            okCount: result.stats.okCount,
            lowConfidenceCount: result.stats.lowConfidenceCount,
            handwritingCount: result.stats.handwritingCount,
          });
        }
      } catch (error) {
        console.error("[CLI] Pipeline failed:", error);
        if (logger) {
          logger.error("cli", "Job failed", { error: String(error) });
        }
        throw error;
      } finally {
        // Close logger and flush remaining logs
        if (logger) {
          logger.close();
        }
      }
    }
  )
  .help()
  .parse();
