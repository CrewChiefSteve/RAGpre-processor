/**
 * Phase D: Diagram Explainer
 *
 * Uses OpenAI Vision to generate explanations for diagram images.
 * Enriches Diagram records with:
 * - caption (short summary)
 * - explanation (detailed description)
 * - tags (keywords)
 * - refersToRuleCode (extracted rule reference)
 * - ruleId (FK link to Rule table)
 */

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { PrismaClient, Diagram, Rule, Section } from "@prisma/client";
import OpenAI from "openai";
import { trace } from "../../debugTrace";

export interface ExplainDiagramsOptions {
  /** Rulebook ID to process */
  rulebookId: string;
  /** Prisma client for database operations */
  prisma: PrismaClient;
  /** Vision provider (only "openai" supported for now) */
  visionProvider?: "openai" | "azure";
  /** Maximum number of diagrams to explain (for cost control) */
  maxDiagrams?: number;
}

export interface ExplainDiagramsResult {
  /** Number of diagrams updated with explanations */
  updatedCount: number;
  /** Array of updated diagram IDs */
  updatedIds: string[];
}

/**
 * Vision response structure from the AI model.
 */
interface VisionExplanationResponse {
  caption: string;
  explanation: string;
  tags: string[];
  refersToRuleCode?: string;
}

/**
 * Read an image file and encode it as base64 for Vision API.
 */
async function readImageAsBase64(imagePath: string): Promise<string> {
  const data = await fsp.readFile(imagePath);
  return data.toString("base64");
}

/**
 * Build context text from Rules and Sections near a given page.
 *
 * This helps the Vision model understand what the diagram is about.
 */
async function buildContextForPage(
  prisma: PrismaClient,
  rulebookId: string,
  pageNumber: number
): Promise<string> {
  // Find rules that cover this page
  const rules = await prisma.rule.findMany({
    where: {
      rulebookId,
      OR: [
        {
          pageStart: { lte: pageNumber },
          pageEnd: { gte: pageNumber },
        },
        {
          pageStart: pageNumber,
        },
        {
          pageEnd: pageNumber,
        },
      ],
    },
    take: 5, // Limit to avoid huge context
    orderBy: { pageStart: "asc" },
  });

  // Find sections that cover this page
  const sections = await prisma.section.findMany({
    where: {
      rulebookId,
      OR: [
        {
          pageStart: { lte: pageNumber },
          pageEnd: { gte: pageNumber },
        },
        {
          pageStart: pageNumber,
        },
      ],
    },
    take: 3,
    orderBy: { pageStart: "asc" },
  });

  const contextParts: string[] = [];

  if (sections.length > 0) {
    contextParts.push("Nearby sections:");
    for (const section of sections) {
      const label = section.label ? `${section.label}. ` : "";
      contextParts.push(`  ${label}${section.title}`);
    }
  }

  if (rules.length > 0) {
    contextParts.push("\nNearby rules:");
    for (const rule of rules) {
      const title = rule.title ? ` - ${rule.title}` : "";
      const textPreview = rule.text.substring(0, 150).trim();
      contextParts.push(`  ${rule.code}${title}`);
      contextParts.push(`    ${textPreview}...`);
    }
  }

  if (contextParts.length === 0) {
    return `Page ${pageNumber} - no contextual rules or sections found.`;
  }

  return `Page ${pageNumber}\n\n${contextParts.join("\n")}`;
}

/**
 * Call OpenAI Vision to explain a diagram image.
 *
 * @param imagePath Path to the diagram PNG
 * @param contextText Textual context from nearby rules/sections
 * @param openai OpenAI client instance
 * @returns Parsed explanation or null if failed
 */
