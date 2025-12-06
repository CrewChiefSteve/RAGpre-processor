# Phase C Quick Reference

## Overview

Phase C transforms raw PageText (Phase B) into a structured hierarchy of Sections and Rules stored in Prisma.

## New Modules

### 1. Section/Rule Detector
**File**: `src/pipeline/structure/sectionRuleDetector.ts`

```typescript
detectStructureCandidates(pageTextArray: PageText[]): {
  sections: SectionCandidate[];
  rules: RuleCandidate[];
}
```

**Detects:**
- Section headers (bold, large font, numbered patterns)
- Rule codes (3.2.1, A), (1), etc.)

### 2. LLM Refiner
**File**: `src/pipeline/structure/llmStructureRefiner.ts`

```typescript
refineStructureWithLLM(
  candidates: { sections: SectionCandidate[]; rules: RuleCandidate[] },
  options?: { model?: string; skipLLM?: boolean }
): Promise<{ sections: RefinedSection[]; rules: RefinedRule[] }>
```

**Refines:**
- Validates section numbers
- Normalizes titles
- Assigns section levels
- Links rules to parent sections
- Cleans up rule text

### 3. Structure Compiler
**File**: `src/pipeline/structure/structureCompiler.ts`

```typescript
compileStructure(
  pageTextArray: PageText[],
  prisma: PrismaClient,
  rulebookId: string,
  options?: { skipLLM?: boolean; model?: string }
): Promise<CompiledStructure>
```

**Compiles:**
- Detects candidates
- Refines with LLM
- Builds section hierarchy
- Computes page ranges
- Stores in Prisma

## Integration

### Pipeline Changes

**File**: `src/pipeline.ts` (lines 108-131)

```typescript
// After Phase B extraction:
if (config.prisma && config.rulebookId && !config.skipStructureCompilation) {
  compiledStructure = await compileStructure(
    pageTextArray,
    config.prisma,
    config.rulebookId,
    { skipLLM: !process.env.OPENAI_API_KEY }
  );
}
```

### New Config Options

```typescript
interface PipelineConfig {
  // ... existing options
  prisma?: PrismaClient;
  rulebookId?: string;
  skipStructureCompilation?: boolean;
}
```

## Usage

### CLI Mode (Phase C Skipped)

```bash
pnpm run cli ./rulebook.pdf --outDir ./output
# Phase C automatically skipped (no Prisma)
```

### Web Mode (Phase C Enabled)

```typescript
import { prisma } from './lib/db';
import { runPipeline } from './src/pipeline';

// Create rulebook record
const rulebook = await prisma.rulebook.create({
  data: {
    title: "SVRA Rulebook 2024",
    series: "SVRA",
    year: 2024,
    fileKey: inputPath,
  },
});

// Run pipeline with Phase C
await runPipeline({
  inputPath,
  outDir,
  prisma,
  rulebookId: rulebook.id,
});

// Query results
const sections = await prisma.section.findMany({
  where: { rulebookId: rulebook.id },
  include: { children: true, rules: true },
});
```

## Expected Log Output

```
=== Phase B: Multi-Extractor Text Layer ===
[pipeline] Loaded document: 50 pages, type: pdf_digital
[pipeline] Multi-extractor returned 50 pages
[pipeline] Total extracted: 342 text blocks, 15 tables
=== End Phase B ===

=== Phase C: Structure Detection + Compilation ===
[sectionRuleDetector] Detected 12 section candidates, 145 rule candidates
[llmStructureRefiner] Refining 12 sections and 145 rules with LLM
[llmStructureRefiner] LLM refined to 12 sections and 145 rules
[structureCompiler] Compiled and stored 12 sections and 145 rules
[pipeline] Structure compiled: 12 sections, 145 rules
=== End Phase C ===
```

## Prisma Models Used

```prisma
model Rulebook {
  id        String    @id @default(cuid())
  title     String
  series    String?
  year      Int?
  fileKey   String
  sections  Section[]
  rules     Rule[]
}

model Section {
  id              String    @id @default(cuid())
  rulebookId      String
  label           String?   // "3", "3.2", "3.2.1"
  title           String
  level           Int       // 1, 2, 3
  pageStart       Int?
  pageEnd         Int?
  parentSectionId String?
  parentSection   Section?  @relation("SectionHierarchy")
  children        Section[] @relation("SectionHierarchy")
  rules           Rule[]
}

model Rule {
  id         String   @id @default(cuid())
  rulebookId String
  sectionId  String?
  code       String   // "3.2.1"
  title      String?
  text       String   // normalized rule text
  pageStart  Int?
  pageEnd    Int?
}
```

## Detection Patterns

### Sections
- `3` → Section 3
- `3.2` → Section 3.2
- `SECTION 3` → Section 3
- `3. CHASSIS` → Section 3, title "CHASSIS"

### Rules
- `3.2.1 Main hoop must...` → Rule 3.2.1
- `A) Driver safety...` → Rule A
- `(1) All vehicles...` → Rule (1)

## Environment Variables

```bash
# Optional: Enables LLM refinement (falls back to heuristics if missing)
OPENAI_API_KEY=sk-...

# Optional: Custom model for structure refinement
STRUCTURE_LLM_MODEL=gpt-4o-mini
```

## Verification

```bash
# TypeScript compilation
npx tsc --noEmit
# ✅ Clean

# Check what was stored
npx prisma studio
# View Rulebook, Section, Rule tables
```

## What's Next

Phase C provides the structure foundation for:
- **Phase D**: Diagram detection and linking to sections/rules
- **Phase E**: Table merging and linking to rules
- **Phase F**: Chunk generation from rules
- **Phase G**: Embedding generation and vector storage

Currently, Phase C runs alongside the legacy pipeline. Future phases will fully replace the file-based outputs with Prisma-based storage.
