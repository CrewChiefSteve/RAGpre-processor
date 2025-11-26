import fs from "fs";
import { AzureKeyCredential } from "@azure/core-auth";
import { DocumentAnalysisClient } from "@azure/ai-form-recognizer";
import { AZURE_DOC_ENDPOINT, AZURE_DOC_KEY } from "./config";

export async function analyzePdf(filePath: string) {
  if (!AZURE_DOC_ENDPOINT || !AZURE_DOC_KEY) {
    throw new Error("Azure config missing. Set AZURE_DOC_ENDPOINT and AZURE_DOC_KEY.");
  }

  console.log(`[analyzePdf] Analyzing: ${filePath}`);

  const client = new DocumentAnalysisClient(
    AZURE_DOC_ENDPOINT,
    new AzureKeyCredential(AZURE_DOC_KEY)
  );

  const fileBytes = await fs.promises.readFile(filePath);

  const poller = await client.beginAnalyzeDocument("prebuilt-layout", fileBytes);
  const result = await poller.pollUntilDone();

  if (!result) {
    throw new Error("No result from Azure Document Intelligence");
  }

  console.log(
    `[analyzePdf] Pages: ${result.pages?.length ?? 0}, tables: ${
      result.tables?.length ?? 0
    }`
  );

  return result;
}
