import React, { useState } from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

export interface ChunkData {
  id: string;
  text: string;
  sectionPath?: string[];
  pageRange?: [number, number];
  quality?: 'ok' | 'low_confidence' | 'handwriting';
  tokenCount?: number;
}

interface NarrativeChunkProps {
  chunk: ChunkData;
}

const MAX_PREVIEW_LENGTH = 300;

export default function NarrativeChunk({ chunk }: NarrativeChunkProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const needsTruncation = chunk.text && chunk.text.length > MAX_PREVIEW_LENGTH;
  const displayText = isExpanded || !needsTruncation
    ? chunk.text
    : chunk.text.substring(0, MAX_PREVIEW_LENGTH) + '...';

  const pageRangeText = chunk.pageRange
    ? chunk.pageRange[0] === chunk.pageRange[1]
      ? `Page ${chunk.pageRange[0]}`
      : `Pages ${chunk.pageRange[0]}-${chunk.pageRange[1]}`
    : 'Unknown';

  return (
    <Card padding="md" className="mb-4">
      {/* Breadcrumb */}
      {chunk.sectionPath && chunk.sectionPath.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            {chunk.sectionPath.map((section, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span>›</span>}
                <span className="font-medium">{section}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Text Content */}
      <div className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3 whitespace-pre-wrap">
        {displayText}
      </div>

      {/* Expand/Collapse Button */}
      {needsTruncation && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium mb-3"
        >
          {isExpanded ? '▲ Show less' : '▼ Show more'}
        </button>
      )}

      {/* Footer Metadata */}
      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          📍 {pageRangeText}
        </span>

        {chunk.tokenCount !== undefined && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            🔤 ~{chunk.tokenCount} tokens
          </span>
        )}

        {chunk.quality && (
          <Badge variant={chunk.quality} size="sm">
            {chunk.quality === 'ok' ? 'Auto OK' : chunk.quality === 'low_confidence' ? 'Low Confidence' : 'Handwriting'}
          </Badge>
        )}

        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono ml-auto">
          {chunk.id}
        </span>
      </div>
    </Card>
  );
}
