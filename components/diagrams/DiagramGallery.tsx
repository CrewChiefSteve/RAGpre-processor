'use client';

import { useState, useMemo } from 'react';
import DiagramCard from './DiagramCard';
import DiagramFullView from './DiagramFullView';

/**
 * DiagramGallery - Main diagram grid/list view component
 *
 * Displays all diagrams in a responsive grid layout.
 * Each diagram card is clickable and opens a full-screen modal viewer.
 * Supports navigation between diagrams within the modal.
 * Features quality filtering and text search.
 */

interface DiagramAsset {
  id: string;
  title?: string;
  imagePath: string;
  page?: number;
  quality: string;
  description?: string;
  rawCaptionText?: string;
  origin?: string;
  sourcePdf?: string;
  sectionPath?: string[];
}

interface DiagramGalleryProps {
  diagrams: DiagramAsset[];
  jobId: string;
}

type QualityFilter = 'all' | 'ok' | 'low_confidence' | 'handwriting';

export default function DiagramGallery({
  diagrams = [],
  jobId = '',
}: DiagramGalleryProps) {
  const [selectedDiagram, setSelectedDiagram] = useState<DiagramAsset | null>(null);
  const [activeQualityFilter, setActiveQualityFilter] = useState<QualityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter and search logic
  const filteredDiagrams = useMemo(() => {
    let result = diagrams;

    // Apply quality filter
    if (activeQualityFilter !== 'all') {
      result = result.filter((d) => d.quality === activeQualityFilter);
    }

    // Apply text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((d) => {
        const title = d.title?.toLowerCase() || '';
        const caption = d.rawCaptionText?.toLowerCase() || '';
        const description = d.description?.toLowerCase() || '';
        return title.includes(query) || caption.includes(query) || description.includes(query);
      });
    }

    return result;
  }, [diagrams, activeQualityFilter, searchQuery]);

  // Clear all filters
  const handleClearFilters = () => {
    setActiveQualityFilter('all');
    setSearchQuery('');
  };

  // Handle click on a diagram card
  const handleDiagramClick = (diagram: DiagramAsset) => {
    setSelectedDiagram(diagram);
  };

  // Handle closing the modal
  const handleCloseModal = () => {
    setSelectedDiagram(null);
  };

  // Handle navigation within modal
  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!selectedDiagram) return;

    const currentIndex = diagrams.findIndex((d) => d.id === selectedDiagram.id);
    let newIndex = currentIndex;

    if (direction === 'prev' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (direction === 'next' && currentIndex < diagrams.length - 1) {
      newIndex = currentIndex + 1;
    }

    if (newIndex !== currentIndex) {
      setSelectedDiagram(diagrams[newIndex]);
    }
  };

  // Empty state
  if (diagrams.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center max-w-md">
          <svg
            className="w-20 h-20 mx-auto text-gray-400 dark:text-gray-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Diagrams Detected
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No diagrams or figures were detected in this document. If you expect diagrams,
            try enabling diagram captioning or verify that the document contains figures.
          </p>
        </div>
      </div>
    );
  }

  // Gallery view
  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Diagrams & Figures
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredDiagrams.length} of {diagrams.length} diagram{diagrams.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Quality Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              Quality:
            </span>
            {(['all', 'ok', 'low_confidence', 'handwriting'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveQualityFilter(filter)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                  activeQualityFilter === filter
                    ? 'bg-blue-600 text-white shadow-sm'
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

          {/* Search Input */}
          <div className="flex-1 min-w-[200px] sm:max-w-sm">
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
                placeholder="Search captions and descriptions..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filtered Empty State */}
        {filteredDiagrams.length === 0 && diagrams.length > 0 ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="text-center max-w-md">
              <svg
                className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No diagrams match your filters
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Try adjusting your quality filter or search query to see more results.
              </p>
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
              >
                Clear filters
              </button>
            </div>
          </div>
        ) : (
          /* Responsive Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDiagrams.map((diagram) => (
              <DiagramCard
                key={diagram.id}
                diagram={diagram}
                jobId={jobId}
                onClick={() => handleDiagramClick(diagram)}
              />
            ))}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Tip:</strong> Click any diagram card to view the full-size image with complete metadata.
          </p>
        </div>
      </div>

      {/* Modal Viewer */}
      {selectedDiagram && (
        <DiagramFullView
          diagram={selectedDiagram}
          diagrams={diagrams}
          jobId={jobId}
          onClose={handleCloseModal}
          onNavigate={handleNavigate}
        />
      )}
    </>
  );
}
