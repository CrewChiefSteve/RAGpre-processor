/**
 * Phase C: Structure Compiler
 * Orchestrates section/rule detection, LLM refinement, and Prisma storage.
 */

import { PrismaClient } from "@prisma/client";
import { PageText } from "../types";
import { detectStructureCandidates } from "./sectionRuleDetector";
import { refineStructureWithLLM, RefinedSection, RefinedRule } from "./llmStructureRefiner";

export interface CompiledStructure {
  sections: Array<{
    id: string;
    label: string;
    title: string;
    level: number;
    pageStart: number | null;
    pageEnd: number | null;
  }>;
  rules: Array<{
    id: string;
    code: string;
    text: string;
    sectionId: string | null;
    pageStart: number | null;
    pageEnd: number | null;
  }>;
}

/**
 * Compile structure from PageText array and store in Prisma.
 */
export async function compileStructure(
  pageTextArray: PageText[],
  prisma: PrismaClient,
  rulebookId: string,
  options?: {
    skipLLM?: boolean;
    model?: string;
  }
): Promise<CompiledStructure> {
  console.log(`[structureCompiler] Compiling structure for rulebook ${rulebookId} from ${pageTextArray.length} pages`);

  // Step 1: Detect section and rule candidates heuristically
  const candidates = detectStructureCandidates(pageTextArray);

  // Step 2: Refine with LLM
  const refined = await refineStructureWithLLM(candidates, {
    skipLLM: options?.skipLLM,
    model: options?.model,
  });

  // Step 3: Build section hierarchy
  const sectionHierarchy = buildSectionHierarchy(refined.sections);

  // Step 4: Compute page ranges
  computePageRanges(sectionHierarchy, refined.rules, pageTextArray);

  // Step 5: Store in Prisma
  const stored = await storeStructureInPrisma(prisma, rulebookId, sectionHierarchy, refined.rules);

  console.log(
    `[structureCompiler] Compiled and stored ${stored.sections.length} sections and ${stored.rules.length} rules`
  );

  return stored;
}

/**
 * Build section hierarchy with parent/child relationships.
 */
interface SectionNode extends RefinedSection {
  parentLabel?: string;
  children: SectionNode[];
}

function buildSectionHierarchy(sections: RefinedSection[]): SectionNode[] {
  // Sort by label to ensure parent sections come before children
  const sorted = sections.slice().sort((a, b) => {
    // Compare by label depth first, then alphabetically
    const aDepth = a.label.split('.').length;
    const bDepth = b.label.split('.').length;
    if (aDepth !== bDepth) return aDepth - bDepth;
    return a.label.localeCompare(b.label);
  });

  const nodes: SectionNode[] = sorted.map((s) => ({
    ...s,
    children: [],
  }));

  // Build parent-child relationships
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const parentLabel = findParentLabel(node.label);

    if (parentLabel) {
      // Find parent in nodes
      const parent = nodes.find((n) => n.label === parentLabel);
      if (parent) {
        node.parentLabel = parentLabel;
        parent.children.push(node);
      }
    }
  }

  // Return only root nodes (level 1 or no parent)
  return nodes.filter((n) => !n.parentLabel);
}

/**
 * Find parent label for a section label.
 * e.g., "3.2.1" -> "3.2", "3.2" -> "3", "3" -> null
 */
function findParentLabel(label: string): string | null {
  const parts = label.split('.');
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join('.');
}

/**
 * Compute page ranges for sections and rules.
 */
