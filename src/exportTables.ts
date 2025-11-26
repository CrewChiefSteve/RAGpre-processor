import path from "path";
import fs from "fs";
import { ensureDir, writeTextFile } from "./utils/fsUtils";
import type { TableAsset, NarrativeChunk, ContentQuality } from "./types";
import type { AnalyzeResult } from "@azure/ai-form-recognizer";

// Phase C: Maximum rows to show in markdown preview
const MAX_PREVIEW_ROWS = 20;

// Phase C: Normalize header signature for grouping multi-page tables
function buildHeaderSignature(row: string[]): string {
  return row
    .map((cell) => cell.trim().toLowerCase().replace(/\s+/g, " "))
    .join(" | ");
}

// Phase C: Combine qualities from multiple table fragments
function combineQuality(qualities: ContentQuality[]): ContentQuality {
  if (qualities.includes("handwriting")) return "handwriting";
  if (qualities.includes("low_confidence")) return "low_confidence";
  return "ok";
}

// Phase C: Extract rows from Azure table
function extractAzureTableRows(azureTable: any): string[][] {
  const rows: string[][] = [];

  for (let r = 0; r < azureTable.rowCount; r++) {
    const rowCells: string[] = [];
    for (let c = 0; c < azureTable.columnCount; c++) {
      const cell = azureTable.cells?.find(
        (cell: any) => cell.rowIndex === r && cell.columnIndex === c
      );
      rowCells.push(cell?.content ?? "");
    }
    rows.push(rowCells);
  }

  return rows;
}

function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
}

