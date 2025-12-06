/**
 * Phase F: Rulebook Metrics
 * Provides statistics and counts for rulebooks
 */

import { PrismaClient } from "@prisma/client";

export interface RulebookMetrics {
  rulebookId: string;
  title: string;
  series: string | null;
  year: number | null;
  version: string | null;
  pageCount: number | null;

  sectionsCount: number;
  rulesCount: number;
  tablesCount: number;
  diagramsCount: number;
  chunksCount: number;
}

/**
 * Get metrics for all rulebooks associated with a job
 */
export async function getRulebookMetricsForJob(
  prisma: PrismaClient,
  jobId: string
): Promise<RulebookMetrics[]> {
  // Find all rulebooks linked to this job
  const rulebooks = await prisma.rulebook.findMany({
    where: { ingestionJobId: jobId },
    select: {
      id: true,
      title: true,
      series: true,
      year: true,
      version: true,
      pageCount: true,
      _count: {
        select: {
          sections: true,
          rules: true,
          tables: true,
          diagrams: true,
          chunks: true,
        },
      },
    },
  });

  return rulebooks.map((rb) => ({
    rulebookId: rb.id,
    title: rb.title,
    series: rb.series,
    year: rb.year,
    version: rb.version,
    pageCount: rb.pageCount,
    sectionsCount: rb._count.sections,
    rulesCount: rb._count.rules,
    tablesCount: rb._count.tables,
    diagramsCount: rb._count.diagrams,
    chunksCount: rb._count.chunks,
  }));
}

/**
 * Get metrics for a single rulebook
 */
export async function getRulebookMetrics(
  prisma: PrismaClient,
  rulebookId: string
): Promise<RulebookMetrics | null> {
  const rulebook = await prisma.rulebook.findUnique({
    where: { id: rulebookId },
    select: {
      id: true,
      title: true,
      series: true,
      year: true,
      version: true,
      pageCount: true,
      _count: {
        select: {
          sections: true,
          rules: true,
          tables: true,
          diagrams: true,
          chunks: true,
        },
      },
    },
  });

  if (!rulebook) {
    return null;
  }

  return {
    rulebookId: rulebook.id,
    title: rulebook.title,
    series: rulebook.series,
    year: rulebook.year,
    version: rulebook.version,
    pageCount: rulebook.pageCount,
    sectionsCount: rulebook._count.sections,
    rulesCount: rulebook._count.rules,
    tablesCount: rulebook._count.tables,
    diagramsCount: rulebook._count.diagrams,
    chunksCount: rulebook._count.chunks,
  };
}
