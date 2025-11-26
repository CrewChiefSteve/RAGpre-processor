# Phase C Implementation Summary

## Overview
Successfully implemented Phase C: Robust Table Handling. The system now detects and merges multi-page tables that share the same header signature, exports single CSV files per logical table, generates Markdown previews for human inspection, and properly routes all outputs based on combined quality signals.

---

## What Was Implemented

### 1. Enhanced TableAsset Metadata (`src/types.ts`)

**Added Phase C metadata fields:**
```typescript
export type TableAsset = {
  id: string;
  sectionPath: SectionPath;
  title?: string;
  csvPath: string;
  description: string;
  sourcePdf: string;
  pageRange?: [number, number];
  origin: DocumentOrigin;
  quality: ContentQuality;

  // Phase C: Table merging & dimension metadata
  headerSignature?: string;    // normalized header row (used for grouping)
  headerRow?: string[];        // actual header cells
  rowCount?: number;           // total data rows (excluding header)
  columnCount?: number;        // number of columns
};
```

**New optional fields enable:**
- **Header-based merging** - `headerSignature` identifies tables that span multiple pages
- **Rich metadata** - Row/column counts for validation and display
- **Header inspection** - Actual header values for preview generation

---

### 2. Table Merging Logic (`src/exportTables.ts`)

**Key Constants:**
```typescript
const MAX_PREVIEW_ROWS = 20;  // Limit preview size for readability
```

**Helper Functions:**

#### `buildHeaderSignature(row: string[]): string`
Normalizes header rows for consistent grouping across pages:
```typescript
function buildHeaderSignature(row: string[]): string {
  return row
    .map((cell) => cell.trim().toLowerCase().replace(/\s+/g, " "))
    .join(" | ");
}
```

**Example:**
- Input: `["Product Name", "  Price  ", "Quantity"]`
- Output: `"product name | price | quantity"`

#### `combineQuality(qualities: ContentQuality[]): ContentQuality`
Combines quality signals from multiple table fragments:
```typescript
function combineQuality(qualities: ContentQuality[]): ContentQuality {
  if (qualities.includes("handwriting")) return "handwriting";
  if (qualities.includes("low_confidence")) return "low_confidence";
  return "ok";
}
```

**Strategy**: Worst-case quality wins (conservative approach for routing)

#### `extractAzureTableRows(azureTable: any): string[][]`
Converts Azure Document Intelligence table format to 2D string array:
```typescript
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
```

---

### 3. Multi-Page Table Detection and Merging

**Process Flow:**

#### Step 1: Pair Azure Tables with Assets
```typescript
const tablePairs = azureTables.map((azureTable, idx) => {
  const asset = tables[idx];
  const rows = extractAzureTableRows(azureTable);

  const headerRow = rows[0] ?? [];
  const dataRows = rows.slice(1);
  const headerSignature = buildHeaderSignature(headerRow);
  const pageNum = azureTable.boundingRegions?.[0]?.pageNumber ?? 0;

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
```

**Each pair contains:**
- Original Azure table data
- Associated TableAsset from routeContent
- Extracted header and data rows
- Normalized header signature
- Page number for sorting
- Confidence and quality signals

#### Step 2: Group by Header Signature
```typescript
const groups = new Map<string, typeof tablePairs>();

for (const pair of tablePairs) {
  const key = pair.headerSignature || `table_${pair.pageNum}`;
  const existing = groups.get(key) ?? [];
  existing.push(pair);
  groups.set(key, existing);
}
```