function computePageRanges(
  sections: SectionNode[],
  rules: RefinedRule[],
  pageTextArray: PageText[]
): void {
  const maxPage = pageTextArray.length;

  // Sort rules by page
  const sortedRules = rules.slice().sort((a, b) => (a.pageStart || 0) - (b.pageStart || 0));

  // Compute rule page ranges
  for (let i = 0; i < sortedRules.length; i++) {
    const rule = sortedRules[i];
    const nextRule = sortedRules[i + 1];

    if (!rule.pageStart) continue;

    // Rule ends at the page before the next rule starts, or at the end of document
    if (nextRule && nextRule.pageStart) {
      rule.pageEnd = nextRule.pageStart - 1;
    } else {
      rule.pageEnd = maxPage;
    }

    // Ensure pageEnd >= pageStart
    if (rule.pageEnd < rule.pageStart) {
      rule.pageEnd = rule.pageStart;
    }
  }

  // Compute section page ranges based on their rules
  function computeSectionRange(node: SectionNode): void {
    // Find all rules in this section
    const sectionRules = rules.filter((r) => r.sectionLabel === node.label);

    if (sectionRules.length > 0) {
      const pages = sectionRules.map((r) => r.pageStart || 0).filter((p) => p > 0);
      if (pages.length > 0) {
        node.pageStart = Math.min(...pages);
        node.pageEnd = Math.max(...sectionRules.map((r) => r.pageEnd || 0));
      }
    }

    // Recurse to children
    for (const child of node.children) {
      computeSectionRange(child);

      // Expand parent range to include children
      if (child.pageStart && (!node.pageStart || child.pageStart < node.pageStart)) {
        node.pageStart = child.pageStart;
      }
      if (child.pageEnd && (!node.pageEnd || child.pageEnd > node.pageEnd)) {
        node.pageEnd = child.pageEnd;
      }
    }
  }

  // Compute ranges for all root sections
  for (const section of sections) {
    computeSectionRange(section);
  }
}

/**
 * Store structure in Prisma database.
 */
async function storeStructureInPrisma(
  prisma: PrismaClient,
  rulebookId: string,
  sections: SectionNode[],
  rules: RefinedRule[]
): Promise<CompiledStructure> {
  // Use transaction for atomicity
  return await prisma.$transaction(async (tx) => {
    // Clear existing structure (if any)
    await tx.section.deleteMany({ where: { rulebookId } });
    await tx.rule.deleteMany({ where: { rulebookId } });

    // Store sections (with hierarchy)
    const sectionMap = new Map<string, string>(); // label -> id
    const storedSections: CompiledStructure['sections'] = [];

    async function storeSection(node: SectionNode, parentId?: string): Promise<void> {
      const section = await tx.section.create({
        data: {
          rulebookId,
          label: node.label,
          title: node.title,
          level: node.level,
          pageStart: node.pageStart || null,
          pageEnd: node.pageEnd || null,
          parentSectionId: parentId || null,
        },
      });

      sectionMap.set(node.label, section.id);
      storedSections.push({
        id: section.id,
        label: section.label || '',
        title: section.title,
        level: section.level,
        pageStart: section.pageStart,
        pageEnd: section.pageEnd,
      });

      // Store children
      for (const child of node.children) {
        await storeSection(child, section.id);
      }
    }

    // Store all root sections
    for (const section of sections) {
      await storeSection(section);
    }

    // Store rules
    const storedRules: CompiledStructure['rules'] = [];

    for (const rule of rules) {
      const sectionId = rule.sectionLabel ? sectionMap.get(rule.sectionLabel) : null;

      const ruleRecord = await tx.rule.create({
        data: {
          rulebookId,
          sectionId: sectionId || null,
          code: rule.code,
          title: rule.title || null,
          text: rule.text,
          pageStart: rule.pageStart || null,
          pageEnd: rule.pageEnd || null,
        },
      });

      storedRules.push({
        id: ruleRecord.id,
        code: ruleRecord.code,
        text: ruleRecord.text,
        sectionId: ruleRecord.sectionId,
        pageStart: ruleRecord.pageStart,
        pageEnd: ruleRecord.pageEnd,
      });
    }

    return {
      sections: storedSections,
      rules: storedRules,
    };
  });
}

/**
 * Flatten section hierarchy for easier traversal.
 */
export function flattenSectionHierarchy(sections: SectionNode[]): SectionNode[] {
  const result: SectionNode[] = [];

  function flatten(node: SectionNode): void {
    result.push(node);
    for (const child of node.children) {
      flatten(child);
    }
  }

  for (const section of sections) {
    flatten(section);
  }

  return result;
}