async function explainDiagramWithVision(
  imagePath: string,
  contextText: string,
  openai: OpenAI
): Promise<VisionExplanationResponse | null> {
  try {
    const base64 = await readImageAsBase64(imagePath);

    const prompt = [
      "You are analyzing a technical diagram from a racing rulebook.",
      "Based on the image and the context provided, generate:",
      "1. A short caption (1 sentence, max 100 chars)",
      "2. A detailed explanation (2-3 paragraphs describing parts, dimensions, constraints)",
      "3. An array of relevant tags (keywords like 'roll cage', 'main hoop', 'door bars')",
      "4. If you can identify a specific rule code mentioned in the context or diagram, include it as 'refersToRuleCode' (e.g., '3.2.4')",
      "",
      "Return ONLY valid JSON in this format:",
      "{",
      '  "caption": "...",',
      '  "explanation": "...",',
      '  "tags": ["tag1", "tag2", ...],',
      '  "refersToRuleCode": "3.2.4" // optional',
      "}",
      "",
      "Context:",
      contextText,
    ].join("\n");

    const model = process.env.VISION_MODEL || "gpt-4o-mini";
    trace("calling Vision API for diagram explanation", { model });

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${base64}` },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("[diagramExplainer] Vision API returned empty content");
      return null;
    }

    const parsed = JSON.parse(content);
    trace("Vision explanation parsed", { hasCaptio: !!parsed.caption });

    return {
      caption: parsed.caption || "Diagram",
      explanation: parsed.explanation || "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      refersToRuleCode: parsed.refersToRuleCode || undefined,
    };
  } catch (err: any) {
    console.error("[diagramExplainer] Failed to explain diagram:", err.message);
    trace("Vision explanation error", { error: String(err) });
    return null;
  }
}

/**
 * Find a Rule by code within a rulebook.
 *
 * @param prisma Prisma client
 * @param rulebookId Rulebook ID
 * @param ruleCode Rule code (e.g., "3.2.4")
 * @returns Rule record or null if not found
 */
async function findRuleByCode(
  prisma: PrismaClient,
  rulebookId: string,
  ruleCode: string
): Promise<Rule | null> {
  try {
    const rule = await prisma.rule.findFirst({
      where: {
        rulebookId,
        code: ruleCode,
      },
    });

    return rule;
  } catch (err: any) {
    console.error(`[diagramExplainer] Failed to find rule ${ruleCode}:`, err.message);
    return null;
  }
}

/**
 * Explain all diagrams for a rulebook using Vision.
 *
 * This is the main entry point for Phase D diagram explanations.
 *
 * For each diagram without caption/explanation:
 * 1. Load diagram record and image path
 * 2. Gather context from nearby Rules/Sections
 * 3. Call Vision API to generate explanation
 * 4. Update Diagram record with results
 * 5. Optionally link to Rule via ruleId
 *
 * @param options Configuration for diagram explanation
 * @returns Result with counts and IDs
 */
export async function explainDiagrams(
  options: ExplainDiagramsOptions
): Promise<ExplainDiagramsResult> {
  const { rulebookId, prisma, visionProvider = "openai", maxDiagrams } = options;

  // Check if Vision is configured
  if (!process.env.OPENAI_API_KEY) {
    console.log("[diagramExplainer] No OPENAI_API_KEY configured, skipping diagram explanations");
    trace("Vision not configured for explanations");
    return { updatedCount: 0, updatedIds: [] };
  }

  if (visionProvider !== "openai") {
    console.warn(`[diagramExplainer] Unsupported vision provider: ${visionProvider}`);
    return { updatedCount: 0, updatedIds: [] };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log(`[diagramExplainer] Explaining diagrams for rulebook ${rulebookId}...`);
  trace("explainDiagrams called", { rulebookId, maxDiagrams });

  // Find diagrams without explanations
  const diagrams = await prisma.diagram.findMany({
    where: {
      rulebookId,
      OR: [
        { caption: null },
        { explanation: null },
      ],
    },
    take: maxDiagrams,
    orderBy: { page: "asc" },
  });

  console.log(`[diagramExplainer] Found ${diagrams.length} diagram(s) needing explanations`);

  if (diagrams.length === 0) {
    console.log("[diagramExplainer] No diagrams to explain");
    return { updatedCount: 0, updatedIds: [] };
  }

  const updatedIds: string[] = [];

  for (const diagram of diagrams) {
    try {
      // Build image path from imageKey
      // imageKey format: "rulebooks/{rulebookId}/diagrams/page-X-dY.png"
      // The imageKey is relative to outDir, so we need to get the outDir from somewhere
      // For now, we'll search in common output locations
      let imagePath = path.resolve(diagram.imageKey);

      // If not found, try common output directories
      if (!fs.existsSync(imagePath)) {
        const commonPaths = [
          path.join("out", diagram.imageKey),
          path.join(process.cwd(), "out", diagram.imageKey),
          path.join(process.cwd(), diagram.imageKey),
        ];

        for (const tryPath of commonPaths) {
          if (fs.existsSync(tryPath)) {
            imagePath = tryPath;
            break;
          }
        }
      }

      // Check if image exists
      if (!fs.existsSync(imagePath)) {
        console.warn(`[diagramExplainer] Image not found for diagram ${diagram.id}: ${imagePath}`);
        continue;
      }

      // Build context from nearby rules/sections
      const contextText = await buildContextForPage(prisma, rulebookId, diagram.page || 1);

      // Call Vision to explain the diagram
      const explanation = await explainDiagramWithVision(imagePath, contextText, openai);

      if (!explanation) {
        console.warn(`[diagramExplainer] Failed to get explanation for diagram ${diagram.id}`);
        continue;
      }

      // Prepare update data
      const updateData: any = {
        caption: explanation.caption,
        explanation: explanation.explanation,
        tags: JSON.stringify(explanation.tags),
        refersToRuleCode: explanation.refersToRuleCode || null,
      };

      // If we have a rule code, try to link to the Rule
      if (explanation.refersToRuleCode) {
        const rule = await findRuleByCode(prisma, rulebookId, explanation.refersToRuleCode);
        if (rule) {
          updateData.ruleId = rule.id;
          console.log(
            `[diagramExplainer] Linked diagram ${diagram.id} to rule ${rule.code} (${rule.id})`
          );
        } else {
          console.warn(
            `[diagramExplainer] Rule code ${explanation.refersToRuleCode} not found in database`
          );
        }
      }

      // Update the diagram
      await prisma.diagram.update({
        where: { id: diagram.id },
        data: updateData,
      });

      updatedIds.push(diagram.id);
      console.log(`[diagramExplainer] Updated diagram ${diagram.id} on page ${diagram.page}`);
      trace("diagram explained and updated", {
        diagramId: diagram.id,
        page: diagram.page,
        ruleCode: explanation.refersToRuleCode,
      });

      // Delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err: any) {
      console.error(`[diagramExplainer] Failed to process diagram ${diagram.id}:`, err.message);
      trace("diagram explanation error", { diagramId: diagram.id, error: String(err) });
    }
  }

  console.log(`[diagramExplainer] Updated ${updatedIds.length} diagram(s) with explanations`);
  trace("explainDiagrams complete", { updatedCount: updatedIds.length });

  return {
    updatedCount: updatedIds.length,
    updatedIds,
  };
}
