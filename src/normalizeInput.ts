import path from "path";
import sharp from "sharp";

export type NormalizedInput = {
  normalizedPath: string;
  origin: "pdf_digital" | "image_normalized";
};

export async function normalizeInput(
  inputPath: string,
  workDir: string
): Promise<NormalizedInput> {
  const ext = path.extname(inputPath).toLowerCase();

  // Case 1: PDF - return as-is
  if (ext === ".pdf") {
    console.log(`[normalizeInput] Detected PDF (digital): ${inputPath}`);
    return {
      normalizedPath: inputPath,
      origin: "pdf_digital"
    };
  }

  // Case 2: Image-like extensions
  const imageExtensions = [".jpg", ".jpeg", ".png", ".heic", ".webp", ".tiff", ".tif"];

  if (imageExtensions.includes(ext)) {
    console.log(`[normalizeInput] Detected image: ${inputPath}`);

    const base = path.basename(inputPath, ext);
    const outputPath = path.join(workDir, `normalized_${base}.png`);

    // Normalize image: auto-rotate, grayscale, mild contrast boost
    await sharp(inputPath)
      .rotate() // auto-rotate by EXIF
      .grayscale()
      .linear(1.2, -(128 * 1.2) + 128) // small contrast boost
      .toFile(outputPath);

    console.log(`[normalizeInput] Normalized image written to: ${outputPath}`);

    return {
      normalizedPath: outputPath,
      origin: "image_normalized"
    };
  }

  // Case 3: Unknown extension
  throw new Error(
    `[normalizeInput] Unsupported file extension: ${ext}. Expected .pdf or image formats (jpg, png, heic, etc.)`
  );
}