**Grouping strategy:**
- Tables with identical `headerSignature` are grouped together
- Tables without headers get unique keys (won't merge)
- Result: Map of header signature → array of table pairs

#### Step 3: Merge Groups into Logical Tables
```typescript
for (const [headerSig, groupPairs] of groups.entries()) {
  // Sort by page number
  groupPairs.sort((a, b) => a.pageNum - b.pageNum);

  // Use first header, concatenate all data rows
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

  // Combine qualities (worst-case)
  const combinedQuality = combineQuality(groupPairs.map((p) => p.quality));
}
```

**Merge benefits:**
- ✅ No duplicate headers in CSV
- ✅ Preserves row order across pages
- ✅ Accurate page range tracking
- ✅ Combined quality assessment

---

### 4. Output Generation

**Three outputs per logical table:**

#### A. CSV File (`out/tables/`)
```csv
Product,Price,Quantity
Widget A,19.99,100
Widget B,29.99,50
...
```

**Features:**
- Single header row (no duplication)
- All data rows from merged fragments
- Proper CSV escaping for special characters
- Named: `{source}_table_{N}.csv`

#### B. RAG Summary (`out/{quality_bucket}/tables/`)
```markdown
Table: Table on pages 1–3

Source PDF: document.pdf
Page range: 1–3
(merged from 3 page fragments)

This table contains 150 data rows and 5 columns.

Data file: tables/document_table_1.csv
Header: Product | Price | Quantity | Stock Status | Supplier
```

**Purpose:**
- Text-based summary for RAG ingestion
- Includes metadata for retrieval context
- Shows header row for semantic understanding
- Routed to `auto_ok/` or `needs_review/` based on quality

#### C. Markdown Preview (`out/{quality_bucket}/tables_previews/`)
```markdown
# Preview: Table on pages 1–3

Source PDF: document.pdf
Pages: 1–3
Rows: 150 data rows, 5 columns
(merged from 3 page fragments)

|Product|Price|Quantity|Stock Status|Supplier|
|---|---|---|---|---|
|Widget A|19.99|100|In Stock|Acme Corp|
|Widget B|29.99|50|Low Stock|Beta Inc|
...
|Widget T|14.99|200|In Stock|Theta LLC|

... (showing first 20 of 150 rows)
```

**Purpose:**
- Human-readable table preview in Cursor
- Shows first 20 rows for quick inspection
- Markdown table format renders nicely
- Truncation indicator if more rows exist
- Same quality-based routing as summary

---

### 5. Quality-Based Routing

**Combined Quality Strategy:**
```typescript
const combinedQuality = combineQuality(groupPairs.map((p) => p.quality));
const qualityBucket = combinedQuality === "ok" ? "auto_ok" : "needs_review";
```

**Output routing:**
```
out/
├── tables/
│   └── document_table_1.csv              # Always in tables/
├── auto_ok/
│   ├── tables/
│   │   └── document_table_1_summary.md   # High quality
│   └── tables_previews/
│       └── document_table_1_preview.md   # High quality
└── needs_review/
    ├── tables/
    │   └── document_table_2_summary.md   # Low quality
    └── tables_previews/
        └── document_table_2_preview.md   # Low quality
```

**Quality inheritance:**
- If ANY fragment has `handwriting` → logical table is `handwriting`
- Else if ANY fragment has `low_confidence` → logical table is `low_confidence`
- Else all fragments are `ok` → logical table is `ok`

---

### 6. Manifest Integration (`src/index.ts`)

**No changes required** - Phase C integrates seamlessly:

```typescript
const { updatedTables, tableSummaries } = await exportTables(
  result,
  routed.tables,
  outDir
);

const manifest = {
  sourcePdf: sourceName,
  origin: normalized.origin,
  narrativeChunks,
  tableSummaries,
  tables: updatedTables,  // Now contains merged tables with Phase C metadata
  diagrams: updatedDiagrams
};
```

**Manifest now includes for each table:**
```json
{
  "id": "table_1",
  "sectionPath": ["Page 5"],
  "title": "Table on pages 5–7",
  "csvPath": "tables/document_table_1.csv",
  "description": "...",
  "sourcePdf": "document.pdf",
  "pageRange": [5, 7],
  "origin": "pdf_digital",
  "quality": "ok",
  "headerSignature": "product | price | quantity",
  "headerRow": ["Product", "Price", "Quantity"],
  "rowCount": 150,
  "columnCount": 3
}
```

---

### 7. Sanity Check Logging

**Console output during table export:**

```typescript
console.log(
  `[exportTables] Azure tables: ${azureTables.length}, logical tables: ${updatedTables.length}`
);

const autoOkCount = updatedTables.filter((t) => t.quality === "ok").length;
const needsReviewCount = updatedTables.length - autoOkCount;
console.log(
  `[exportTables] Logical tables quality: ok=${autoOkCount}, needs_review=${needsReviewCount}`
);

const mergedCount = azureTables.length - updatedTables.length;
if (mergedCount > 0) {
  console.log(
    `[exportTables] Merged ${mergedCount} page fragments across ${updatedTables.length} logical tables.`
  );
}
```

**Example output:**
```
[exportTables] Azure tables: 5, logical tables: 2
[exportTables] Logical tables quality: ok=1, needs_review=1
[exportTables] Merged 3 page fragments across 2 logical tables.
```

**Interpretation:**
- 5 table fragments detected by Azure
- Merged into 2 logical tables
- 1 table is high quality (auto_ok)
- 1 table needs review (low_confidence or handwriting)
- 3 fragments were successfully merged (5 - 2 = 3)

---

## Complete Output Structure

```
out/
├── manifest.json                          # Full metadata with merged tables
├── tables/
│   ├── document_table_1.csv              # Merged CSV (no duplicate headers)
│   └── document_table_2.csv
├── auto_ok/
│   ├── narrative/
│   │   ├── chunk_1.md
│   │   └── chunk_2.md
│   ├── tables/
│   │   └── document_table_1_summary.md   # RAG ingestion
│   ├── tables_previews/
│   │   └── document_table_1_preview.md   # Human inspection (20 rows)
│   └── diagrams/
│       └── diagram_1.json
└── needs_review/
    ├── narrative/
    │   └── chunk_3.md
    ├── tables/
    │   └── document_table_2_summary.md
    ├── tables_previews/
    │   └── document_table_2_preview.md
    └── diagrams/
        └── diagram_2.json
```

---

## Key Implementation Files

### Modified Files

1. **`src/types.ts`**
   - Extended `TableAsset` with Phase C metadata fields
   - All fields optional for backward compatibility

2. **`src/exportTables.ts`**
   - Added helper functions for header normalization and quality combining
   - Implemented table pairing, grouping, and merging logic
   - Generate CSV, summary, and preview outputs
   - Quality-based routing for all outputs
   - Comprehensive logging

3. **`src/index.ts`**
   - No changes required (seamless integration)
   - Manifest automatically includes new metadata

### Unchanged Files

- `src/routeContent.ts` - Creates TableAsset without optional fields (compatible)
- `src/normalizeInput.ts` - Phase A unchanged
- `src/analyzePdf.ts` - Azure integration unchanged
- `src/exportNarrative.ts` - Phase B narrative routing unchanged
- `src/exportDiagrams.ts` - Phase B diagram routing unchanged

---

## Example: Multi-Page Table Merge

**Input: 3-page table detected by Azure**

**Page 5:**
```
| Product | Price | Quantity |
| Widget A | 19.99 | 100 |
| Widget B | 29.99 | 50 |
```

**Page 6:**
```
| Product | Price | Quantity |
| Widget C | 39.99 | 75 |
| Widget D | 9.99 | 200 |
```

**Page 7:**
```
| Product | Price | Quantity |
| Widget E | 49.99 | 25 |
```

**Output: Single logical table**

**CSV (`tables/document_table_1.csv`):**
```csv
"Product","Price","Quantity"
"Widget A","19.99","100"
"Widget B","29.99","50"
"Widget C","39.99","75"
"Widget D","9.99","200"
"Widget E","49.99","25"
```

**Summary (`auto_ok/tables/document_table_1_summary.md`):**
```markdown
Table: Table on pages 5–7

Source PDF: document.pdf
Page range: 5–7
(merged from 3 page fragments)

This table contains 5 data rows and 3 columns.

Data file: tables/document_table_1.csv
Header: Product | Price | Quantity
```

**Preview (`auto_ok/tables_previews/document_table_1_preview.md`):**
```markdown
# Preview: Table on pages 5–7

Source PDF: document.pdf
Pages: 5–7
Rows: 5 data rows, 3 columns
(merged from 3 page fragments)

|Product|Price|Quantity|
|---|---|---|
|Widget A|19.99|100|
|Widget B|29.99|50|
|Widget C|39.99|75|
|Widget D|9.99|200|
|Widget E|49.99|25|
```

---

## Testing and Verification

### Build Verification
```bash
npm run build
```
✅ No TypeScript errors
✅ All imports/exports compile correctly

### Console Output Verification
```bash
npm start input.pdf
```

Expected logs:
```
[exportTables] Azure tables: X, logical tables: Y
[exportTables] Logical tables quality: ok=A, needs_review=B
[exportTables] Merged N page fragments across Y logical tables.
```

Where:
- `X` = number of physical table fragments detected
- `Y` = number of logical tables after merging (Y ≤ X)
- `N` = X - Y (number of fragments merged)
- `A` = tables with quality "ok"
- `B` = tables with quality "low_confidence" or "handwriting"

### Output Verification

**Check directories exist:**
```bash
ls out/tables/                    # CSV files
ls out/auto_ok/tables/            # High quality summaries
ls out/auto_ok/tables_previews/   # High quality previews
ls out/needs_review/tables/       # Low quality summaries
ls out/needs_review/tables_previews/  # Low quality previews
```

**Check manifest.json:**
```bash
cat out/manifest.json | grep headerSignature
cat out/manifest.json | grep rowCount
cat out/manifest.json | grep columnCount
```

Should show new Phase C metadata fields populated.

---

## Benefits of Phase C

### For RAG Systems
- ✅ **Complete tables** - No missing rows from page breaks
- ✅ **Clean summaries** - Text-based metadata for retrieval
- ✅ **Quality signals** - Can skip low-quality tables or flag for review
- ✅ **Rich metadata** - Row/column counts, headers for filtering

### For Human Review
- ✅ **Quick inspection** - Markdown previews render in Cursor/VS Code
- ✅ **First 20 rows** - Enough to assess quality without overwhelming
- ✅ **Merge visibility** - Shows when tables span multiple pages
- ✅ **Organized routing** - Separate buckets for review priorities

### For Data Processing
- ✅ **Standard CSV** - Easy to load in pandas, Excel, databases
- ✅ **No header duplication** - Clean data ready for analysis
- ✅ **Accurate counts** - Metadata matches actual data
- ✅ **Page tracking** - Can reference original document locations

---

## Integration with Phases A & B

**Phase A (Input Normalization):**
- Provides `origin: "pdf_digital" | "image_normalized"`
- Phase C propagates origin through merged tables
- Manifest tracks document source type

**Phase B (Quality Assessment):**
- Provides per-table `quality: ContentQuality`
- Phase C combines qualities across fragments (worst-case)
- Merged tables maintain quality signals for routing

**Phase C (Table Merging):**
- Builds on Phase B quality signals
- Uses Phase A origin metadata
- Produces final logical tables with complete lineage

**Combined Pipeline:**
```
Input → Normalize (Phase A) → Analyze (Azure) →
Route (Phase B) → Merge Tables (Phase C) →
Export (Narrative/Tables/Diagrams) → Manifest
```

---

## Future Enhancements

Potential improvements for Phase C:

1. **Smarter grouping** - Consider column count, page proximity
2. **Header variations** - Handle slight header differences (typos, formatting)
3. **Confidence thresholds** - Configurable quality boundaries
4. **Preview customization** - User-specified MAX_PREVIEW_ROWS
5. **Table validation** - Detect malformed tables, missing data
6. **Export formats** - JSON, Parquet, SQLite in addition to CSV

---

## Troubleshooting

### Tables Not Merging

**Symptom:** Same table on multiple pages creates separate logical tables

**Causes:**
- Header cells have inconsistent formatting (extra spaces, capitalization)
- Headers differ slightly between pages
- No header row detected (all data rows)

**Solution:**
- Check `headerSignature` in logs/manifest
- Verify header normalization is working correctly
- Consider adjusting `buildHeaderSignature` logic for more aggressive normalization

### Wrong Quality Assignment

**Symptom:** Table routed to wrong bucket

**Causes:**
- One fragment has low confidence, affecting entire merged table
- Handwriting detection on a single page affects all pages

**Solution:**
- Review individual fragment qualities in logs
- Consider per-fragment quality if appropriate for use case
- Adjust confidence thresholds in Phase B

### Missing Previews

**Symptom:** Summary exists but no preview file

**Causes:**
- Directory creation failed
- Empty table (no data rows)

**Solution:**
- Check console for write errors
- Verify `ensureDir` calls before write operations
- Check table has at least one data row

---

## Summary

Phase C successfully implements robust table handling with:

✅ **Multi-page detection** - Header signature matching
✅ **Intelligent merging** - Single CSV per logical table
✅ **No duplication** - Headers appear once
✅ **Quality routing** - Combined signals for merged tables
✅ **RAG summaries** - Text metadata for retrieval
✅ **Human previews** - Markdown tables (20 rows)
✅ **Rich metadata** - Headers, counts, page ranges
✅ **Clean integration** - Works with Phases A & B
✅ **Comprehensive logs** - Merge statistics and quality distribution

The system now produces production-ready table outputs suitable for both automated RAG ingestion and human review workflows.
