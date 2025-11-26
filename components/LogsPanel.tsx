'use client';

import { useState, useEffect, useRef } from 'react';
import { LogEntry } from '@/lib/client/jobs';

interface LogsPanelProps {
  jobId: string;
  initialLogs?: LogEntry[];
}

export default function LogsPanel({ jobId, initialLogs = [] }: LogsPanelProps) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(false); // Disabled by default to prevent page jumping
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Update logs when initialLogs changes
  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!logsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
    setAutoScroll(isAtBottom);
  };

  // Filter logs based on phase and level
  const filteredLogs = logs.filter((log) => {
    if (phaseFilter !== 'all' && log.phase !== phaseFilter) return false;
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    return true;
  });

  // Get unique phases from logs
  const uniquePhases = Array.from(new Set(logs.map((log) => log.phase))).sort();

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Get level badge color
  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'warn':
      case 'warning':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      case 'info':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'debug':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Processing Logs ({filteredLogs.length})
        </h2>
        <div className="flex gap-2">
          {/* Phase Filter */}
          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Phases</option>
            {uniquePhases.map((phase) => (
              <option key={phase} value={phase}>
                Phase {phase}
              </option>
            ))}
          </select>

          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Levels</option>
            <option value="error">Error</option>
            <option value="warn">Warn</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
        </div>
      </div>

      {/* Logs Container */}
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="bg-gray-900 rounded p-4 h-96 overflow-y-auto font-mono text-xs"
      >
        {filteredLogs.length === 0 ? (
          <p className="text-gray-400">
            {logs.length === 0
              ? 'Waiting for logs...'
              : 'No logs match the current filters.'}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex gap-3 text-gray-300 hover:bg-gray-800 p-1 rounded"
              >
                {/* Timestamp */}
                <span className="text-gray-500 shrink-0">
                  {formatTimestamp(log.createdAt)}
                </span>

                {/* Phase Badge */}
                <span className="px-1.5 py-0.5 rounded bg-purple-900 text-purple-200 shrink-0 font-semibold">
                  {log.phase}
                </span>

                {/* Level Badge */}
                <span
                  className={`px-1.5 py-0.5 rounded shrink-0 font-semibold ${getLevelColor(log.level)}`}
                >
                  {log.level.toUpperCase()}
                </span>

                {/* Message */}
                <span className="text-gray-200 break-all">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <div className="mt-2 text-xs text-center">
          <button
            onClick={() => {
              setAutoScroll(true);
              logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Auto-scroll disabled. Click to jump to latest logs.
          </button>
        </div>
      )}
    </div>
  );
}
