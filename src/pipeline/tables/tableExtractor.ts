/**
 * Phase E: Table Extraction
 * Converts PageText.tables[] into structured Table models in Prisma
 */

import { PrismaClient } from "@prisma/client";
import type { PageText, ExtractedTable } from "../types";

export interface ExtractTablesOptions {
  rulebookId: string;
  pageTextArray: PageText[];
  prisma: PrismaClient;
}

export interface ExtractTablesResult {
  count: number;
}

/**
 * Convert table rows to markdown format
 */
function tableToMarkdown(table: ExtractedTable): string {
  const lines: string[] = [];
  const headers = table.headers || [];
  const rows = table.rows || [];

  if (headers.length === 0 && rows.length === 0) {
    return "";
  }

  // Use headers if available, otherwise create generic column names
  const columnHeaders =
    headers.length > 0
      ? headers
      : rows.length > 0
      ? rows[0].map((_, idx) => `Column ${idx + 1}`)
      : [];

  if (columnHeaders.length === 0) {
    return "";
  }

  // Header row
  lines.push(`| ${columnHeaders.join(" | ")} |`);

  // Separator row
  lines.push(`| ${columnHeaders.map(() => "---").join(" | ")} |`);

  // Data rows (skip first row if we used it as headers)
  const dataRows = headers.length > 0 ? rows : rows.slice(1);
  for (const row of dataRows) {
    // Pad row to match column count
    const paddedRow = [...row];
    while (paddedRow.length < columnHeaders.length) {
      paddedRow.push("");
    }
    // Truncate if row has more columns
    const normalizedRow = paddedRow.slice(0, columnHeaders.length);
    lines.push(`| ${normalizedRow.join(" | ")} |`);
  }

  return lines.join("\n");
}

/**
 * Find the rule or section that owns a table based on page number
 */
async function findTableOwner(
  prisma: PrismaClient,
  rulebookId: string,
  page: number
): Promise<{ ruleId?: string; sectionId?: string }> {
  // Try to find a rule that covers this page
  const rule = await prisma.rule.findFirst({
    where: {
      rulebookId,
      pageStart: { lte: page },
      pageEnd: { gte: page },
    },
    orderBy: {
      pageStart: "desc", // Prefer more specific (later) rules
    },
  });

  if (rule) {
    return { ruleId: rule.id, sectionId: rule.sectionId || undefined };
  }

  // Otherwise, try to find the nearest section
  const section = await prisma.section.findFirst({
    where: {
      rulebookId,
      pageStart: { lte: page },
      OR: [{ pageEnd: { gte: page } }, { pageEnd: null }],
    },
    orderBy: {
      pageStart: "desc",
    },
  });

  if (section) {
    return { sectionId: section.id };
  }

  // No owner found
  return {};
}

/**
 * Extract tables from PageText array and store in Prisma
 */
export async function extractTables(
  options: ExtractTablesOptions
): Promise<ExtractTablesResult> {
  const { rulebookId, pageTextArray, prisma } = options;

  let totalCount = 0;

  console.log(`[tables] Extracting tables from ${pageTextArray.length} pages...`);

  for (const pageText of pageTextArray) {
    const { page, tables } = pageText;

    if (!tables || tables.length === 0) {
      continue;
    }

    console.log(`[tables] Page ${page}: found ${tables.length} table(s)`);

    for (const table of tables) {
      // Normalize table structure
      const headers = table.headers || [];
      const rows = table.rows || [];

      // Skip empty tables
      if (headers.length === 0 && rows.length === 0) {
        console.log(`[tables] Page ${page}: skipping empty table`);
        continue;
      }

      // Convert to markdown
      const markdown = tableToMarkdown(table);

      if (!markdown) {
        console.log(`[tables] Page ${page}: failed to convert table to markdown`);
        continue;
      }

      // Find owner (rule or section)
      const { ruleId, sectionId } = await findTableOwner(prisma, rulebookId, page);

      // Prepare JSON data
      const jsonData = JSON.stringify({
        headers,
        rows,
        source: table.source,
      });

      // Prepare bounding box
      const boundingBox = table.bbox ? JSON.stringify(table.bbox) : null;

      // Insert into Prisma
      const createdTable = await prisma.table.create({
        data: {
          rulebookId,
          page,
          boundingBox,
          jsonData,
          markdown,
          ruleId: ruleId || null,
          sectionId: sectionId || null,
        },
      });

      totalCount++;

      if (ruleId) {
        const rule = await prisma.rule.findUnique({ where: { id: ruleId } });
        console.log(
          `[tables] Page ${page}: stored table ${createdTable.id.substring(0, 8)}... for rule ${rule?.code || ruleId}`
        );
      } else if (sectionId) {
        const section = await prisma.section.findUnique({ where: { id: sectionId } });
        console.log(
          `[tables] Page ${page}: stored table ${createdTable.id.substring(0, 8)}... for section ${section?.label || sectionId}`
        );
      } else {
        console.log(
          `[tables] Page ${page}: stored table ${createdTable.id.substring(0, 8)}... (unassigned)`
        );
      }
    }
  }

  console.log(`[tables] Extraction complete: ${totalCount} table(s) stored`);

  return { count: totalCount };
}
