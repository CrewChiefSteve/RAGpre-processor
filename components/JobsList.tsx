'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PreprocessJob, JobStatus } from '@/lib/types/job';
import { getJobs, searchJobs, filterJobs } from '@/lib/client/jobs';
import StatusBadge from './StatusBadge';

interface JobsListProps {
  initialJobs?: PreprocessJob[];
}

export default function JobsList({ initialJobs = [] }: JobsListProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState<PreprocessJob[]>(initialJobs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay}d ago`;
  };

  // Calculate duration
  const formatDuration = (job: PreprocessJob) => {
    if (!job.startedAt) return '-';

    const startTime = new Date(job.startedAt).getTime();
    const endTime = job.completedAt
      ? new Date(job.completedAt).getTime()
      : new Date().getTime();

    const durationMs = endTime - startTime;
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Load jobs
  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let fetchedJobs: PreprocessJob[];

      if (searchQuery && statusFilter !== 'all') {
        // If both search and filter, need to fetch all and filter client-side
        // or modify backend to support both - for now, prioritize search
        fetchedJobs = await searchJobs(searchQuery);
        if (statusFilter !== 'all') {
          fetchedJobs = fetchedJobs.filter(j => j.status === statusFilter);
        }
      } else if (searchQuery) {
        fetchedJobs = await searchJobs(searchQuery);
      } else if (statusFilter !== 'all') {
        fetchedJobs = await filterJobs(statusFilter);
      } else {
        fetchedJobs = await getJobs();
      }

      setJobs(fetchedJobs);
    } catch (err: any) {
      setError(err.message || 'Failed to load jobs');
      console.error('Error loading jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  // Handle search input with debouncing
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for 300ms
    const timeout = setTimeout(() => {
      // The search will trigger via useEffect when searchQuery updates
    }, 300);
    setSearchTimeout(timeout);
  };

  // Handle status filter change
  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
  };

  // Handle row click
  const handleRowClick = (jobId: string) => {
    router.push(`/jobs/${jobId}`);
  };

  // Load jobs when filters change
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Auto-refresh every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadJobs();
    }, 3000);

    return () => clearInterval(interval);
  }, [loadJobs]);

  return (
    <div className="p-6">
      {/* Search and Filter Controls */}
      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Search jobs..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        />
        <select
          value={statusFilter}
          onChange={handleStatusFilterChange}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && jobs.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Loading jobs...
        </div>
      )}

      {/* Jobs Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">ID</th>
              <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">Filename</th>
              <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">Status</th>
              <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">Created</th>
              <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">Duration</th>
              <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">Document Type</th>
              <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No jobs found. Upload a document to get started.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr
                  key={job.id}
                  onClick={() => handleRowClick(job.id)}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition"
                >
                  <td className="py-3 px-4 text-gray-900 dark:text-gray-100 font-mono text-sm">
                    {job.id.substring(0, 6)}
                  </td>
                  <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                    {job.filename}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                    {formatRelativeTime(job.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                    {formatDuration(job)}
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                    {job.documentType || '-'}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(job.id);
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
