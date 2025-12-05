'use client';

import { useState } from 'react';
import VisionDebugCard from './VisionDebugCard';

interface VisionDebugGalleryProps {
  jobId: string;
}

const MAX_DEBUG_PAGES = 10; // v1 static range

export default function VisionDebugGallery({ jobId }: VisionDebugGalleryProps) {
  const [visiblePages] = useState<number[]>(() =>
    Array.from({ length: MAX_DEBUG_PAGES }, (_, i) => i + 1)
  );

  // We let each card decide if it should render based on image load.
  // Cards will self-hide if their overlay image returns 404.

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Vision Debug Artifacts
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Visual inspection of vision-based diagram detection showing rendered pages,
          bounding box overlays, and complete segmentation data.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          <strong>Note:</strong> Debug artifacts are only created for pages processed by
          vision segmentation (pages without Azure-detected diagrams). Some jobs may show
          no artifacts if all diagrams were detected by Azure or if vision segmentation
          was disabled.
        </p>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
          <p className="font-medium mb-1">To enable Vision Debug Mode:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>
              <strong>CLI:</strong>{' '}
              <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                --visionSegmentation --debugVision
              </code>
            </li>
            <li>
              <strong>Web:</strong>{' '}
              <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                ENABLE_VISION_DEBUG=true
              </code>{' '}
              in <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">.env</code>
            </li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visiblePages.map((page) => (
          <VisionDebugCard key={page} jobId={jobId} pageNumber={page} />
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>If no pages appear above:</strong>
        </p>
        <ul className="mt-2 text-xs text-gray-500 dark:text-gray-500 space-y-1 ml-4 list-disc">
          <li>Vision debug mode may not be enabled for this job</li>
          <li>All diagrams may have been detected by Azure (no vision segmentation needed)</li>
          <li>
            Vision segmentation may be disabled (check{' '}
            <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
              ENABLE_VISION_DIAGRAM_SEGMENTATION
            </code>
            )
          </li>
        </ul>
      </div>
    </div>
  );
}
