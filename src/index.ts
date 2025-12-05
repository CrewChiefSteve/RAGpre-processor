#!/usr/bin/env node
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { runPipeline } from "./pipeline";

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
      const outDir = path.resolve(args.outDir as string);
      const tempDir = path.resolve(args.tempDir as string);

      console.log(`[CLI] Input: ${inputPath}`);
      console.log(`[CLI] Output dir: ${outDir}`);

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
    }
  )
  .help()
  .parse();
