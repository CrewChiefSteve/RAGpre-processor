import React from 'react';
import Link from 'next/link';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { PreprocessJob } from '@/lib/types/job';

interface RecentJobCardProps {
  job: PreprocessJob;
}

function formatRelativeTime(dateString: string): string {
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
}

function getStatusBadge(status: string) {
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
}

export default function RecentJobCard({ job }: RecentJobCardProps) {
  return (
    <Link href={`/jobs/${job.id}`}>
      <Card hoverable padding="md">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate flex-1 mr-2">
              {job.filename}
            </h3>
            <Badge variant={getStatusBadge(job.status)} size="sm">
              {job.status}
            </Badge>
          </div>

          {/* Details */}
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <div className="flex items-center gap-2">
              <span>🕒</span>
              <span>{formatRelativeTime(job.createdAt)}</span>
            </div>
            {job.documentType && (
              <div className="flex items-center gap-2">
                <span>📄</span>
                <span>{job.documentType}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {job.id.substring(0, 8)}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
