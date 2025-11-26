import path from "path";
import { writeTextFile } from "./utils/fsUtils";
import { chunkText } from "./utils/chunkText";
import type { NarrativeChunk, ContentQuality } from "./types";

/**
 * Phase B: Combine multiple quality signals using "worst quality wins" logic.
 * Priority: handwriting > low_confidence > ok
 */
function combineQuality(qualities: ContentQuality[]): ContentQuality {
  if (qualities.includes("handwriting")) return "handwriting";
  if (qualities.includes("low_confidence")) return "low_confidence";
  return "ok";
}

export async function exportNarrative(
  narrativeBlocks: NarrativeChunk[],
  outDir: string
): Promise<NarrativeChunk[]> {
  console.log(`[exportNarrative] Blocks: ${narrativeBlocks.length}`);

  // For now, group by sectionPath string
  const grouped = new Map<string, NarrativeChunk[]>();

  for (const block of narrativeBlocks) {
    const key = block.sectionPath.join(" > ");
    const list = grouped.get(key) ?? [];
    list.push(block);
    grouped.set(key, list);
  }

  const finalChunks: NarrativeChunk[] = [];

  for (const [sectionKey, blocks] of grouped.entries()) {
    const combinedText = blocks.map((b) => b.text).join("\n\n");
    const chunks = chunkText(combinedText, {
      maxChars: 4000, // tune later
      overlap: 500
    });

    // Phase B: Determine group quality using "worst quality wins"
    const qualities = blocks.map((b) => b.quality);
    const groupQuality = combineQuality(qualities);

    chunks.forEach((chunkText, index) => {
      const fileNameSafe = sectionKey.replace(/[^\w\d]+/g, "_");

      // Phase B: Route based on quality
      const qualityBucket =
        groupQuality === "ok" ? "auto_ok" : "needs_review";

      const filePath = path.join(
        outDir,
        qualityBucket,
        "narrative",
        `${fileNameSafe}_${index + 1}.md`
      );

      writeTextFile(filePath, chunkText);

      finalChunks.push({
        id: `${fileNameSafe}_${index + 1}`,
        sectionPath: sectionKey.split(" > "),
        text: chunkText,
        sourcePdf: blocks[0].sourcePdf,
        pageRange: blocks[0].pageRange,
        origin: blocks[0].origin,
        quality: groupQuality
      });
    });
  }

  console.log(`[exportNarrative] Wrote ${finalChunks.length} markdown chunks.`);
  return finalChunks;
}
