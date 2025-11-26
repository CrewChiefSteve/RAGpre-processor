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
 * @param imagePath - Relative path from diagram metadata (e.g., "diagrams/images/diagram_1.png")
 * @returns Public URL to access the diagram image
 */
export function getDiagramImageUrl(jobId: string, imagePath: string): string {
  // imagePath format: "diagrams/images/diagram_1.png"
  // Remove leading "diagrams/" if present since API route already includes it
  const cleanPath = imagePath.startsWith('diagrams/')
    ? imagePath.substring('diagrams/'.length)
    : imagePath;

  return `/api/jobs/${jobId}/diagrams/${cleanPath}`;
}
