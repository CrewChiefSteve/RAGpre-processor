import dotenv from "dotenv";

dotenv.config();

export const AZURE_DOC_ENDPOINT = process.env.AZURE_DOC_ENDPOINT ?? "";
export const AZURE_DOC_KEY = process.env.AZURE_DOC_KEY ?? "";

if (!AZURE_DOC_ENDPOINT || !AZURE_DOC_KEY) {
  console.warn(
    "[config] Missing AZURE_DOC_ENDPOINT or AZURE_DOC_KEY – set them in .env"
  );
}

export type PreprocessOptions = {
  inputPath: string;
  outDir: string;
  // later: model name, class (TA2, etc.), debug flags, etc.
};