export async function exportTables(
  result: AnalyzeResult,
  tables: TableAsset[],
  outDir: string
): Promise<{ updatedTables: TableAsset[]; tableSummaries: NarrativeChunk[] }> {
  if (!result.tables || result.tables.length === 0) {
    return { updatedTables: tables, tableSummaries: [] };
  }

  ensureDir(path.join(outDir, "tables"));

  // Phase C: Step 2.3 - Pair Azure tables with TableAsset and derive header info
  const azureTables = result.tables;
  const tablePairs = azureTables.map((azureTable, idx) => {
    const asset = tables[idx]; // existing asset from routeContent
    const rows = extractAzureTableRows(azureTable);

    const headerRow = rows[0] ?? [];
    const dataRows = rows.slice(1);
    const headerSignature = buildHeaderSignature(headerRow);
    const pageNum = azureTable.boundingRegions?.[0]?.pageNumber ?? 0;

    // Estimate table confidence (min of cell confidences)
    let tableConfidence: number | undefined = undefined;
    if (azureTable.cells && azureTable.cells.length > 0) {
      const confidences = azureTable.cells
        .map((cell) => (cell as any).confidence as number | undefined)
        .filter((c): c is number => c !== undefined);
      if (confidences.length > 0) {
        tableConfidence = Math.min(...confidences);
      }
    }

    const quality = asset?.quality ?? "ok";

    return {
      azureTable,
      asset,
      headerRow,
      dataRows,
      headerSignature,
      pageNum,
      confidence: tableConfidence,
      quality,
    };
  });

  // Phase C: Step 2.4 - Group tables by header signature
  const groups = new Map<string, typeof tablePairs>();

  for (const pair of tablePairs) {
    const key = pair.headerSignature || `table_${pair.pageNum}`;
    const existing = groups.get(key) ?? [];
    existing.push(pair);
    groups.set(key, existing);
  }

  const updatedTables: TableAsset[] = [];
  const tableSummaries: NarrativeChunk[] = [];

  // Phase C: Step 2.5 - Process each group (merge multi-page tables)
  let logicalTableIdx = 0;
  for (const [headerSig, groupPairs] of groups.entries()) {
    logicalTableIdx++;

    // Sort by page number
    groupPairs.sort((a, b) => a.pageNum - b.pageNum);

    // Use the first asset as the base
    const firstAsset = groupPairs[0].asset;
    if (!firstAsset) continue;

    // Merge all data rows (skip duplicate headers)
    const headerRow = groupPairs[0].headerRow;
    const allDataRows: string[][] = [];
    for (const pair of groupPairs) {
      allDataRows.push(...pair.dataRows);
    }

    // Combine all rows for CSV export
    const allRows = [headerRow, ...allDataRows];
    const csvText = toCsv(allRows);

    // Determine page range
    const minPage = groupPairs[0].pageNum;
    const maxPage = groupPairs[groupPairs.length - 1].pageNum;
    const pageRange: [number, number] = [minPage, maxPage];

    // Combine qualities from all fragments
    const combinedQuality = combineQuality(groupPairs.map((p) => p.quality));

    // Create logical table ID and paths
    const logicalTableId = `table_${logicalTableIdx}`;
    const csvFileName = `${firstAsset.sourcePdf.replace(/\.[^.]+$/, "")}_${logicalTableId}.csv`;
    const csvPath = `tables/${csvFileName}`;
    const csvFullPath = path.join(outDir, csvPath);

    writeTextFile(csvFullPath, csvText);

    // Phase C: Generate summary
    const summaryText = `
Table: ${firstAsset.title ?? logicalTableId}

Source PDF: ${firstAsset.sourcePdf}
Page range: ${pageRange[0]}–${pageRange[1]}
${groupPairs.length > 1 ? `(merged from ${groupPairs.length} page fragments)` : ""}

This table contains ${allDataRows.length} data rows and ${headerRow.length} columns.

Data file: ${csvPath}
Header: ${headerRow.join(" | ")}
`.trim() + "\n";

    const summaryId = `${logicalTableId}_summary`;
    const summaryFileName = `${summaryId}.md`;

    // Phase B & C: Route summary markdown based on combined quality
    const qualityBucket = combinedQuality === "ok" ? "auto_ok" : "needs_review";

    const summaryPath = path.join(
      outDir,
      qualityBucket,
      "tables",
      summaryFileName
    );
    ensureDir(path.dirname(summaryPath));
    writeTextFile(summaryPath, summaryText);

    tableSummaries.push({
      id: summaryId,
      sectionPath: firstAsset.sectionPath,
      text: summaryText,
      sourcePdf: firstAsset.sourcePdf,
      pageRange,
      origin: firstAsset.origin,
      quality: combinedQuality,
    });

    // Phase C: Generate markdown preview (first N rows for human inspection)
    const previewRows = [headerRow, ...allDataRows.slice(0, MAX_PREVIEW_ROWS)];

    const markdownHeader = "|" + headerRow.map((h) => h || " ").join("|") + "|";
    const markdownSeparator = "|" + headerRow.map(() => "---").join("|") + "|";
    const markdownBody = previewRows
      .slice(1)
      .map((row) => "|" + row.map((cell) => cell || " ").join("|") + "|")
      .join("\n");

    const previewText = [
      `# Preview: ${firstAsset.title ?? logicalTableId}`,
      "",
      `Source PDF: ${firstAsset.sourcePdf}`,
      `Pages: ${pageRange[0]}–${pageRange[1]}`,
      `Rows: ${allDataRows.length} data rows, ${headerRow.length} columns`,
      groupPairs.length > 1 ? `(merged from ${groupPairs.length} page fragments)` : "",
      "",
      markdownHeader,
      markdownSeparator,
      markdownBody,
      "",
      allDataRows.length > MAX_PREVIEW_ROWS
        ? `... (showing first ${MAX_PREVIEW_ROWS} of ${allDataRows.length} rows)`
        : "",
    ].filter(line => line !== "").join("\n") + "\n";

    const previewFileName = `${logicalTableId}_preview.md`;
    const previewPath = path.join(
      outDir,
      qualityBucket,
      "tables_previews",
      previewFileName
    );
    ensureDir(path.dirname(previewPath));
    writeTextFile(previewPath, previewText);

    // Phase C: Create enhanced TableAsset with new metadata
    updatedTables.push({
      ...firstAsset,
      id: logicalTableId,
      csvPath,
      description: summaryText,
      pageRange,
      quality: combinedQuality,
      headerSignature: headerSig,
      headerRow,
      rowCount: allDataRows.length,
      columnCount: headerRow.length,
    });
  }

  // Phase C: Sanity check logs
  console.log(
    `[exportTables] Azure tables: ${azureTables.length}, logical tables: ${updatedTables.length}`
  );

  const autoOkCount = updatedTables.filter((t) => t.quality === "ok").length;
  const needsReviewCount = updatedTables.length - autoOkCount;
  console.log(
    `[exportTables] Logical tables quality: ok=${autoOkCount}, needs_review=${needsReviewCount}`
  );

  // Log merge statistics if any tables were merged
  const mergedCount = azureTables.length - updatedTables.length;
  if (mergedCount > 0) {
    console.log(
      `[exportTables] Merged ${mergedCount} page fragments across ${updatedTables.length} logical tables.`
    );
  }

  return { updatedTables, tableSummaries };
}
