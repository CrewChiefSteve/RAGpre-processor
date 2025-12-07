'use client';

import { useState } from 'react';
import { JobOutputs } from '@/lib/types/job';
import { LogEntry } from '@/lib/client/jobs';
import DiagramGallery from './diagrams/DiagramGallery';
import TableList from './tables/TableList';
import NarrativeList from './narrative/NarrativeList';
import LogViewer from './logs/LogViewer';
import ManifestViewer from './raw/ManifestViewer';
import Tabs from './ui/Tabs';
import VisionDebugGallery from './debug/vision/VisionDebugGallery';

interface ContentTabsProps {
  jobId: string;
  outputs: JobOutputs | null;
  isLoading: boolean;
  logs?: LogEntry[];
  onRefreshOutputs?: () => void;
}

export default function ContentTabs({
  jobId,
  outputs,
  isLoading,
  logs = [],
  onRefreshOutputs,
}: ContentTabsProps) {
  const [activeTab, setActiveTab] = useState('diagrams');

  // Extract data from manifest
  const diagrams = outputs?.manifest?.diagrams || [];
  const tables = outputs?.manifest?.tables || [];
  const narrativeChunks = outputs?.manifest?.narrativeChunks || [];

  const tabs = [
    { id: 'diagrams', label: 'Diagrams', count: diagrams.length, icon: '🖼️' },
    { id: 'tables', label: 'Tables', count: tables.length, icon: '📋' },
    { id: 'narrative', label: 'Narrative', count: narrativeChunks.length, icon: '📝' },
    { id: 'logs', label: 'Logs', count: logs.length, icon: '📄' },
    { id: 'raw', label: 'Raw', icon: '🔍' },
    { id: 'debug', label: 'Debug', icon: '🐛' },
  ];

  const renderContent = () => {
    if (isLoading && !outputs) {
      return (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-gray-500 dark:text-gray-400">Loading outputs...</div>
        </div>
      );
    }

    if (!outputs && activeTab !== 'logs') {
      return (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              Outputs will appear here once the job completes.
            </p>
            {onRefreshOutputs && (
              <button
                onClick={onRefreshOutputs}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Refresh Outputs
              </button>
            )}
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'diagrams':
        return <DiagramGallery diagrams={diagrams} jobId={jobId} />;

      case 'tables':
        return <TableList tables={tables} jobId={jobId} isLoading={isLoading} />;

      case 'narrative':
        return <NarrativeList chunks={narrativeChunks} isLoading={isLoading} />;

      case 'logs':
        return <LogViewer logs={logs} isLoading={isLoading} />;

      case 'raw':
        return <ManifestViewer manifest={outputs?.manifest} isLoading={isLoading} />;

      case 'debug':
        return <VisionDebugGallery jobId={jobId} />;

      default:
        return null;
    }
  };

  const refreshButton = onRefreshOutputs && outputs ? (
    <button
      onClick={onRefreshOutputs}
      disabled={isLoading}
      className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 transition"
    >
      {isLoading ? '↻ Refreshing...' : '↻ Refresh'}
    </button>
  ) : undefined;

  return (
    <Tabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      rightElement={refreshButton}
    >
      {renderContent()}
    </Tabs>
  );
}
