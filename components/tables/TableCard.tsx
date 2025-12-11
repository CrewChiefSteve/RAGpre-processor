import React, { useState } from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

export interface TableData {
  id: string;
  csvPath?: string;
  summaryPath?: string;
  previewPath?: string;
  headerRow?: string[];
  rowCount?: number;
  columnCount?: number;
  pageRange?: [number, number];
  quality?: 'ok' | 'low_confidence' | 'handwriting';
}

interface TableCardProps {
  table: TableData;
  jobId: string;
}

export default function TableCard({ table, jobId }: TableCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const handleToggleExpand = async () => {
    if (!isExpanded && !previewContent && table.previewPath) {
      setIsLoadingPreview(true);
      try {
        // Fetch the markdown preview
        const response = await fetch(`/api/jobs/${jobId}/tables/${encodeURIComponent(table.id)}/preview`);
        if (response.ok) {
          const text = await response.text();
          setPreviewContent(text);
        }
      } catch (error) {
        console.error('Failed to load preview:', error);
      } finally {
        setIsLoadingPreview(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const handleDownloadCSV = () => {
    if (table.csvPath) {
      const a = document.createElement('a');
      a.href = `/api/jobs/${jobId}/tables/${encodeURIComponent(table.id)}/csv`;
      a.download = `${table.id}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const pageRangeText = table.pageRange
    ? table.pageRange[0] === table.pageRange[1]
      ? `Page ${table.pageRange[0]}`
      : `Pages ${table.pageRange[0]}-${table.pageRange[1]}`
    : 'Unknown';

  return (
    <Card padding="md" className="mb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {table.id}
            </h3>
            {table.quality && (
              <Badge variant={table.quality}>
                {table.quality === 'ok' ? 'Auto OK' : table.quality === 'low_confidence' ? 'Low Confidence' : 'Handwriting'}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <span>📍 {pageRangeText}</span>
            {table.rowCount !== undefined && (
              <span>📊 {table.rowCount} rows</span>
            )}
            {table.columnCount !== undefined && (
              <span>📋 {table.columnCount} columns</span>
            )}
          </div>

          {table.headerRow && table.headerRow.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Headers:
              </div>
              <div className="flex flex-wrap gap-1">
                {table.headerRow.slice(0, 6).map((header, idx) => (
                  <Badge key={idx} variant="pending" size="sm">
                    {header || '(empty)'}
                  </Badge>
                ))}
                {table.headerRow.length > 6 && (
                  <Badge variant="pending" size="sm">
                    +{table.headerRow.length - 6} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 ml-4">
          <button
            onClick={handleDownloadCSV}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            title="Download CSV"
          >
            ⬇️ CSV
          </button>
          <button
            onClick={handleToggleExpand}
            className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {isExpanded ? '▲ Hide' : '▼ Preview'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {isLoadingPreview ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading preview...
            </div>
          ) : previewContent ? (
            <div className="overflow-x-auto">
              <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-4 rounded whitespace-pre">
                {previewContent}
              </pre>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Preview not available
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
