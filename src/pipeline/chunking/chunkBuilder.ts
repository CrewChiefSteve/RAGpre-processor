/**
 * Phase E: Chunk Generation
 * Creates RAG-ready text chunks for rules, sections, tables, and diagrams
 */

import { PrismaClient } from "@prisma/client";

export interface GenerateChunksOptions {
  rulebookId: string;
  prisma: PrismaClient;
}

export interface GenerateChunksResult {
  count: number;
  breakdown: {
    rules: number;
    narratives: number;
    tables: number;
    diagrams: number;
  };
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 chars)
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate RULE chunks - one per rule with related diagrams
 */
async function generateRuleChunks(
  prisma: PrismaClient,
  rulebookId: string
): Promise<number> {
  const rules = await prisma.rule.findMany({
    where: { rulebookId },
    include: {
      diagrams: {
        select: {
          id: true,
          publicUrl: true,
          caption: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });

  let count = 0;

  for (const rule of rules) {
    // Build rule text
    let text = `${rule.code}`;
    if (rule.title) {
      text += ` ${rule.title}`;
    }
    text += `\n\n${rule.text}`;

    // Add related diagrams
    if (rule.diagrams.length > 0) {
      text += `\n\nRelated diagrams:`;
      for (const diagram of rule.diagrams) {
        if (diagram.publicUrl) {
          text += `\n - ${diagram.publicUrl}`;
          if (diagram.caption) {
            text += ` (${diagram.caption})`;
          }
        }
      }
    }

    // Create chunk
    await prisma.chunk.create({
      data: {
        rulebookId,
        ruleId: rule.id,
        sectionId: rule.sectionId,
        type: "RULE",
        pageStart: rule.pageStart,
        pageEnd: rule.pageEnd,
        text,
        tokenCount: estimateTokenCount(text),
      },
    });

    count++;
  }

  return count;
}

/**
 * Generate NARRATIVE chunks - section intros without rules
 * For simplicity, we create one chunk per section that contains narrative text
 */
async function generateNarrativeChunks(
  prisma: PrismaClient,
  rulebookId: string
): Promise<number> {
  const sections = await prisma.section.findMany({
    where: { rulebookId },
    orderBy: { pageStart: "asc" },
  });

  let count = 0;

  for (const section of sections) {
    // Create a simple narrative chunk for the section
    let text = "";

    if (section.label) {
      text += `Section ${section.label}`;
    }

    if (section.title) {
      text += section.label ? `: ${section.title}` : section.title;
    }

    // Skip if no meaningful content
    if (!text.trim()) {
      continue;
    }

    // Create chunk
    await prisma.chunk.create({
      data: {
        rulebookId,
        sectionId: section.id,
        type: "NARRATIVE",
        pageStart: section.pageStart,
        pageEnd: section.pageEnd,
        text,
        tokenCount: estimateTokenCount(text),
      },
    });

    count++;
  }

  return count;
}

/**
 * Generate TABLE chunks - markdown tables with optional interpretation
 */
async function generateTableChunks(
  prisma: PrismaClient,
  rulebookId: string
): Promise<number> {
  const tables = await prisma.table.findMany({
    where: { rulebookId },
    orderBy: { page: "asc" },
  });

  let count = 0;

  for (const table of tables) {
    if (!table.markdown) {
      continue;
    }

    // Build table chunk text
    let text = table.markdown;

    // Add context about location
    if (table.page) {
      text += `\n\n(Table from page ${table.page})`;
    }

    // Create chunk
    await prisma.chunk.create({
      data: {
        rulebookId,
        tableId: table.id,
        ruleId: table.ruleId,
        sectionId: table.sectionId,
        type: "TABLE",
        pageStart: table.page,
        pageEnd: table.page,
        text,
        tokenCount: estimateTokenCount(text),
      },
    });

    count++;
  }

  return count;
}

/**
 * Generate DIAGRAM_CAPTION chunks - caption + explanation + tags
 */
async function generateDiagramChunks(
  prisma: PrismaClient,
  rulebookId: string
): Promise<number> {
  const diagrams = await prisma.diagram.findMany({
    where: { rulebookId },
    orderBy: { page: "asc" },
  });

  let count = 0;

  for (const diagram of diagrams) {
    // Build diagram chunk text
    let text = "";

    if (diagram.caption) {
      text += diagram.caption;
    }

    if (diagram.explanation) {
      text += text ? `\n\n${diagram.explanation}` : diagram.explanation;
    }

    // Add tags if available
    if (diagram.tags) {
      try {
        const tags = JSON.parse(diagram.tags);
        if (Array.isArray(tags) && tags.length > 0) {
          text += `\n\nTags: ${tags.join(", ")}`;
        }
      } catch (err) {
        // Ignore invalid JSON
      }
    }

    // Add reference to rule if available
    if (diagram.refersToRuleCode) {
      text += `\n\nRefers to rule: ${diagram.refersToRuleCode}`;
    }

    // Add image URL if available
    if (diagram.publicUrl) {
      text += `\n\nImage: ${diagram.publicUrl}`;
    }

    // Skip if no meaningful content
    if (!text.trim()) {
      continue;
    }

    // Add page context
    if (diagram.page) {
      text += `\n\n(Diagram from page ${diagram.page})`;
    }

    // Create chunk
    await prisma.chunk.create({
      data: {
        rulebookId,
        diagramId: diagram.id,
        ruleId: diagram.ruleId,
        sectionId: diagram.sectionId,
        type: "DIAGRAM_CAPTION",
        pageStart: diagram.page,
        pageEnd: diagram.page,
        text,
        tokenCount: estimateTokenCount(text),
      },
    });

    count++;
  }

  return count;
}

/**
 * Generate all chunks for a rulebook
 */
export async function generateChunksForRulebook(
  options: GenerateChunksOptions
): Promise<GenerateChunksResult> {
  const { rulebookId, prisma } = options;

  console.log(`[chunks] Generating chunks for rulebook ${rulebookId}...`);

  // Delete existing chunks to allow re-generation
  await prisma.chunk.deleteMany({
    where: { rulebookId },
  });

  // Generate each type of chunk
  const ruleCount = await generateRuleChunks(prisma, rulebookId);
  console.log(`[chunks] Created ${ruleCount} RULE chunk(s)`);

  const narrativeCount = await generateNarrativeChunks(prisma, rulebookId);
  console.log(`[chunks] Created ${narrativeCount} NARRATIVE chunk(s)`);

  const tableCount = await generateTableChunks(prisma, rulebookId);
  console.log(`[chunks] Created ${tableCount} TABLE chunk(s)`);

  const diagramCount = await generateDiagramChunks(prisma, rulebookId);
  console.log(`[chunks] Created ${diagramCount} DIAGRAM_CAPTION chunk(s)`);

  const totalCount = ruleCount + narrativeCount + tableCount + diagramCount;

  console.log(
    `[chunks] Generation complete: ${totalCount} chunk(s) total ` +
      `(rules: ${ruleCount}, narratives: ${narrativeCount}, tables: ${tableCount}, diagrams: ${diagramCount})`
  );

  return {
    count: totalCount,
    breakdown: {
      rules: ruleCount,
      narratives: narrativeCount,
      tables: tableCount,
      diagrams: diagramCount,
    },
  };
}
