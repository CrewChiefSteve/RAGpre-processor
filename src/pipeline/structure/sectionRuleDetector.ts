/**
 * Phase C: Section and Rule Detection Heuristics
 * Detects section headers and rule codes from PageText using text analysis.
 */

import { PageText, TextBlock } from "../types";

export interface SectionCandidate {
  page: number;
  lineIndex: number;
  label: string;
  title: string | null;
  text: string;
  confidence: number;
}

export interface RuleCandidate {
  page: number;
  lineIndex: number;
  code: string;
  text: string;
  confidence: number;
}

/**
 * Detect section and rule candidates from PageText array using heuristics.
 */
export function detectStructureCandidates(pageTextArray: PageText[]): {
  sections: SectionCandidate[];
  rules: RuleCandidate[];
} {
  const sections: SectionCandidate[] = [];
  const rules: RuleCandidate[] = [];

  for (const pageText of pageTextArray) {
    const { page, blocks } = pageText;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const text = block.text.trim();

      if (!text) continue;

      // Try section detection first (sections usually precede rules)
      const sectionMatch = detectSection(block, i, page);
      if (sectionMatch) {
        sections.push(sectionMatch);
        continue; // Don't also treat as rule
      }

      // Try rule detection
      const ruleMatch = detectRule(block, i, page);
      if (ruleMatch) {
        rules.push(ruleMatch);
      }
    }
  }

  console.log(`[sectionRuleDetector] Detected ${sections.length} section candidates, ${rules.length} rule candidates`);
  return { sections, rules };
}

/**
 * Detect if a text block is a section header.
 */
function detectSection(block: TextBlock, lineIndex: number, page: number): SectionCandidate | null {
  const text = block.text.trim();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length === 0) return null;

  const firstLine = lines[0];

  // Pattern 1: Standalone section number (e.g., "3", "3.2", "3.2.1")
  // Must be short and match section numbering pattern
  const standaloneNumberMatch = firstLine.match(/^(\d+(?:\.\d+)*)$/);
  if (standaloneNumberMatch) {
    const label = standaloneNumberMatch[1];
    const title = lines.length > 1 ? lines.slice(1).join(' ') : null;

    return {
      page,
      lineIndex,
      label,
      title,
      text,
      confidence: 0.9,
    };
  }

  // Pattern 2: "Section 3" or "SECTION 3.2" or "3. TITLE"
  const sectionWithLabelMatch = firstLine.match(/^(?:SECTION\s+)?(\d+(?:\.\d+)*)[.\s:]*(.*)$/i);
  if (sectionWithLabelMatch) {
    const label = sectionWithLabelMatch[1];
    const titlePart = sectionWithLabelMatch[2].trim();

    // Check if this looks like a section header (style hints)
    const styleScore = getStyleScore(block);

    // Only accept if we have style hints OR it's clearly labeled as "SECTION"
    if (styleScore > 0.5 || firstLine.toLowerCase().startsWith('section')) {
      return {
        page,
        lineIndex,
        label,
        title: titlePart || (lines.length > 1 ? lines.slice(1).join(' ') : null),
        text,
        confidence: styleScore,
      };
    }
  }

  // Pattern 3: Title Case or ALL CAPS line that might be a section title
  // (without explicit numbering, but with strong style hints)
  if (block.style?.bold || (block.style?.fontSize && block.style.fontSize > 12)) {
    const isAllCaps = firstLine === firstLine.toUpperCase() && firstLine.length > 3;
    const isTitleCase = /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(firstLine);

    if (isAllCaps || isTitleCase) {
      // This might be an unnumbered section (treat label as the title itself for now)
      return {
        page,
        lineIndex,
        label: '', // No explicit label
        title: firstLine,
        text,
        confidence: 0.6,
      };
    }
  }

  return null;
}

/**
 * Detect if a text block is a rule.
 */
function detectRule(block: TextBlock, lineIndex: number, page: number): RuleCandidate | null {
  const text = block.text.trim();

  // Pattern 1: Numbered rules (e.g., "3.2.1", "1.1", "4.5.2")
  // Look for pattern at start of line: number.number or number.number.number followed by text
  const numberedRuleMatch = text.match(/^(\d+\.\d+(?:\.\d+)*)\s+(.+)$/s);
  if (numberedRuleMatch) {
    const code = numberedRuleMatch[1];
    const ruleText = numberedRuleMatch[2].trim();

    // Must have substantial text after the code
    if (ruleText.length > 10) {
      return {
        page,
        lineIndex,
        code,
        text: ruleText,
        confidence: 0.95,
      };
    }
  }

  // Pattern 2: Letter-based rules (e.g., "A)", "B)", "a.", "b.")
  const letterRuleMatch = text.match(/^([A-Za-z])[.)]\s+(.+)$/s);
  if (letterRuleMatch) {
    const letter = letterRuleMatch[1];
    const ruleText = letterRuleMatch[2].trim();

    if (ruleText.length > 10) {
      return {
        page,
        lineIndex,
        code: letter,
        text: ruleText,
        confidence: 0.85,
      };
    }
  }

  // Pattern 3: Parenthetical numbers (e.g., "(1)", "(2)", "(a)")
  const parenRuleMatch = text.match(/^\(([0-9a-zA-Z]+)\)\s+(.+)$/s);
  if (parenRuleMatch) {
    const code = parenRuleMatch[1];
    const ruleText = parenRuleMatch[2].trim();

    if (ruleText.length > 10) {
      return {
        page,
        lineIndex,
        code: `(${code})`,
        text: ruleText,
        confidence: 0.8,
      };
    }
  }

  return null;
}

/**
 * Calculate a style score for a text block (0-1).
 * Higher score means more likely to be a section header.
 */
function getStyleScore(block: TextBlock): number {
  let score = 0.5; // baseline

  if (!block.style) return score;

  // Bold text is a strong indicator
  if (block.style.bold) {
    score += 0.3;
  }

  // Larger font size
  if (block.style.fontSize) {
    if (block.style.fontSize > 14) {
      score += 0.2;
    } else if (block.style.fontSize > 12) {
      score += 0.1;
    }
  }

  // Italic might indicate emphasis (slight boost)
  if (block.style.italic) {
    score += 0.05;
  }

  return Math.min(score, 1.0);
}

/**
 * Normalize a section label (e.g., "SECTION 3" -> "3").
 */
export function normalizeSectionLabel(label: string): string {
  return label.replace(/^SECTION\s+/i, '').trim();
}

/**
 * Calculate section level from label (e.g., "3" = 1, "3.2" = 2, "3.2.1" = 3).
 */
export function calculateSectionLevel(label: string): number {
  if (!label) return 1;
  const parts = label.split('.');
  return parts.length;
}
