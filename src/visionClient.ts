import fs from "fs";
import path from "path";
import OpenAI from "openai";
// Import config to ensure dotenv.config() runs before accessing env vars
import "./config";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn("[visionClient] OPENAI_API_KEY not set. Vision features will be disabled.");
}

const openai = apiKey ? new OpenAI({ apiKey }) : null;

async function readImageAsBase64(imagePath: string): Promise<string> {
  const abs = path.resolve(imagePath);
  const data = await fs.promises.readFile(abs);
  return data.toString("base64");
}

export async function captionDiagramImage(
  imagePath: string,
  extraContext?: string
): Promise<string | null> {
  if (!openai) return null;

  const base64 = await readImageAsBase64(imagePath);
  const prompt = [
    "You are analyzing a technical diagram from a racing rulebook.",
    "Describe all labeled parts, dimensions, limits, and constraints.",
    "Focus on information useful for race setup and legality checks.",
  ];
  if (extraContext && extraContext.trim()) {
    prompt.push(`Additional context: ${extraContext.trim()}`);
  }

  const response = await openai.chat.completions.create({
    model: process.env.VISION_MODEL ?? "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt.join("\n") },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${base64}` },
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;

  // content is a string in this SDK version
  return typeof content === "string" ? content : JSON.stringify(content);
}

export async function transcribeHandwritingImage(
  imagePath: string
): Promise<string | null> {
  if (!openai) return null;

  const base64 = await readImageAsBase64(imagePath);
  const prompt = [
    "Transcribe this handwritten racing note exactly.",
    "Preserve line breaks.",
    "If a word is unclear, write [unclear].",
  ];

  const response = await openai.chat.completions.create({
    model: process.env.VISION_MODEL ?? "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt.join("\n") },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${base64}` },
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;

  return typeof content === "string" ? content : JSON.stringify(content);
}

export interface VisionDiagramRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  confidence?: number;
}

export interface DetectDiagramRegionsInImageOptions {
  imagePath: string;
  debug?: boolean;
  context?: string;
}

/**
 * Detect diagram regions in a page image using OpenAI Vision
 * Returns bounding boxes in pixel coordinates along with raw JSON response
 */
export async function detectDiagramRegionsInImage(
  opts: DetectDiagramRegionsInImageOptions
): Promise<{ regions: VisionDiagramRegion[]; rawJson?: any }> {
  console.log('[visionClient] detectDiagramRegionsInImage called');
  console.log('[visionClient] Has OpenAI client:', !!openai);
  console.log('[visionClient] Image path:', opts.imagePath);

  if (!openai) {
    console.warn('[visionClient] No OpenAI client - returning empty regions');
    return { regions: [] };
  }

  const { imagePath, context, debug } = opts;

  const base64 = await readImageAsBase64(imagePath);

  const promptParts = [
    "You are analyzing a technical racing rulebook page.",
    "Identify all diagrams, blueprints, templates, or technical illustrations that look like car bodies, roll cages, frame layouts, or dimensioned drawings.",
    "Return ONLY a JSON array. Each item must have: \"x\", \"y\", \"width\", \"height\" (pixels relative to the full page image), and \"label\".",
    "The JSON must be valid and parseable.",
    "Do not include any text before or after the JSON array.",
    "If there are no diagrams, return an empty array: []"
  ];

  if (context) {
    promptParts.push(`Additional context: ${context}`);
  }

  try {
    console.log('[visionClient] Calling OpenAI API with model:', process.env.VISION_MODEL ?? "gpt-4o-mini");

    const response = await openai.chat.completions.create({
      model: process.env.VISION_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptParts.join("\n") },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${base64}` },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    console.log('[visionClient] OpenAI API call successful');

    const content = response.choices[0]?.message?.content;
    if (!content) return { regions: [] };

    const contentStr = typeof content === "string" ? content : JSON.stringify(content);

    // Try to parse the response
    const parsed = JSON.parse(contentStr);

    if (debug) {
      console.log("[visionClient] Raw vision response:", JSON.stringify(parsed, null, 2));
    }

    // Handle different response formats
    let rawRegions: any[] = [];
    if (Array.isArray(parsed)) {
      rawRegions = parsed;
    } else if (parsed.regions && Array.isArray(parsed.regions)) {
      rawRegions = parsed.regions;
    } else if (parsed.diagrams && Array.isArray(parsed.diagrams)) {
      rawRegions = parsed.diagrams;
    }

    // Validate and map to VisionDiagramRegion format
    const regions = rawRegions
      .filter((r) =>
        typeof r.x === "number" &&
        typeof r.y === "number" &&
        typeof r.width === "number" &&
        typeof r.height === "number"
      )
      .map((r) => ({
        x: Math.max(0, r.x),
        y: Math.max(0, r.y),
        width: Math.max(0, r.width),
        height: Math.max(0, r.height),
        label: r.label || "Diagram",
        confidence: r.confidence,
      }));

    console.log('[visionClient] Detected', regions.length, 'diagram region(s)');

    return { regions, rawJson: parsed };
  } catch (err: any) {
    console.error("[visionClient] ========================================");
    console.error("[visionClient] ERROR: Failed to detect diagram regions");
    console.error("[visionClient] Error type:", err.constructor?.name);
    console.error("[visionClient] Error message:", err.message);
    console.error("[visionClient] Error code:", err.code);
    console.error("[visionClient] Error status:", err.status);
    if (err.response) {
      console.error("[visionClient] API Response:", JSON.stringify(err.response, null, 2));
    }
    console.error("[visionClient] Full error:", err);
    console.error("[visionClient] ========================================");
    return { regions: [] };
  }
}
