import React from 'react';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number; // For multiple skeleton lines
}

export default function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
  count = 1,
}: SkeletonProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded';
      case 'text':
      default:
        return 'rounded';
    }
  };

  const getDefaultSize = () => {
    switch (variant) {
      case 'circular':
        return { width: '40px', height: '40px' };
      case 'text':
        return { width: '100%', height: '1em' };
      case 'rectangular':
        return { width: '100%', height: '200px' };
    }
  };

  const defaultSize = getDefaultSize();
  const style = {
    width: width ?? defaultSize.width,
    height: height ?? defaultSize.height,
  };

  const skeletonElement = (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${getVariantClasses()} ${className}`}
      style={style}
    />
  );

  if (count > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index}>{skeletonElement}</div>
        ))}
      </div>
    );
  }

  return skeletonElement;
}

// Convenience components for common patterns
export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
      <Skeleton variant="rectangular" height="120px" />
      <Skeleton width="60%" />
      <Skeleton width="80%" />
      <Skeleton width="40%" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton height="40px" /> {/* Header */}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height="32px" />
      ))}
    </div>
  );
}
