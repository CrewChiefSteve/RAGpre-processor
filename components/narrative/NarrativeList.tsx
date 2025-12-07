import React, { useState, useMemo } from 'react';
import NarrativeChunk, { ChunkData } from './NarrativeChunk';
import Skeleton from '../ui/Skeleton';

interface NarrativeListProps {
  chunks: ChunkData[];
  isLoading?: boolean;
}

export default function NarrativeList({ chunks, isLoading }: NarrativeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [qualityFilter, setQualityFilter] = useState<'all' | 'ok' | 'low_confidence' | 'handwriting'>('all');

  const filteredChunks = useMemo(() => {
    let result = chunks;

    // Quality filter
    if (qualityFilter !== 'all') {
      result = result.filter((c) => c.quality === qualityFilter);
    }

    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) => {
        const text = c.text?.toLowerCase() || '';
        const section = c.sectionPath?.join(' ').toLowerCase() || '';
        return text.includes(query) || section.includes(query);
      });
    }

    return result;
  }, [chunks, qualityFilter, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height="200px" />
        ))}
      </div>
    );
  }

  if (chunks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          No Narrative Content Found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          This document doesn't contain any narrative text chunks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search narrative content..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Quality Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
              Quality:
            </span>
            <div className="flex gap-2">
              {(['all', 'ok', 'low_confidence', 'handwriting'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setQualityFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                    qualityFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {filter === 'all' && 'All'}
                  {filter === 'ok' && 'OK'}
                  {filter === 'low_confidence' && 'Low Confidence'}
                  {filter === 'handwriting' && 'Handwriting'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredChunks.length} of {chunks.length} chunk{chunks.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Chunks */}
      {filteredChunks.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No chunks match your filters
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Try adjusting your search or quality filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setQualityFilter('all');
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition"
          >
            Clear filters
          </button>
        </div>
      ) : (
        filteredChunks.map((chunk) => (
          <NarrativeChunk key={chunk.id} chunk={chunk} />
        ))
      )}
    </div>
  );
}
