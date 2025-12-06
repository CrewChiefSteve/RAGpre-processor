# Phase C Example Output

## Sample Rulebook Page

Imagine a rulebook page that looks like this:

```
Page 10
───────────────────────────────────────

3. CHASSIS

All chassis components must meet FIA specifications.

3.1 Frame

The frame must be constructed using approved materials
and methods.

3.1.1 Frame material must be 1.5" chromoly tubing with
minimum wall thickness of 0.095". All tubing must be
certified to ASTM A513 standards.

3.1.2 All welds must meet AWS D1.1 structural welding
standards and be performed by a certified welder.
Welder certification must be provided upon request.

───────────────────────────────────────
Page 11
───────────────────────────────────────

3.2 Roll Cage

The roll cage is a critical safety component and must
be constructed according to specifications below.

3.2.1 Main hoop must be minimum 3 inches behind the
driver's head when the driver is seated in the normal
driving position with safety harness fastened.

3.2.2 Diagonal braces are required from the top
corners of the main hoop to the opposite lower frame
rail attachment points.
```

## Phase C Processing Flow

### Step 1: Heuristic Detection

**Detected Section Candidates:**
```javascript
[
  {
    page: 10,
    lineIndex: 0,
    label: "3",
    title: "CHASSIS",
    text: "3. CHASSIS",
    confidence: 0.95  // Bold, larger font
  },
  {
    page: 10,
    lineIndex: 3,
    label: "3.1",
    title: "Frame",
    text: "3.1 Frame",
    confidence: 0.9   // Bold
  },
  {
    page: 11,
    lineIndex: 0,
    label: "3.2",
    title: "Roll Cage",
    text: "3.2 Roll Cage",
    confidence: 0.9   // Bold
  }
]
```

**Detected Rule Candidates:**
```javascript
[
  {
    page: 10,
    lineIndex: 7,
    code: "3.1.1",
    text: "Frame material must be 1.5\" chromoly tubing with minimum wall thickness of 0.095\". All tubing must be certified to ASTM A513 standards.",
    confidence: 0.95
  },
  {
    page: 10,
    lineIndex: 11,
    code: "3.1.2",
    text: "All welds must meet AWS D1.1 structural welding standards and be performed by a certified welder. Welder certification must be provided upon request.",
    confidence: 0.95
  },
  {
    page: 11,
    lineIndex: 5,
    code: "3.2.1",
    text: "Main hoop must be minimum 3 inches behind the driver's head when the driver is seated in the normal driving position with safety harness fastened.",
    confidence: 0.95
  },
  {
    page: 11,
    lineIndex: 9,
    code: "3.2.2",
    text: "Diagonal braces are required from the top corners of the main hoop to the opposite lower frame rail attachment points.",
    confidence: 0.95
  }
]
```

### Step 2: LLM Refinement

**LLM Prompt:**
```
Analyze the following section and rule candidates detected from a racing rulebook.

**Section Candidates:**
1. Page 10, Label: "3", Title: "CHASSIS", Text: "3. CHASSIS"
2. Page 10, Label: "3.1", Title: "Frame", Text: "3.1 Frame"
3. Page 11, Label: "3.2", Title: "Roll Cage", Text: "3.2 Roll Cage"

**Rule Candidates:**
1. Page 10, Code: "3.1.1", Text: "Frame material must be 1.5\" chromoly..."
2. Page 10, Code: "3.1.2", Text: "All welds must meet AWS D1.1..."
3. Page 11, Code: "3.2.1", Text: "Main hoop must be minimum 3 inches..."
4. Page 11, Code: "3.2.2", Text: "Diagonal braces are required..."

Return valid JSON with normalized structure.
```

**LLM Response:**
```json
{
  "sections": [
    {
      "label": "3",
      "title": "CHASSIS",
      "level": 1
    },
    {
      "label": "3.1",
      "title": "Frame",
      "level": 2
    },
    {
      "label": "3.2",
      "title": "Roll Cage",
      "level": 2
    }
  ],
  "rules": [
    {
      "code": "3.1.1",
      "text": "Frame material must be 1.5\" chromoly tubing with minimum wall thickness of 0.095\". All tubing must be certified to ASTM A513 standards.",
      "sectionLabel": "3.1"
    },
    {
      "code": "3.1.2",
      "text": "All welds must meet AWS D1.1 structural welding standards and be performed by a certified welder. Welder certification must be provided upon request.",
      "sectionLabel": "3.1"
    },
    {
      "code": "3.2.1",
      "text": "Main hoop must be minimum 3 inches behind the driver's head when the driver is seated in the normal driving position with safety harness fastened.",
      "sectionLabel": "3.2"
    },
    {
      "code": "3.2.2",
      "text": "Diagonal braces are required from the top corners of the main hoop to the opposite lower frame rail attachment points.",
      "sectionLabel": "3.2"
    }
  ]
}
```

