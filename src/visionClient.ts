import fs from "fs";
import path from "path";
import OpenAI from "openai";
// Import config to ensure dotenv.config() runs before accessing env vars
import "./config";
import { trace } from "./debugTrace";

const apiKey = process.env.OPENAI_API_KEY;

trace("visionClient module loaded", {
  hasApiKey: !!apiKey,
  model: process.env.VISION_MODEL,
  enableVisionDiagramSegmentation: process.env.ENABLE_VISION_DIAGRAM_SEGMENTATION
});

if (!apiKey) {
  console.warn("[visionClient] OPENAI_API_KEY not set. Vision features will be disabled.");
}

const openai = apiKey ? new OpenAI({ apiKey }) : null;

trace("OpenAI client", { initialized: !!openai });

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

  // Validate image exists and has content
  const stats = await fs.promises.stat(imagePath);
  if (stats.size < 100) {
    console.warn(`[visionClient] Image too small (${stats.size} bytes): ${imagePath}`);
    return null;
  }

  const base64 = await readImageAsBase64(imagePath);

  // Improved prompt that handles both technical diagrams AND non-technical images
  const prompt = [
    "Analyze this image extracted from a racing rulebook PDF.",
    "",
    "IMPORTANT: Describe what you ACTUALLY SEE in this specific image.",
    "",
    "If this is a TECHNICAL DIAGRAM (showing measurements, angles, parts, specifications):",
    "- List the labeled components visible in the image",
    "- Note any dimensions, angles, or measurements shown",
    "- Describe limits, constraints, or requirements indicated",
    "- Explain what this diagram is used for in race preparation or inspection",
    "",
    "If this is a LOGO, PHOTO, or DECORATIVE IMAGE:",
    "- Identify what it shows (e.g., 'SVRA organization logo', 'Photo of a race car')",
    "- Note it is not a technical diagram",
    "- Keep description brief (1-2 sentences)",
    "",
    "Be factual and specific. Only describe what you can actually see in the image.",
  ];

  if (extraContext && extraContext.trim()) {
    prompt.push("");
    prompt.push(`Additional context from the document: ${extraContext.trim()}`);
  }

  try {
    const response = await openai.chat.completions.create({
      model: process.env.VISION_MODEL ?? "gpt-4o-mini",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt.join("\n") },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64}`,
                detail: "high" // Request high detail for better technical diagram analysis
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn(`[visionClient] No content returned for ${imagePath}`);
      return null;
    }

    // content is a string in this SDK version
    const description = typeof content === "string" ? content : JSON.stringify(content);

    // Detect if model refused (boilerplate response)
    if (description.includes("I'm unable to make observations") ||
        description.includes("I cannot")) {
      console.warn(`[visionClient] Model refused to analyze ${imagePath}`);
      console.warn(`[visionClient] Response: ${description.substring(0, 200)}...`);
      return null; // Return null instead of boilerplate
    }

    return description;

  } catch (error: any) {
    console.error(`[visionClient] Failed to caption ${imagePath}:`, error.message);
    return null;
  }
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

  trace("detectDiagramRegionsInImage called", {
    imagePath: opts.imagePath,
    hasOpenAI: !!openai,
    debug: opts.debug
  });

  if (!openai) {
    console.warn('[visionClient] No OpenAI client - returning empty regions');
    trace("detectDiagramRegionsInImage: no OpenAI client");
    return { regions: [] };
  }

  const { imagePath, context, debug } = opts;

  const base64 = await readImageAsBase64(imagePath);
  trace("image loaded as base64", { base64Length: base64.length });

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
    trace("calling vision API", { model: process.env.VISION_MODEL ?? "gpt-4o-mini" });

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
    trace("vision API call successful");

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
    trace("vision API response", { resultCount: regions.length, rawRegionsCount: rawRegions.length });

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

    trace("vision API error", {
      errorType: err.constructor?.name,
      errorMessage: err.message,
      errorCode: err.code,
      errorStatus: err.status
    });

    return { regions: [] };
  }
}
