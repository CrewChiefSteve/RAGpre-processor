import type { NarrativeChunk } from "./types";
import { transcribeHandwritingImage } from "./visionClient";

export type HandwritingOptions = {
  enableVisionTranscription: boolean;
};

/**
 * For image-based inputs, if all/most chunks are handwriting or low_confidence,
 * optionally replace their text with a single vision-based transcription.
 *
 * Simple v1: treat the whole image as one note.
 */
export async function enrichHandwritingFromImage(
  chunks: NarrativeChunk[]
): Promise<NarrativeChunk[]> {
  if (chunks.length === 0) return chunks;

  const imageChunks = chunks.filter(
    (c) => c.origin === "image_normalized" && !!c.sourceImagePath
  );
  if (imageChunks.length === 0) {
    console.log("[handwritingPipeline] No image-based chunks found, skipping vision transcription");
    return chunks;
  }

  // Check if the majority of these are handwriting or low_confidence
  const problematic = imageChunks.filter(
    (c) => c.quality === "handwriting" || c.quality === "low_confidence"
  );

  if (problematic.length === 0) {
    console.log(
      `[handwritingPipeline] All ${imageChunks.length} image chunks have good quality, skipping vision transcription`
    );
    return chunks;
  }

  const primary = imageChunks[0];
  const imagePath = primary.sourceImagePath!;

  console.log(
    `[handwritingPipeline] Attempting vision transcription for ${imagePath}`
  );
  console.log(
    `[handwritingPipeline] Found ${problematic.length} problematic chunks out of ${imageChunks.length} image chunks`
  );

  const transcription = await transcribeHandwritingImage(imagePath);

  if (!transcription) {
    console.warn(
      `[handwritingPipeline] Vision transcription failed for ${imagePath}`
    );
    return chunks;
  }

  console.log(
    `[handwritingPipeline] Vision transcription successful (${transcription.length} chars)`
  );

  // Replace all image-based narrative with a single chunk representing the note
  const newChunk: NarrativeChunk = {
    ...primary,
    id: `${primary.id}_vision`,
    text: transcription,
    quality: "handwriting", // we know it's handwriting
    // keep origin/image info
  };

  // Keep non-image chunks unchanged
  const nonImageChunks = chunks.filter(
    (c) => c.origin !== "image_normalized"
  );

  return [...nonImageChunks, newChunk];
}