### Step 3: Section Hierarchy

**Built Tree Structure:**
```javascript
[
  {
    label: "3",
    title: "CHASSIS",
    level: 1,
    parentLabel: null,
    children: [
      {
        label: "3.1",
        title: "Frame",
        level: 2,
        parentLabel: "3",
        children: []
      },
      {
        label: "3.2",
        title: "Roll Cage",
        level: 2,
        parentLabel: "3",
        children: []
      }
    ]
  }
]
```

### Step 4: Page Range Computation

**Rules with Page Ranges:**
```javascript
[
  { code: "3.1.1", pageStart: 10, pageEnd: 10, sectionLabel: "3.1" },
  { code: "3.1.2", pageStart: 10, pageEnd: 11, sectionLabel: "3.1" },
  { code: "3.2.1", pageStart: 11, pageEnd: 11, sectionLabel: "3.2" },
  { code: "3.2.2", pageStart: 11, pageEnd: 11, sectionLabel: "3.2" }
]
```

**Sections with Page Ranges:**
```javascript
[
  { label: "3", title: "CHASSIS", level: 1, pageStart: 10, pageEnd: 11 },
  { label: "3.1", title: "Frame", level: 2, pageStart: 10, pageEnd: 11 },
  { label: "3.2", title: "Roll Cage", level: 2, pageStart: 11, pageEnd: 11 }
]
```

### Step 5: Prisma Storage

**Stored Sections:**
```sql
-- Section: "3. CHASSIS"
INSERT INTO Section (id, rulebookId, label, title, level, pageStart, pageEnd, parentSectionId)
VALUES ('cm1abc...', 'cm0xyz...', '3', 'CHASSIS', 1, 10, 11, NULL);

-- Section: "3.1 Frame"
INSERT INTO Section (id, rulebookId, label, title, level, pageStart, pageEnd, parentSectionId)
VALUES ('cm2def...', 'cm0xyz...', '3.1', 'Frame', 2, 10, 11, 'cm1abc...');

-- Section: "3.2 Roll Cage"
INSERT INTO Section (id, rulebookId, label, title, level, pageStart, pageEnd, parentSectionId)
VALUES ('cm3ghi...', 'cm0xyz...', '3.2', 'Roll Cage', 2, 11, 11, 'cm1abc...');
```

**Stored Rules:**
```sql
-- Rule: 3.1.1
INSERT INTO Rule (id, rulebookId, sectionId, code, text, pageStart, pageEnd)
VALUES ('cm4jkl...', 'cm0xyz...', 'cm2def...', '3.1.1',
        'Frame material must be 1.5" chromoly tubing with minimum wall thickness of 0.095". All tubing must be certified to ASTM A513 standards.',
        10, 10);

-- Rule: 3.1.2
INSERT INTO Rule (id, rulebookId, sectionId, code, text, pageStart, pageEnd)
VALUES ('cm5mno...', 'cm0xyz...', 'cm2def...', '3.1.2',
        'All welds must meet AWS D1.1 structural welding standards and be performed by a certified welder. Welder certification must be provided upon request.',
        10, 11);

-- Rule: 3.2.1
INSERT INTO Rule (id, rulebookId, sectionId, code, text, pageStart, pageEnd)
VALUES ('cm6pqr...', 'cm0xyz...', 'cm3ghi...', '3.2.1',
        'Main hoop must be minimum 3 inches behind the driver''s head when the driver is seated in the normal driving position with safety harness fastened.',
        11, 11);

-- Rule: 3.2.2
INSERT INTO Rule (id, rulebookId, sectionId, code, text, pageStart, pageEnd)
VALUES ('cm7stu...', 'cm0xyz...', 'cm3ghi...', '3.2.2',
        'Diagonal braces are required from the top corners of the main hoop to the opposite lower frame rail attachment points.',
        11, 11);
```

## Querying the Structure

### Get Section Tree

