'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PreprocessJob } from '@/lib/types/job';
import { getJobs, searchJobs, filterJobs, deleteJob, deleteAllJobs } from '@/lib/client/jobs';
import DataTable, { Column } from './ui/DataTable';
import Badge from './ui/Badge';

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

  // Handle delete job
  const handleDeleteJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteJob(jobId);
      // Reload jobs after deletion
      await loadJobs();
    } catch (err: any) {
      setError(err.message || 'Failed to delete job');
      console.error('Error deleting job:', err);
    }
  };

  // Handle delete all jobs
  const handleDeleteAllJobs = async () => {
    if (!confirm('Are you sure you want to delete ALL jobs? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      const deletedCount = await deleteAllJobs();
      alert(`Successfully deleted ${deletedCount} job(s)`);
      // Reload jobs after deletion
      await loadJobs();
    } catch (err: any) {
      setError(err.message || 'Failed to delete all jobs');
      console.error('Error deleting all jobs:', err);
    } finally {
      setLoading(false);
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'processing';
      case 'failed':
        return 'error';
      case 'pending':
      default:
        return 'pending';
    }
  };

  const columns: Column<PreprocessJob>[] = [
    {
      key: 'filename',
      header: 'Filename',
      sortable: true,
      render: (job) => (
        <div className="font-medium text-gray-900 dark:text-white">
          {job.filename}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: '120px',
      render: (job) => (
        <Badge variant={getStatusBadge(job.status)}>
          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      width: '150px',
      render: (job) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {formatRelativeTime(job.createdAt)}
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      width: '100px',
      render: (job) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {formatDuration(job)}
        </span>
      ),
    },
    {
      key: 'documentType',
      header: 'Type',
      width: '120px',
      render: (job) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {job.documentType || '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '80px',
      render: (job) => (
        <button
          onClick={(e) => handleDeleteJob(job.id, e)}
          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition"
          title="Delete job"
        >
          🗑️
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={handleStatusFilterChange}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <button
          onClick={loadJobs}
          disabled={loading}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition"
          title="Refresh"
        >
          ↻ Refresh
        </button>
        <button
          onClick={handleDeleteAllJobs}
          disabled={loading || jobs.length === 0}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Delete All
        </button>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {jobs.length} job{jobs.length !== 1 ? 's' : ''}
        {loading && ' (refreshing...)'}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Jobs Table */}
      {loading && jobs.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Loading jobs...
        </div>
      ) : (
        <DataTable
          data={jobs}
          columns={columns}
          keyExtractor={(job) => job.id}
          onRowClick={(job) => handleRowClick(job.id)}
          emptyMessage="No jobs found. Upload a document to get started."
        />
      )}
    </div>
  );
}
