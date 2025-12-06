'use client';

import { useEffect, useState } from 'react';
import { PreprocessJob, JobOutputs } from '@/lib/types/job';
import { getJob, getJobOutputs, LogEntry, getJobLogs } from '@/lib/client/jobs';
import PhaseTimeline from './PhaseTimeline';
import LogsPanel from './LogsPanel';
import ContentTabs from './ContentTabs';
import Link from 'next/link';
import type { RulebookMetrics } from '@/src/lib/metrics/rulebookMetrics';

interface JobDetailProps {
  jobId: string;
  initialJob: PreprocessJob;
  initialOutputs?: JobOutputs | null;
  rulebookMetrics?: RulebookMetrics[];
}

export default function JobDetail({ jobId, initialJob, initialOutputs, rulebookMetrics = [] }: JobDetailProps) {
  const [job, setJob] = useState<PreprocessJob>(initialJob);
  const [outputs, setOutputs] = useState<JobOutputs | null>(initialOutputs || null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoadingJob, setIsLoadingJob] = useState(false);
  const [isLoadingOutputs, setIsLoadingOutputs] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Polling effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const fetchUpdates = async () => {
      try {
        // Re-fetch job if still pending or running
        if (job.status === 'pending' || job.status === 'running') {
          setIsLoadingJob(true);
          const updatedJob = await getJob(jobId);
          setJob(updatedJob);
          setIsLoadingJob(false);

          // If job just completed, fetch outputs
          if (updatedJob.status === 'completed' && !outputs) {
            setIsLoadingOutputs(true);
            const jobOutputs = await getJobOutputs(jobId);
            setOutputs(jobOutputs);
            setIsLoadingOutputs(false);
          }
        }

        // Always refresh logs
        setIsLoadingLogs(true);
        const updatedLogs = await getJobLogs(jobId);
        setLogs(updatedLogs);
        setIsLoadingLogs(false);
      } catch (err: any) {
        console.error('Error fetching updates:', err);
        setError(err.message || 'Failed to fetch updates');
      }
    };

    // Initial fetch of logs
    fetchUpdates();

    // Set up polling every 3 seconds
    intervalId = setInterval(fetchUpdates, 3000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobId, job.status, outputs]);

  // Handle refresh outputs manually
  const handleRefreshOutputs = async () => {
    try {
      setIsLoadingOutputs(true);
      const jobOutputs = await getJobOutputs(jobId);
      setOutputs(jobOutputs);
      setIsLoadingOutputs(false);
    } catch (err: any) {
      console.error('Error refreshing outputs:', err);
      setError(err.message || 'Failed to refresh outputs');
      setIsLoadingOutputs(false);
    }
  };

  // Handle retry job
  const handleRetry = async () => {
    try {
      setIsRetrying(true);
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to retry job');
      }

      const data = await response.json();
      setJob(data.job);
      setOutputs(null); // Clear outputs
      setIsRetrying(false);
    } catch (err: any) {
      console.error('Error retrying job:', err);
      setError(err.message || 'Failed to retry job');
      setIsRetrying(false);
    }
  };

  // Handle force process
  const handleForceProcess = async () => {
    try {
      setIsProcessing(true);
      const response = await fetch(`/api/jobs/${jobId}/process`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to process job');
      }

      const data = await response.json();
      setJob(data.job);
      setIsProcessing(false);
    } catch (err: any) {
      console.error('Error processing job:', err);
      setError(err.message || 'Failed to process job');
      setIsProcessing(false);
    }
  };

  // Calculate duration
  const getDuration = () => {
    if (!job.startedAt) return '-';
    const end = job.completedAt ? new Date(job.completedAt) : new Date();
    const start = new Date(job.startedAt);
    const durationMs = end.getTime() - start.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'running':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Job Metadata Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Filename</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate" title={job.filename}>
              {job.filename}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusColor(job.status)}`}>
              {job.status.toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{getDuration()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Document Type</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{job.documentType || '-'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400">Created</p>
            <p className="text-gray-900 dark:text-gray-100">{formatTimestamp(job.createdAt)}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Started</p>
            <p className="text-gray-900 dark:text-gray-100">{formatTimestamp(job.startedAt)}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Completed</p>
            <p className="text-gray-900 dark:text-gray-100">{formatTimestamp(job.completedAt)}</p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded text-sm">
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Configuration</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Chunk Size:</span>{' '}
              <span className="text-gray-900 dark:text-gray-100">{job.config.chunkSize}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Overlap:</span>{' '}
              <span className="text-gray-900 dark:text-gray-100">{job.config.chunkOverlap}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Tables:</span>{' '}
              <span className="text-gray-900 dark:text-gray-100">{job.config.enableTables ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Handwriting:</span>{' '}
              <span className="text-gray-900 dark:text-gray-100">{job.config.handwritingVision ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Captions:</span>{' '}
              <span className="text-gray-900 dark:text-gray-100">{job.config.captionDiagrams ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Max Pages:</span>{' '}
              <span className="text-gray-900 dark:text-gray-100">{job.config.maxPages || 'Unlimited'}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleForceProcess}
            disabled={job.status === 'running' || isProcessing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Force Process'}
          </button>
          <button
            onClick={handleRetry}
            disabled={job.status === 'running' || isRetrying}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRetrying ? 'Retrying...' : 'Retry Job'}
          </button>
        </div>
      </div>

      {/* Rulebook Metrics */}
      {rulebookMetrics.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Rulebooks Produced by This Job
          </h2>
          <div className="space-y-4">
            {rulebookMetrics.map((rb) => (
              <Link
                key={rb.rulebookId}
                href={`/rulebooks/${rb.rulebookId}`}
                className="block p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {rb.title}
                    </h3>
                    <div className="flex gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {rb.series && <span>Series: {rb.series}</span>}
                      {rb.year && <span>Year: {rb.year}</span>}
                      {rb.version && <span>Version: {rb.version}</span>}
                      {rb.pageCount && <span>Pages: {rb.pageCount}</span>}
                    </div>
                  </div>
                  <div className="text-blue-600 dark:text-blue-400 hover:underline ml-4">
                    View →
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-3 mt-3 text-center text-sm">
                  <div className="bg-white dark:bg-gray-800 rounded p-2">
                    <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                      {rb.sectionsCount}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">
                      Sections
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded p-2">
                    <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                      {rb.rulesCount}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">
                      Rules
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded p-2">
                    <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                      {rb.tablesCount}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">
                      Tables
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded p-2">
                    <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                      {rb.diagramsCount}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">
                      Diagrams
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded p-2">
                    <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                      {rb.chunksCount}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">
                      Chunks
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Phase Timeline and Logs in Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PhaseTimeline phases={job.phases} />
        <LogsPanel jobId={jobId} initialLogs={logs} />
      </div>

      {/* Content Tabs */}
      <ContentTabs
        jobId={jobId}
        outputs={outputs}
        isLoading={isLoadingOutputs}
        onRefreshOutputs={handleRefreshOutputs}
      />
    </div>
  );
}
