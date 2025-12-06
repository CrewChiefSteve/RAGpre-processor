/**
 * Test script for Phase E: Tables + Chunking + Embeddings
 */

import { PrismaClient } from "@prisma/client";
import { runPipeline } from "./src/pipeline";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const prisma = new PrismaClient();

  try {
    // Test PDF path
    const testPdfPath = path.join(
      __dirname,
      "temp",
      "uploads",
      "1764934715784-SVRA-General-Rules-1_25.pdf"
    );

    console.log("=== Phase E Test Script ===\n");
    console.log(`Test PDF: ${testPdfPath}\n`);

    // Create a test rulebook entry
    const rulebook = await prisma.rulebook.create({
      data: {
        title: "SVRA General Rules Test",
        series: "SVRA",
        year: 2025,
        version: "1.25",
        fileKey: testPdfPath,
      },
    });

    console.log(`Created rulebook: ${rulebook.id}\n`);

    // Run pipeline with Phase E enabled
    const result = await runPipeline({
      inputPath: testPdfPath,
      outDir: path.join(__dirname, "out", "phase-e-test"),
      prisma,
      rulebookId: rulebook.id,
      skipStructureCompilation: false,
      skipDiagrams: false,
      skipChunking: false,
      skipEmbeddings: false, // Enable embeddings (requires OPENAI_API_KEY)
      embeddingModel: "text-embedding-3-large",
      embeddingBatchSize: 64,
    });

    console.log("\n=== Phase E Test Results ===\n");

    // Check table count
    const tableCount = await prisma.table.count({
      where: { rulebookId: rulebook.id },
    });
    console.log(`Tables extracted: ${tableCount}`);

    // Check chunk count
    const chunkCount = await prisma.chunk.count({
      where: { rulebookId: rulebook.id },
    });
    console.log(`Chunks created: ${chunkCount}`);

    // Check chunk breakdown
    const chunksByType = await prisma.chunk.groupBy({
      by: ["type"],
      where: { rulebookId: rulebook.id },
      _count: { type: true },
    });

    console.log("\nChunk breakdown:");
    for (const group of chunksByType) {
      console.log(`  ${group.type}: ${group._count.type}`);
    }

    // Check embedding count
    const embeddedCount = await prisma.chunk.count({
      where: {
        rulebookId: rulebook.id,
        embedding: { not: null },
      },
    });
    console.log(`\nChunks with embeddings: ${embeddedCount}`);

    // Sample a few chunks
    const sampleChunks = await prisma.chunk.findMany({
      where: { rulebookId: rulebook.id },
      take: 3,
      include: {
        rule: { select: { code: true } },
        section: { select: { label: true, title: true } },
      },
    });

    console.log("\n=== Sample Chunks ===\n");
    for (const chunk of sampleChunks) {
      console.log(`Type: ${chunk.type}`);
      if (chunk.rule) {
        console.log(`Rule: ${chunk.rule.code}`);
      }
      if (chunk.section) {
        console.log(`Section: ${chunk.section.label} - ${chunk.section.title}`);
      }
      console.log(`Text (first 200 chars): ${chunk.text.substring(0, 200)}...`);
      console.log(`Token count: ${chunk.tokenCount}`);
      console.log(`Has embedding: ${chunk.embedding ? "Yes" : "No"}`);
      console.log("---\n");
    }

    console.log("\n=== Phase E Test Complete ===\n");
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
