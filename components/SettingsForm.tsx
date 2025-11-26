"use client";

import { useState } from "react";
import { updateSettings } from "@/lib/client/settings";

interface SettingsFormProps {
  initialSettings: {
    id: number;
    chunkSize: number;
    chunkOverlap: number;
    maxPages: number | null;
    enableTables: boolean;
    handwritingVision: boolean;
    captionDiagrams: boolean;
    debug: boolean;
    updatedAt?: Date | string;
  };
}

export default function SettingsForm({ initialSettings }: SettingsFormProps) {
  // Form state
  const [chunkSize, setChunkSize] = useState(String(initialSettings.chunkSize));
  const [chunkOverlap, setChunkOverlap] = useState(
    String(initialSettings.chunkOverlap)
  );
  const [maxPages, setMaxPages] = useState<string>(
    initialSettings.maxPages != null ? String(initialSettings.maxPages) : ""
  );
  const [enableTables, setEnableTables] = useState(
    initialSettings.enableTables
  );
  const [handwritingVision, setHandwritingVision] = useState(
    initialSettings.handwritingVision
  );
  const [captionDiagrams, setCaptionDiagrams] = useState(
    initialSettings.captionDiagrams
  );
  const [debug, setDebug] = useState(initialSettings.debug);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      // Build partial payload
      const payload: {
        chunkSize: number;
        chunkOverlap: number;
        maxPages: number | null;
        enableTables: boolean;
        handwritingVision: boolean;
        captionDiagrams: boolean;
        debug: boolean;
      } = {
        chunkSize: Number(chunkSize),
        chunkOverlap: Number(chunkOverlap),
        maxPages:
          maxPages.trim() === ""
            ? null
            : Number(maxPages) > 0
            ? Number(maxPages)
            : null,
        enableTables,
        handwritingVision,
        captionDiagrams,
        debug,
      };

      const updated = await updateSettings(payload);

      // Sync state with server response to avoid drift
      setChunkSize(String(updated.chunkSize));
      setChunkOverlap(String(updated.chunkOverlap));
      setMaxPages(
        updated.maxPages != null ? String(updated.maxPages) : ""
      );
      setEnableTables(updated.enableTables);
      setHandwritingVision(updated.handwritingVision);
      setCaptionDiagrams(updated.captionDiagrams);
      setDebug(updated.debug);

      setSuccess("Settings saved successfully.");
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save settings. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error alert */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Success alert */}
      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Text Chunking Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">
          Text Chunking
        </h2>

        <div>
          <label
            htmlFor="chunkSize"
            className="block text-sm font-medium mb-1"
          >
            Chunk Size
          </label>
          <input
            type="number"
            id="chunkSize"
            value={chunkSize}
            onChange={(e) => setChunkSize(e.target.value)}
            min="1"
            className="w-full px-3 py-2 border rounded-md"
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Controls how large each chunk is for RAG (in characters).
          </p>
        </div>

        <div>
          <label
            htmlFor="chunkOverlap"
            className="block text-sm font-medium mb-1"
          >
            Chunk Overlap
          </label>
          <input
            type="number"
            id="chunkOverlap"
            value={chunkOverlap}
            onChange={(e) => setChunkOverlap(e.target.value)}
            min="0"
            className="w-full px-3 py-2 border rounded-md"
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Overlap between chunks helps preserve context across boundaries.
          </p>
        </div>

        <div>
          <label
            htmlFor="maxPages"
            className="block text-sm font-medium mb-1"
          >
            Max Pages (Optional)
          </label>
          <input
            type="number"
            id="maxPages"
            value={maxPages}
            onChange={(e) => setMaxPages(e.target.value)}
            min="1"
            placeholder="No limit"
            className="w-full px-3 py-2 border rounded-md"
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty for no limit. Otherwise, only process the first N
            pages.
          </p>
        </div>
      </div>

      {/* Feature Toggles Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">
          Feature Toggles
        </h2>

        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="enableTables"
            checked={enableTables}
            onChange={(e) => setEnableTables(e.target.checked)}
            className="mt-1"
            disabled={isSaving}
          />
          <div>
            <label htmlFor="enableTables" className="text-sm font-medium">
              Enable Tables
            </label>
            <p className="text-xs text-muted-foreground">
              Extract and export tables from documents as CSV files.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="handwritingVision"
            checked={handwritingVision}
            onChange={(e) => setHandwritingVision(e.target.checked)}
            className="mt-1"
            disabled={isSaving}
          />
          <div>
            <label
              htmlFor="handwritingVision"
              className="text-sm font-medium"
            >
              Handwriting Vision
            </label>
            <p className="text-xs text-muted-foreground">
              Use OpenAI vision models to transcribe handwritten notes (Phase
              D).
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="captionDiagrams"
            checked={captionDiagrams}
            onChange={(e) => setCaptionDiagrams(e.target.checked)}
            className="mt-1"
            disabled={isSaving}
          />
          <div>
            <label htmlFor="captionDiagrams" className="text-sm font-medium">
              Caption Diagrams
            </label>
            <p className="text-xs text-muted-foreground">
              Generate technical captions for diagrams using vision models
              (Phase D).
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="debug"
            checked={debug}
            onChange={(e) => setDebug(e.target.checked)}
            className="mt-1"
            disabled={isSaving}
          />
          <div>
            <label htmlFor="debug" className="text-sm font-medium">
              Debug Mode
            </label>
            <p className="text-xs text-muted-foreground">
              Enable verbose logging for troubleshooting.
            </p>
          </div>
        </div>
      </div>

      {/* Submit button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </form>
  );
}