```typescript
const chassisSection = await prisma.section.findFirst({
  where: {
    rulebookId: 'cm0xyz...',
    label: '3',
  },
  include: {
    children: {
      include: {
        rules: true,
      },
    },
  },
});

// Returns:
{
  id: 'cm1abc...',
  label: '3',
  title: 'CHASSIS',
  level: 1,
  pageStart: 10,
  pageEnd: 11,
  children: [
    {
      id: 'cm2def...',
      label: '3.1',
      title: 'Frame',
      level: 2,
      pageStart: 10,
      pageEnd: 11,
      rules: [
        { code: '3.1.1', text: 'Frame material must be...', pageStart: 10, pageEnd: 10 },
        { code: '3.1.2', text: 'All welds must meet...', pageStart: 10, pageEnd: 11 }
      ]
    },
    {
      id: 'cm3ghi...',
      label: '3.2',
      title: 'Roll Cage',
      level: 2,
      pageStart: 11,
      pageEnd: 11,
      rules: [
        { code: '3.2.1', text: 'Main hoop must be...', pageStart: 11, pageEnd: 11 },
        { code: '3.2.2', text: 'Diagonal braces are required...', pageStart: 11, pageEnd: 11 }
      ]
    }
  ]
}
```

### Get Specific Rule

```typescript
const rule = await prisma.rule.findFirst({
  where: {
    rulebookId: 'cm0xyz...',
    code: '3.2.1',
  },
  include: {
    section: {
      include: {
        parentSection: true,
      },
    },
  },
});

// Returns:
{
  id: 'cm6pqr...',
  code: '3.2.1',
  text: 'Main hoop must be minimum 3 inches behind the driver\'s head when the driver is seated in the normal driving position with safety harness fastened.',
  pageStart: 11,
  pageEnd: 11,
  section: {
    id: 'cm3ghi...',
    label: '3.2',
    title: 'Roll Cage',
    level: 2,
    parentSection: {
      id: 'cm1abc...',
      label: '3',
      title: 'CHASSIS',
      level: 1
    }
  }
}
```

### Get All Rules on Page 11

```typescript
const rulesOnPage11 = await prisma.rule.findMany({
  where: {
    rulebookId: 'cm0xyz...',
    pageStart: { lte: 11 },
    pageEnd: { gte: 11 },
  },
  include: {
    section: true,
  },
  orderBy: {
    code: 'asc',
  },
});

// Returns:
[
  {
    code: '3.1.2',
    text: 'All welds must meet AWS D1.1...',
    pageStart: 10,
    pageEnd: 11,
    section: { label: '3.1', title: 'Frame' }
  },
  {
    code: '3.2.1',
    text: 'Main hoop must be minimum 3 inches...',
    pageStart: 11,
    pageEnd: 11,
    section: { label: '3.2', title: 'Roll Cage' }
  },
  {
    code: '3.2.2',
    text: 'Diagonal braces are required...',
    pageStart: 11,
    pageEnd: 11,
    section: { label: '3.2', title: 'Roll Cage' }
  }
]
```

## Console Output

When processing this rulebook page, you would see:

```
=== Phase B: Multi-Extractor Text Layer ===
[loadDocument] Loading: C:\Users\...\rulebook.pdf
[loadDocument] Loaded 50 pages, type: pdf_digital
[pipeline] Loaded document: 50 pages, type: pdf_digital
[pageTextExtractor] Extracting text from 50 pages (useAzure: true, usePdfJsFallback: true)
[pageTextExtractor] Attempting Azure extraction...
[azureTextExtractor] Analyzing 50 pages with Azure (model: prebuilt-layout)
[azureTextExtractor] Azure returned 50 pages, 342 paragraphs, 15 tables
[pageTextExtractor] Azure succeeded for 50 pages: [1, 2, 3, ..., 50]
[pageTextExtractor] Final extraction summary:
  - azure: 50 page(s)
[pipeline] Multi-extractor returned 50 pages
[pipeline] Total extracted: 342 text blocks, 15 tables
=== End Phase B ===

=== Phase C: Structure Detection + Compilation ===
[sectionRuleDetector] Detected 12 section candidates, 145 rule candidates
[llmStructureRefiner] Refining 12 sections and 145 rules with LLM
[llmStructureRefiner] LLM refined to 12 sections and 145 rules
[structureCompiler] Compiling structure for rulebook cm0xyz... from 50 pages
[structureCompiler] Compiled and stored 12 sections and 145 rules
[pipeline] Structure compiled: 12 sections, 145 rules
=== End Phase C ===
```

## Summary

This example demonstrates how Phase C transforms raw text from Pages 10-11 into:
- **3 hierarchical sections** (1 parent, 2 children)
- **4 rules** properly linked to their parent sections
- **Accurate page ranges** for all elements
- **Clean, queryable structure** in Prisma

The resulting database structure enables:
- Fast section/rule lookups by code
- Hierarchical navigation (parent/child)
- Page-based queries (what's on page X?)
- Foundation for diagrams, tables, and chunks in future phases
