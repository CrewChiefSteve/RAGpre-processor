/**
 * Client-side helper functions for interacting with the Settings API.
 */

export interface Settings {
  id: number;
  chunkSize: number;
  chunkOverlap: number;
  maxPages: number | null;
  enableTables: boolean;
  handwritingVision: boolean;
  captionDiagrams: boolean;
  debug: boolean;
  updatedAt: string;
}

/**
 * Fetches the current global settings.
 */
export async function getSettings(): Promise<Settings> {
  const response = await fetch("/api/settings", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch settings: ${response.statusText}`);
  }

  const data = await response.json();
  return data.settings;
}

/**
 * Updates settings with a partial payload.
 * Only provided fields will be updated.
 */
export async function updateSettings(
  partial: Partial<Omit<Settings, "id" | "updatedAt">>
): Promise<Settings> {
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(partial),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to update settings: ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.settings;
}
