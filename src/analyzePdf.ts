import fs from "fs";
import DocumentIntelligence, {
  getLongRunningPoller,
  isUnexpected,
} from "@azure-rest/ai-document-intelligence";
import { AZURE_DOC_ENDPOINT, AZURE_DOC_KEY } from "./config";

// Type for the analyze result - use 'any' for now since the REST client returns dynamic types
export type AnalyzeResult = any;

export async function analyzePdf(filePath: string): Promise<AnalyzeResult> {
  if (!AZURE_DOC_ENDPOINT || !AZURE_DOC_KEY) {
    throw new Error("Azure config missing. Set AZURE_DOC_ENDPOINT and AZURE_DOC_KEY.");
  }

  console.log(`[analyzePdf] Analyzing: ${filePath}`);

  // Initialize the new REST client with API key authentication
  const client = DocumentIntelligence(
    AZURE_DOC_ENDPOINT,
    { key: AZURE_DOC_KEY }
  );

  // Read file and convert to base64
  const fileBytes = await fs.promises.readFile(filePath);
  const base64Source = fileBytes.toString("base64");

  console.log(`[analyzePdf] Calling Azure Document Intelligence API (v2024-11-30)...`);

  // Start the analysis operation using the new REST API
  const initialResponse = await client
    .path("/documentModels/{modelId}:analyze", "prebuilt-layout")
    .post({
      contentType: "application/json",
      body: {
        base64Source,
      },
    });

  // Check for errors
  if (isUnexpected(initialResponse)) {
    throw new Error(
      `Azure Document Intelligence API error: ${JSON.stringify(initialResponse.body)}`
    );
  }

  // Poll until the operation completes
  const poller = getLongRunningPoller(client, initialResponse);
  const resultResponse = await poller.pollUntilDone();

  if (isUnexpected(resultResponse)) {
    throw new Error(
      `Azure Document Intelligence polling error: ${JSON.stringify(resultResponse.body)}`
    );
  }

  // Extract the analyzeResult from the response
  const analyzeResult = (resultResponse.body as any).analyzeResult;

  if (!analyzeResult) {
    throw new Error("No analyzeResult in response from Azure Document Intelligence");
  }

  console.log(
    `[analyzePdf] Analysis complete - Pages: ${analyzeResult.pages?.length ?? 0}, ` +
    `Tables: ${analyzeResult.tables?.length ?? 0}, ` +
    `Figures: ${analyzeResult.figures?.length ?? 0}`
  );

  // Log detailed figure info if present
  if (analyzeResult.figures && analyzeResult.figures.length > 0) {
    console.log(`[analyzePdf] ✓ Found ${analyzeResult.figures.length} figure(s) from Azure!`);
    analyzeResult.figures.forEach((fig: any, idx: number) => {
      console.log(
        `  Figure ${idx + 1}: id="${fig.id}", ` +
        `boundingRegions=${fig.boundingRegions?.length ?? 0}, ` +
        `caption="${fig.caption?.content?.substring(0, 50) ?? 'none'}"`
      );
    });
  } else {
    console.log(`[analyzePdf] No figures detected by Azure`);
  }

  return analyzeResult;
}
