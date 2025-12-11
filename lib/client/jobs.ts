import { PreprocessJob, JobOutputs } from '@/lib/types/job';

/**
 * Log entry from the API
 */
export interface LogEntry {
  id: string;
  jobId: string;
  phase: string;
  level: string;
  message: string;
  createdAt: string;
}

/**
 * Fetches all jobs from the API
 */
export async function getJobs(): Promise<PreprocessJob[]> {
  const response = await fetch('/api/jobs', {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch jobs: ${response.statusText}`);
  }

  const data = await response.json();
  return data.jobs || [];
}

/**
 * Searches jobs by filename query
 */
export async function searchJobs(query: string): Promise<PreprocessJob[]> {
  const params = new URLSearchParams({ search: query });
  const response = await fetch(`/api/jobs?${params}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to search jobs: ${response.statusText}`);
  }

  const data = await response.json();
  return data.jobs || [];
}

/**
 * Filters jobs by status
 */
export async function filterJobs(status: string): Promise<PreprocessJob[]> {
  const params = new URLSearchParams({ status });
  const response = await fetch(`/api/jobs?${params}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to filter jobs: ${response.statusText}`);
  }

  const data = await response.json();
  return data.jobs || [];
}

/**
 * Fetches a single job by ID
 */
export async function getJob(id: string): Promise<PreprocessJob> {
  const response = await fetch(`/api/jobs/${id}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch job: ${response.statusText}`);
  }

  const data = await response.json();
  return data.job;
}

/**
 * Fetches logs for a specific job
 * @param id - Job ID
 * @param phase - Optional phase filter (A, B, C, D)
 */
export async function getJobLogs(id: string, phase?: string): Promise<LogEntry[]> {
  const url = phase
    ? `/api/jobs/${id}/logs?phase=${encodeURIComponent(phase)}`
    : `/api/jobs/${id}/logs`;

  const response = await fetch(url, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch logs: ${response.statusText}`);
  }

  const data = await response.json();
  return data.logs || [];
}

/**
 * Fetches outputs for a specific job
 * @param id - Job ID
 */
export async function getJobOutputs(id: string): Promise<JobOutputs> {
  const response = await fetch(`/api/jobs/${id}/outputs`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch outputs: ${response.statusText}`);
  }

  const data = await response.json();
  return data.outputs || {};
}

/**
 * Get the public URL for a diagram image
 * @param jobId - Job ID
 * @param imagePath - Relative path from diagram metadata (e.g., "diagrams/images/diagram_1.png" or "diagrams\\images\\diagram_1.png")
 * @returns Public URL to access the diagram image
 */
export function getDiagramImageUrl(jobId: string, imagePath: string): string {
  // Normalize path: convert backslashes to forward slashes (Windows paths)
  // and remove leading "diagrams/" since API route already includes it
  const cleanPath = imagePath
    .replace(/\\/g, '/')  // Normalize backslashes to forward slashes
    .replace(/^diagrams\//, '');  // Remove leading "diagrams/"

  return `/api/jobs/${jobId}/diagrams/${cleanPath}`;
}

/**
 * Get the public URL for a vision debug artifact
 * @param jobId - Job ID
 * @param relativePath - Relative path from debug/vision directory
 * @returns Public URL to access the debug artifact
 *
 * Examples:
 * - getVisionDebugUrl("abc123", "pages/page-001.png")
 *   → "/api/jobs/abc123/debug/vision/pages/page-001.png"
 *
 * - getVisionDebugUrl("abc123", "segments/page-001_segments.json")
 *   → "/api/jobs/abc123/debug/vision/segments/page-001_segments.json"
 */
export function getVisionDebugUrl(jobId: string, relativePath: string): string {
  // Clean path (remove leading slash or "debug/vision/" if present)
  const cleanPath = relativePath
    .replace(/^\/+/, '')
    .replace(/^debug\/vision\//, '');

  return `/api/jobs/${jobId}/debug/vision/${cleanPath}`;
}

/**
 * Helper to build overlay image URL for a specific page
 * @param jobId - Job ID
 * @param pageNumber - Page number (1-based)
 * @returns URL to the overlay PNG for this page
 */
export function getVisionDebugOverlayUrl(jobId: string, pageNumber: number): string {
  const paddedPage = String(pageNumber).padStart(3, '0');
  return getVisionDebugUrl(jobId, `pages/page-${paddedPage}_overlay.png`);
}

/**
 * Helper to build segments JSON URL for a specific page
 * @param jobId - Job ID
 * @param pageNumber - Page number (1-based)
 * @returns URL to the segments JSON for this page
 */
export function getVisionDebugSegmentsUrl(jobId: string, pageNumber: number): string {
  const paddedPage = String(pageNumber).padStart(3, '0');
  return getVisionDebugUrl(jobId, `segments/page-${paddedPage}_segments.json`);
}

/**
 * Delete a single job by ID
 * @param id - Job ID to delete
 */
export async function deleteJob(id: string): Promise<void> {
  const response = await fetch(`/api/jobs/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete job: ${response.statusText}`);
  }
}

/**
 * Delete all jobs
 * @returns Number of jobs deleted
 */
export async function deleteAllJobs(): Promise<number> {
  const response = await fetch('/api/jobs', {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete all jobs: ${response.statusText}`);
  }

  const data = await response.json();
  return data.deletedCount || 0;
}
