'use client';

import { useState } from 'react';
import {
  getVisionDebugOverlayUrl,
  getVisionDebugSegmentsUrl,
} from '@/lib/client/jobs';

interface VisionDebugCardProps {
  jobId: string;
  pageNumber: number;
}

export default function VisionDebugCard({ jobId, pageNumber }: VisionDebugCardProps) {
  const [hasImage, setHasImage] = useState(true);
  const overlayUrl = getVisionDebugOverlayUrl(jobId, pageNumber);
  const segmentsUrl = getVisionDebugSegmentsUrl(jobId, pageNumber);

  if (!hasImage) {
    // If overlay PNG doesn't exist (404), hide this card
    return null;
  }

  const handleImageError = () => {
    setHasImage(false);
  };

  const handleViewFull = () => {
    window.open(overlayUrl, '_blank', 'noopener,noreferrer');
  };

  const handleViewJson = () => {
    window.open(segmentsUrl, '_blank', 'noopener,noreferrer');
  };

  const paddedPage = String(pageNumber).padStart(3, '0');

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm bg-white dark:bg-gray-900 flex flex-col">
      <div className="bg-gray-50 dark:bg-gray-800 aspect-[3/4] overflow-hidden flex items-center justify-center">
        <img
          src={overlayUrl}
          alt={`Vision debug overlay for page ${pageNumber}`}
          className="w-full h-full object-contain"
          onError={handleImageError}
        />
      </div>

      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Page {pageNumber}{' '}
            <span className="text-xs text-gray-400 dark:text-gray-500">({paddedPage})</span>
          </span>
        </div>

        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={handleViewFull}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            View Full
          </button>
          <button
            type="button"
            onClick={handleViewJson}
            className="inline-flex items-center justify-center rounded-md border border-blue-500 dark:border-blue-400 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            JSON
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Overlay and segmentation data for vision-detected diagram regions on this page
          (if available).
        </p>
      </div>
    </div>
  );
}
