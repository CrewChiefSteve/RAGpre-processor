import React, { useState, useMemo, useEffect, useRef } from 'react';
import Badge from '../ui/Badge';
import { LogEntry } from '@/lib/client/jobs';

interface LogViewerProps {
  logs: LogEntry[];
  isLoading?: boolean;
  isLive?: boolean; // Auto-scroll for live logs
}

export default function LogViewer({ logs, isLoading, isLive }: LogViewerProps) {
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warning' | 'error'>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoScroll, setAutoScroll] = useState(isLive || false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Extract unique phases
  const phases = useMemo(() => {
    const uniquePhases = new Set(logs.map((log) => log.phase));
    return ['all', ...Array.from(uniquePhases)];
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    let result = logs;

    if (levelFilter !== 'all') {
      result = result.filter((log) => log.level === levelFilter);
    }

    if (phaseFilter !== 'all') {
      result = result.filter((log) => log.phase === phaseFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((log) => log.message.toLowerCase().includes(query));
    }

    return result;
  }, [logs, levelFilter, phaseFilter, searchQuery]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'pending';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
              Level:
            </span>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as any)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Phase Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
              Phase:
            </span>
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {phases.map((phase) => (
                <option key={phase} value={phase}>
                  {phase === 'all' ? 'All' : phase.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-scroll toggle */}
          {isLive && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                Auto-scroll
              </span>
            </label>
          )}
        </div>

        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredLogs.length} of {logs.length} log{logs.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Log Container */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div
          ref={logContainerRef}
          className={`font-mono text-xs bg-gray-900 text-gray-100 p-4 overflow-auto transition-all ${
            isExpanded ? 'max-h-[800px]' : 'max-h-[400px]'
          }`}
        >
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Loading logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {logs.length === 0 ? 'No logs available' : 'No logs match your filters'}
            </div>
          ) : (
            filteredLogs.map((log, idx) => (
              <div
                key={log.id || idx}
                className={`py-1 px-2 hover:bg-gray-800 rounded ${
                  log.level === 'error'
                    ? 'text-red-400'
                    : log.level === 'warning'
                    ? 'text-yellow-400'
                    : 'text-gray-300'
                }`}
              >
                <span className="text-gray-500">[{formatTimestamp(log.createdAt)}]</span>
                <span className="text-blue-400 ml-2">[{log.phase.toUpperCase()}]</span>
                <span className="ml-2">{log.message}</span>
              </div>
            ))
          )}
        </div>

        {/* Expand/Collapse Button */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-2 text-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            {isExpanded ? '▲ Show less' : '▼ Show more'}
          </button>
        </div>
      </div>
    </div>
  );
}
