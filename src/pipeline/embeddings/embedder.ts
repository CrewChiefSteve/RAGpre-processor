/**
 * Phase E: Embedding Generation
 * Generates embeddings using OpenAI API and stores them as BLOBs
 */

import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

export interface EmbedAllChunksOptions {
  rulebookId: string;
  prisma: PrismaClient;
  model?: string;
  batchSize?: number;
}

export interface EmbedAllChunksResult {
  embedded: number;
  skipped: number;
}

/**
 * Convert embedding array to Buffer for storage in SQLite
 */
function embeddingToBuffer(embedding: number[]): Buffer {
  const float32Array = new Float32Array(embedding);
  return Buffer.from(float32Array.buffer);
}

/**
 * Embed all chunks for a rulebook
 */
export async function embedAllChunks(
  options: EmbedAllChunksOptions
): Promise<EmbedAllChunksResult> {
  const {
    rulebookId,
    prisma,
    model = "text-embedding-3-large",
    batchSize = 64,
  } = options;

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.log("[embedder] Skipping embeddings: OPENAI_API_KEY not set");
    return { embedded: 0, skipped: 0 };
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log(`[embedder] Generating embeddings for rulebook ${rulebookId}...`);
  console.log(`[embedder] Using model: ${model}, batch size: ${batchSize}`);

  // Load chunks with null embedding
  const chunks = await prisma.chunk.findMany({
    where: {
      rulebookId,
      embedding: null,
    },
    select: {
      id: true,
      text: true,
    },
  });

  if (chunks.length === 0) {
    console.log("[embedder] No chunks to embed");
    return { embedded: 0, skipped: 0 };
  }

  console.log(`[embedder] Found ${chunks.length} chunk(s) to embed`);

  let embeddedCount = 0;
  let skippedCount = 0;

  // Process in batches
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(chunks.length / batchSize);

    console.log(
      `[embedder] Processing batch ${batchNumber}/${totalBatches} (${batch.length} chunk(s))...`
    );

    try {
      // Extract texts for embedding
      const texts = batch.map((chunk) => chunk.text);

      // Call OpenAI embedding API
      const response = await openai.embeddings.create({
        model,
        input: texts,
      });

      // Store embeddings
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embeddingData = response.data[j];

        if (!embeddingData || !embeddingData.embedding) {
          console.warn(
            `[embedder] No embedding returned for chunk ${chunk.id.substring(0, 8)}...`
          );
          skippedCount++;
          continue;
        }

        // Convert embedding to buffer
        const embeddingBuffer = embeddingToBuffer(embeddingData.embedding);

        // Update chunk in database
        await prisma.chunk.update({
          where: { id: chunk.id },
          data: { embedding: embeddingBuffer },
        });

        embeddedCount++;
      }

      console.log(
        `[embedder] Batch ${batchNumber}/${totalBatches} complete: embedded ${batch.length} chunk(s)`
      );
    } catch (err) {
      console.error(
        `[embedder] Error processing batch ${batchNumber}/${totalBatches}:`,
        err
      );
      skippedCount += batch.length;
    }
  }

  console.log(
    `[embedder] Embedding complete: ${embeddedCount} chunk(s) embedded, ${skippedCount} skipped`
  );

  return {
    embedded: embeddedCount,
    skipped: skippedCount,
  };
}

/**
 * Helper to decode embedding from Buffer back to number array (for testing/retrieval)
 */
export function bufferToEmbedding(buffer: Buffer): number[] {
  const float32Array = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 4
  );
  return Array.from(float32Array);
}
