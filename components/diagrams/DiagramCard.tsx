'use client';

import { useState } from 'react';
import { getDiagramImageUrl } from '@/lib/client/jobs';

/**
 * DiagramCard - Individual diagram card in grid view
 *
 * Displays a thumbnail image with metadata including title, page number, and quality badge.
 * Clicking the card opens the full-size image in a new browser tab.
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
}

interface DiagramCardProps {
  diagram: DiagramAsset;
  jobId: string;
  onClick?: () => void;
}

export default function DiagramCard({ diagram, jobId, onClick }: DiagramCardProps) {
  const [imageError, setImageError] = useState(false);

  // Build thumbnail URL
  const thumbnailUrl = diagram.imagePath
    ? getDiagramImageUrl(jobId, diagram.imagePath)
    : '';

  // Determine title
  const title =
    diagram.title ||
    diagram.rawCaptionText ||
    `Diagram ${diagram.id}`;

  // Get quality badge styling and dot color
  const getQualityBadge = (quality: string) => {
    switch (quality) {
      case 'ok':
        return {
          className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
          label: 'OK',
          dotColor: 'bg-green-500',
        };
      case 'low_confidence':
        return {
          className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
          label: 'Low Confidence',
          dotColor: 'bg-yellow-500',
        };
      case 'handwriting':
        return {
          className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
          label: 'Handwriting',
          dotColor: 'bg-blue-500',
        };
      default:
        return {
          className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
          label: quality,
          dotColor: 'bg-gray-500',
        };
    }
  };

  const qualityBadge = getQualityBadge(diagram.quality);

  // Truncate description if present
  const truncateText = (text: string | undefined, maxLength: number) => {
    if (!text) return null;
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div
      onClick={onClick}
      className="border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden bg-white dark:bg-gray-800 cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Thumbnail Image Area */}
      <div className="w-full h-48 bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
        {!diagram.imagePath || imageError ? (
          <div className="text-center p-4">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-2"
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
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Image not available
            </p>
          </div>
        ) : (
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        )}
      </div>

      {/* Metadata Section */}
      <div className="p-3 space-y-2">
        {/* Title with Quality Dot */}
        <div className="flex items-start gap-2">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${qualityBadge.dotColor}`} />
          <h3
            className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-2 flex-1"
            title={title}
          >
            {title}
          </h3>
        </div>

        {/* Page & Quality Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Page Number - Pill Style */}
          {diagram.page && (
            <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-full">
              Page {diagram.page}
            </span>
          )}

          {/* Quality Badge */}
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${qualityBadge.className}`}
          >
            {qualityBadge.label}
          </span>
        </div>

        {/* Description Preview (if available) */}
        {diagram.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
            {truncateText(diagram.description, 100)}
          </p>
        )}
      </div>
    </div>
  );
}
