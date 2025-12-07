import React from 'react';
import Badge, { type BadgeVariant } from '../ui/Badge';
import { PreprocessJob } from '@/lib/types/job';

interface JobHeaderProps {
  job: PreprocessJob;
  duration?: string;
}

function getStatusBadge(status: string): { variant: BadgeVariant; label: string } {
  switch (status) {
    case 'completed':
      return { variant: 'success', label: '✅ Completed' };
    case 'running':
      return { variant: 'processing', label: '⏳ Processing' };
    case 'failed':
      return { variant: 'error', label: '❌ Failed' };
    case 'pending':
      return { variant: 'pending', label: '⏸️ Pending' };
    default:
      return { variant: 'pending', label: status };
  }
}

function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return '--';

  const end = completedAt ? new Date(completedAt) : new Date();
  const diff = end.getTime() - new Date(startedAt).getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatTimestamp(date?: string): string {
  if (!date) return '--';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export default function JobHeader({ job, duration }: JobHeaderProps) {
  const statusBadge = getStatusBadge(job.status);
  const calculatedDuration = duration || formatDuration(job.startedAt, job.completedAt);
  const timestamp = formatTimestamp(job.createdAt);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3 mb-2">
            📄 {job.filename}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            <span>•</span>
            <span>Duration: {calculatedDuration}</span>
            <span>•</span>
            <span>{timestamp}</span>
          </div>
        </div>
      </div>

      {job.status === 'failed' && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
          <p className="text-sm text-red-800 dark:text-red-300">
            <strong>Error:</strong> Job processing failed. Check logs for details.
          </p>
        </div>
      )}
    </div>
  );
}
