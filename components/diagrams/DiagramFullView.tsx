'use client';

import { useEffect, useState } from 'react';
import { getDiagramImageUrl } from '@/lib/client/jobs';

/**
 * DiagramFullView - Full-size diagram viewer modal
 *
 * Features:
 * - Full-screen modal with backdrop
 * - Large image display
 * - Complete metadata panel
 * - Navigation between diagrams
 * - Download and "open in new tab" actions
 * - Keyboard shortcuts (ESC, arrows)
 * - Click outside to close
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

interface DiagramFullViewProps {
  diagram: DiagramAsset;
  diagrams: DiagramAsset[];
  jobId: string;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
}

export default function DiagramFullView({
  diagram,
  diagrams,
  jobId,
  onClose,
  onNavigate,
}: DiagramFullViewProps) {
  const [imageError, setImageError] = useState(false);
  const [showMetadata, setShowMetadata] = useState(true);

  // Find current index
  const currentIndex = diagrams.findIndex((d) => d.id === diagram.id);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === diagrams.length - 1;

  // Navigation handlers
  const handlePrevious = () => {
    if (!isFirst) {
      onNavigate('prev');
    }
  };

  const handleNext = () => {
    if (!isLast) {
      onNavigate('next');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && !isFirst) {
        handlePrevious();
      } else if (e.key === 'ArrowRight' && !isLast) {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate, isFirst, isLast]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const imageUrl = getDiagramImageUrl(jobId, diagram.imagePath);
  const title = diagram.title || diagram.rawCaptionText || `Diagram ${diagram.id}`;

  // Handle download
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${diagram.id}.png`;
    link.click();
  };

  // Handle open in new tab
  const handleOpenNewTab = () => {
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
  };

  // Get quality badge info
  const getQualityInfo = (quality: string) => {
    switch (quality) {
      case 'ok':
        return { color: 'green', label: 'OK', icon: '✓' };
      case 'low_confidence':
        return { color: 'yellow', label: 'Low Confidence', icon: '⚠' };
      case 'handwriting':
        return { color: 'blue', label: 'Handwriting', icon: '✎' };
      default:
        return { color: 'gray', label: quality, icon: '•' };
    }
  };

  const qualityInfo = getQualityInfo(diagram.quality);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal Container */}
      <div
        className="relative w-full h-full max-w-7xl max-h-[95vh] m-4 bg-white dark:bg-gray-900 rounded-lg shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
              {title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Diagram {currentIndex + 1} of {diagrams.length}
              {diagram.page && ` • Page ${diagram.page}`}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleDownload}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
              title="Download image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>

            <button
              onClick={handleOpenNewTab}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
              title="Open in new tab"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>

            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
              title={showMetadata ? 'Hide metadata' : 'Show metadata'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
              title="Close (ESC)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Image Container */}
          <div className="flex-1 flex items-center justify-center p-8 bg-gray-100 dark:bg-gray-950 overflow-auto">
            {!diagram.imagePath || imageError ? (
              <div className="text-center">
                <svg className="w-32 h-32 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">Image not available</p>
              </div>
            ) : (
              <img
                src={imageUrl}
                alt={title}
                className="max-w-full max-h-full object-contain"
                onError={() => setImageError(true)}
              />
            )}
          </div>

          {/* Metadata Panel */}
          {showMetadata && (
            <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Quality Badge */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Quality
                  </label>
                  <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                    qualityInfo.color === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                    qualityInfo.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                    qualityInfo.color === 'blue' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    <span>{qualityInfo.icon}</span>
                    <span>{qualityInfo.label}</span>
                  </div>
                </div>

                {/* Page Number */}
                {diagram.page && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Page
                    </label>
                    <p className="mt-2 text-gray-900 dark:text-gray-100">
                      {diagram.page}
                    </p>
                  </div>
                )}

                {/* Origin */}
                {diagram.origin && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Origin
                    </label>
                    <p className="mt-2 text-gray-900 dark:text-gray-100">
                      {diagram.origin === 'pdf_digital' ? 'PDF (Digital)' : 'Image (Normalized)'}
                    </p>
                  </div>
                )}

                {/* Raw Caption */}
                {diagram.rawCaptionText && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Detected Caption
                    </label>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                      {diagram.rawCaptionText}
                    </p>
                  </div>
                )}

                {/* AI Description */}
                {diagram.description && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      AI-Generated Description
                    </label>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {diagram.description}
                    </p>
                  </div>
                )}

                {/* Source Document */}
                {diagram.sourcePdf && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Source Document
                    </label>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 truncate" title={diagram.sourcePdf}>
                      {diagram.sourcePdf}
                    </p>
                  </div>
                )}

                {/* Diagram ID */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Diagram ID
                  </label>
                  <p className="mt-2 text-xs font-mono text-gray-600 dark:text-gray-400">
                    {diagram.id}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={handlePrevious}
            disabled={isFirst}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            Use arrow keys to navigate
          </div>

          <button
            onClick={handleNext}
            disabled={isLast}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
