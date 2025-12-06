/**
 * Phase C: LLM-based Structure Refinement
 * Uses OpenAI to validate, normalize, and organize detected sections and rules.
 */

import OpenAI from "openai";
import { SectionCandidate, RuleCandidate, calculateSectionLevel } from "./sectionRuleDetector";

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

export interface RefinedSection {
  label: string;
  title: string;
  level: number;
  pageStart?: number;
  pageEnd?: number;
}

export interface RefinedRule {
  code: string;
  text: string;
  title?: string;
  sectionLabel: string;
  pageStart?: number;
  pageEnd?: number;
}

/**
 * Refine detected structure candidates using LLM.
 * Returns validated and normalized sections and rules.
 */
export async function refineStructureWithLLM(
  candidates: {
    sections: SectionCandidate[];
    rules: RuleCandidate[];
  },
  options?: {
    model?: string;
    skipLLM?: boolean; // For testing without API key
  }
): Promise<{
  sections: RefinedSection[];
  rules: RefinedRule[];
}> {
  // If no API key or skipLLM flag, use heuristic-only refinement
  if (!openai || options?.skipLLM) {
    console.log("[llmStructureRefiner] LLM unavailable or skipped, using heuristic refinement only");
    return refineWithHeuristics(candidates);
  }

  console.log(
    `[llmStructureRefiner] Refining ${candidates.sections.length} sections and ${candidates.rules.length} rules with LLM`
  );

  try {
    // Build the prompt
    const prompt = buildRefinementPrompt(candidates);

    const model = options?.model || process.env.STRUCTURE_LLM_MODEL || "gpt-4o-mini";

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a technical document structure analyzer. Your task is to validate and normalize section headings and rule codes from a racing rulebook. Return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0, // Deterministic output
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from LLM");
    }

    const parsed = JSON.parse(content);

    // Validate and normalize the response
    const sections = normalizeLLMSections(parsed.sections || []);
    const rules = normalizeLLMRules(parsed.rules || [], sections);

    console.log(`[llmStructureRefiner] LLM refined to ${sections.length} sections and ${rules.length} rules`);

    return { sections, rules };
  } catch (err) {
    console.error("[llmStructureRefiner] LLM refinement failed:", err);
    console.log("[llmStructureRefiner] Falling back to heuristic refinement");
    return refineWithHeuristics(candidates);
  }
}

/**
 * Build the LLM prompt for structure refinement.
 */
function buildRefinementPrompt(candidates: {
  sections: SectionCandidate[];
  rules: RuleCandidate[];
}): string {
  const { sections, rules } = candidates;

  // Limit candidates to avoid token overflow (prioritize high confidence)
  const topSections = sections
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 50);

  const topRules = rules
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 100);

  const prompt = `
Analyze the following section and rule candidates detected from a racing rulebook.

**Task:**
1. Validate and normalize section labels and titles
2. Assign section levels (1 = top-level, 2 = subsection, etc.) based on label depth
3. Clean up rule text (remove duplicated numbering, merge wrapped lines)
4. Assign each rule to its parent section based on code prefix matching

**Section Candidates:**
${topSections.map((s, i) => `${i + 1}. Page ${s.page}, Label: "${s.label}", Title: "${s.title || 'N/A'}", Text: "${s.text.substring(0, 100)}..."`).join('\n')}

**Rule Candidates:**
${topRules.map((r, i) => `${i + 1}. Page ${r.page}, Code: "${r.code}", Text: "${r.text.substring(0, 100)}..."`).join('\n')}

**Output Format (JSON):**
{
  "sections": [
    { "label": "3", "title": "CHASSIS", "level": 1 },
    { "label": "3.2", "title": "Roll Cage", "level": 2 }
  ],
  "rules": [
    { "code": "3.2.1", "text": "Main hoop must be...", "sectionLabel": "3.2" }
  ]
}

**Rules:**
- Section labels should be normalized (e.g., "SECTION 3" -> "3")
- Section levels: count dots in label (e.g., "3" = 1, "3.2" = 2, "3.2.1" = 3)
- Each rule's sectionLabel should be the longest matching section prefix
- Rule text should be clean (no duplicated codes, properly joined)
- If a section has no explicit label, use the title as the label

Return only valid JSON.
  `.trim();

  return prompt;
}

/**
 * Normalize LLM section output.
 */
function normalizeLLMSections(sections: any[]): RefinedSection[] {
  return sections
    .filter((s) => s.label || s.title)
    .map((s) => ({
      label: s.label || s.title,
      title: s.title || s.label,
      level: s.level || calculateSectionLevel(s.label || ''),
      pageStart: s.pageStart,
      pageEnd: s.pageEnd,
    }));
}

/**
 * Normalize LLM rule output.
 */
function normalizeLLMRules(rules: any[], sections: RefinedSection[]): RefinedRule[] {
  return rules
    .filter((r) => r.code && r.text)
    .map((r) => {
      // If sectionLabel is missing, infer from code
      let sectionLabel = r.sectionLabel;

      if (!sectionLabel) {
        sectionLabel = inferSectionLabel(r.code, sections);
      }

      return {
        code: r.code,
        text: r.text.trim(),
        title: r.title,
        sectionLabel,
        pageStart: r.pageStart,
        pageEnd: r.pageEnd,
      };
    });
}

/**
 * Infer section label from rule code by finding longest matching prefix.
 */
function inferSectionLabel(ruleCode: string, sections: RefinedSection[]): string {
  // Try to match rule code prefix to section labels
  // e.g., rule "3.2.1" should match section "3.2"

  let bestMatch = '';
  for (const section of sections) {
    if (ruleCode.startsWith(section.label + '.') || ruleCode === section.label) {
      if (section.label.length > bestMatch.length) {
        bestMatch = section.label;
      }
    }
  }

  return bestMatch;
}

/**
 * Fallback: Refine candidates using heuristics only (no LLM).
 */
function refineWithHeuristics(candidates: {
  sections: SectionCandidate[];
  rules: RuleCandidate[];
}): {
  sections: RefinedSection[];
  rules: RefinedRule[];
} {
  // Sort sections by page and confidence
  const sortedSections = candidates.sections
    .sort((a, b) => a.page - b.page || b.confidence - a.confidence);

  // Normalize sections
  const sections: RefinedSection[] = sortedSections.map((s) => ({
    label: s.label || s.title || 'Untitled',
    title: s.title || s.label || 'Untitled',
    level: calculateSectionLevel(s.label),
    pageStart: s.page,
  }));

  // Sort rules by page and confidence
  const sortedRules = candidates.rules
    .sort((a, b) => a.page - b.page || b.confidence - a.confidence);

  // Normalize rules
  const rules: RefinedRule[] = sortedRules.map((r) => ({
    code: r.code,
    text: r.text.trim(),
    sectionLabel: inferSectionLabel(r.code, sections),
    pageStart: r.page,
  }));

  console.log(`[llmStructureRefiner] Heuristic refinement: ${sections.length} sections, ${rules.length} rules`);

  return { sections, rules };
}
