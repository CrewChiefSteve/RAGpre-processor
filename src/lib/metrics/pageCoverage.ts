/**
 * Phase F: Page Coverage Metrics
 * Shows what was extracted from each page
 */

import { PrismaClient } from "@prisma/client";

export interface PageCoverage {
  page: number;
  hasText: boolean;
  rulesCount: number;
  tablesCount: number;
  diagramsCount: number;
  chunksCount: number;
}

/**
 * Get coverage information for each page in a rulebook
 */
export async function getPageCoverage(
  prisma: PrismaClient,
  rulebookId: string
): Promise<PageCoverage[]> {
  // Get rulebook to know page count
  const rulebook = await prisma.rulebook.findUnique({
    where: { id: rulebookId },
    select: { pageCount: true },
  });

  if (!rulebook || !rulebook.pageCount) {
    return [];
  }

  const pageCount = rulebook.pageCount;

  // Initialize coverage array
  const coverage: PageCoverage[] = Array.from({ length: pageCount }, (_, i) => ({
    page: i + 1,
    hasText: false,
    rulesCount: 0,
    tablesCount: 0,
    diagramsCount: 0,
    chunksCount: 0,
  }));

  // Get rules and mark pages they cover
  const rules = await prisma.rule.findMany({
    where: { rulebookId },
    select: { pageStart: true, pageEnd: true },
  });

  for (const rule of rules) {
    if (rule.pageStart && rule.pageEnd) {
      for (let p = rule.pageStart; p <= rule.pageEnd; p++) {
        if (p >= 1 && p <= pageCount) {
          coverage[p - 1].rulesCount++;
          coverage[p - 1].hasText = true;
        }
      }
    }
  }

  // Get tables
  const tables = await prisma.table.findMany({
    where: { rulebookId },
    select: { page: true },
  });

  for (const table of tables) {
    if (table.page && table.page >= 1 && table.page <= pageCount) {
      coverage[table.page - 1].tablesCount++;
      coverage[table.page - 1].hasText = true;
    }
  }

  // Get diagrams
  const diagrams = await prisma.diagram.findMany({
    where: { rulebookId },
    select: { page: true },
  });

  for (const diagram of diagrams) {
    if (diagram.page && diagram.page >= 1 && diagram.page <= pageCount) {
      coverage[diagram.page - 1].diagramsCount++;
    }
  }

  // Get chunks
  const chunks = await prisma.chunk.findMany({
    where: { rulebookId },
    select: { pageStart: true, pageEnd: true },
  });

  for (const chunk of chunks) {
    if (chunk.pageStart && chunk.pageEnd) {
      for (let p = chunk.pageStart; p <= chunk.pageEnd; p++) {
        if (p >= 1 && p <= pageCount) {
          coverage[p - 1].chunksCount++;
          coverage[p - 1].hasText = true;
        }
      }
    } else if (chunk.pageStart) {
      // Single page chunk
      if (chunk.pageStart >= 1 && chunk.pageStart <= pageCount) {
        coverage[chunk.pageStart - 1].chunksCount++;
        coverage[chunk.pageStart - 1].hasText = true;
      }
    }
  }

  return coverage;
}

/**
 * Get detailed information for a specific page
 */
export interface PageDetail {
  page: number;
  rules: Array<{
    id: string;
    code: string;
    title: string | null;
    text: string;
  }>;
  tables: Array<{
    id: string;
    markdown: string | null;
    jsonData: string | null;
  }>;
  diagrams: Array<{
    id: string;
    caption: string | null;
    explanation: string | null;
    publicUrl: string | null;
    boundingBox: string | null;
    refersToRuleCode: string | null;
  }>;
  chunks: Array<{
    id: string;
    type: string;
    text: string;
    tokenCount: number | null;
  }>;
}

export async function getPageDetail(
  prisma: PrismaClient,
  rulebookId: string,
  page: number
): Promise<PageDetail> {
  // Get rules that cover this page
  const rules = await prisma.rule.findMany({
    where: {
      rulebookId,
      pageStart: { lte: page },
      pageEnd: { gte: page },
    },
    select: {
      id: true,
      code: true,
      title: true,
      text: true,
    },
    orderBy: { code: "asc" },
  });

  // Get tables on this page
  const tables = await prisma.table.findMany({
    where: {
      rulebookId,
      page,
    },
    select: {
      id: true,
      markdown: true,
      jsonData: true,
    },
  });

  // Get diagrams on this page
  const diagrams = await prisma.diagram.findMany({
    where: {
      rulebookId,
      page,
    },
    select: {
      id: true,
      caption: true,
      explanation: true,
      publicUrl: true,
      boundingBox: true,
      refersToRuleCode: true,
    },
  });

  // Get chunks that cover this page
  const chunks = await prisma.chunk.findMany({
    where: {
      rulebookId,
      OR: [
        {
          pageStart: { lte: page },
          pageEnd: { gte: page },
        },
        {
          pageStart: page,
          pageEnd: null,
        },
      ],
    },
    select: {
      id: true,
      type: true,
      text: true,
      tokenCount: true,
    },
    orderBy: { type: "asc" },
  });

  return {
    page,
    rules,
    tables,
    diagrams,
    chunks,
  };
}
