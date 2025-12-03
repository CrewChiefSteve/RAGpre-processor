'use client';

import { useState } from 'react';
import { JobOutputs, ChunkOutput } from '@/lib/types/job';
import DiagramGallery from './diagrams/DiagramGallery';
import VisionDebugGallery from './debug/vision/VisionDebugGallery';

interface ContentTabsProps {
  jobId: string;
  outputs: JobOutputs | null;
  isLoading: boolean;
  onRefreshOutputs?: () => void;
}

export default function ContentTabs({
  jobId,
  outputs,
  isLoading,
  onRefreshOutputs,
}: ContentTabsProps) {
  const [activeTab, setActiveTab] = useState('raw');
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

  // Extract diagrams from manifest
  const diagrams = outputs?.manifest?.diagrams || [];

  const tabs = [
    { id: 'raw', label: 'Raw Text', count: outputs?.rawText ? 1 : 0 },
    { id: 'cleaned', label: 'Cleaned Text', count: outputs?.cleanedText ? 1 : 0 },
    { id: 'chunks', label: 'Chunks', count: outputs?.chunks?.length || 0 },
    { id: 'diagrams', label: 'Diagrams', count: diagrams.length },
    { id: 'manifest', label: 'Manifest', count: outputs?.manifest ? 1 : 0 },
    { id: 'debug', label: 'Debug', count: 0 },
  ];

  const toggleChunk = (chunkId: string) => {
    const newExpanded = new Set(expandedChunks);
    if (newExpanded.has(chunkId)) {
      newExpanded.delete(chunkId);
    } else {
      newExpanded.add(chunkId);
    }
    setExpandedChunks(newExpanded);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-gray-500 dark:text-gray-400">Loading outputs...</div>
        </div>
      );
    }

    if (!outputs) {
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
      case 'raw':
        return (
          <div>
            {outputs.rawText ? (
              <pre className="bg-gray-50 dark:bg-gray-900 rounded p-4 overflow-x-auto text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                {outputs.rawText}
              </pre>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                No raw text available.
              </div>
            )}
          </div>
        );

      case 'cleaned':
        return (
          <div>
            {outputs.cleanedText ? (
              <pre className="bg-gray-50 dark:bg-gray-900 rounded p-4 overflow-x-auto text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                {outputs.cleanedText}
              </pre>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                No cleaned text available.
              </div>
            )}
          </div>
        );

      case 'chunks':
        return (
          <div className="space-y-3">
            {outputs.chunks && outputs.chunks.length > 0 ? (
              <>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Total chunks: {outputs.chunks.length}
                </div>
                {outputs.chunks.map((chunk) => {
                  const isExpanded = expandedChunks.has(chunk.id);
                  const preview = chunk.text.slice(0, 200);
                  const showToggle = chunk.text.length > 200;

                  return (
                    <div
                      key={chunk.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            Chunk {chunk.order}
                          </span>
                          {chunk.tokenCount && (
                            <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                              {chunk.tokenCount} tokens
                            </span>
                          )}
                        </div>
                        {showToggle && (
                          <button
                            onClick={() => toggleChunk(chunk.id)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </button>
                        )}
                      </div>

                      <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                        {isExpanded ? chunk.text : preview}
                        {!isExpanded && showToggle && '...'}
                      </pre>

                      {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                        <details className="mt-3">
                          <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                            Metadata
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                            {JSON.stringify(chunk.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                No chunks available.
              </div>
            )}
          </div>
        );

      case 'diagrams':
        return <DiagramGallery diagrams={diagrams} jobId={jobId} />;

      case 'manifest':
        return (
          <div>
            {outputs.manifest ? (
              <div>
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(outputs.manifest, null, 2)], {
                        type: 'application/json',
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `manifest-${jobId}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition"
                  >
                    Download JSON
                  </button>
                </div>
                <pre className="bg-gray-50 dark:bg-gray-900 rounded p-4 overflow-x-auto text-xs text-gray-900 dark:text-gray-100">
                  {JSON.stringify(outputs.manifest, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                No manifest available.
              </div>
            )}
          </div>
        );

      case 'debug':
        return <VisionDebugGallery jobId={jobId} />;

      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <nav className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
        {onRefreshOutputs && outputs && (
          <button
            onClick={onRefreshOutputs}
            disabled={isLoading}
            className="mr-4 px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </div>

      <div className="p-6">{renderContent()}</div>
    </div>
  );
}
