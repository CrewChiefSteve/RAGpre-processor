export type ChunkConfig = {
  maxChars: number;
  overlap: number;
};

export function chunkText(
  text: string,
  { maxChars, overlap }: ChunkConfig
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    if (end === text.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks;
}
