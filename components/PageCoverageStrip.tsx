"use client";

/**
 * Phase F: Page Coverage Visualization
 * Shows a horizontal strip of page coverage indicators
 */

import React from "react";
import type { PageCoverage } from "@/src/lib/metrics/pageCoverage";
import Link from "next/link";

interface PageCoverageStripProps {
  pages: PageCoverage[];
  rulebookId: string;
  className?: string;
}

export function PageCoverageStrip({
  pages,
  rulebookId,
  className = "",
}: PageCoverageStripProps) {
  if (pages.length === 0) {
    return <div className="text-sm text-gray-500">No pages available</div>;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-1 flex-wrap">
        {pages.map((page) => {
          const intensity = Math.min(
            100,
            Math.max(10, (page.chunksCount || 1) * 10)
          );
          const hasContent = page.chunksCount > 0 || page.rulesCount > 0;

          let bgColor = "bg-gray-200";
          if (hasContent) {
            if (intensity >= 50) {
              bgColor = "bg-blue-600";
            } else if (intensity >= 30) {
              bgColor = "bg-blue-400";
            } else {
              bgColor = "bg-blue-300";
            }
          }

          const hasDiagrams = page.diagramsCount > 0;
          const hasTables = page.tablesCount > 0;

          return (
            <Link
              key={page.page}
              href={`/rulebooks/${rulebookId}/pages/${page.page}`}
              className="group relative"
            >
              <div
                className={`w-8 h-16 ${bgColor} border border-gray-300 rounded cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all relative overflow-hidden`}
              >
                {/* Diagram indicator */}
                {hasDiagrams && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-bl"></div>
                )}
                {/* Table indicator */}
                {hasTables && (
                  <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-tl"></div>
                )}
                {/* Page number */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-white drop-shadow">
                    {page.page}
                  </span>
                </div>
              </div>

              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                <div className="font-semibold">Page {page.page}</div>
                <div>Rules: {page.rulesCount}</div>
                <div>Diagrams: {page.diagramsCount}</div>
                <div>Tables: {page.tablesCount}</div>
                <div>Chunks: {page.chunksCount}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-blue-600 border border-gray-300 rounded"></div>
          <span>High content</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-blue-300 border border-gray-300 rounded"></div>
          <span>Low content</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-200 border border-gray-300 rounded"></div>
          <span>No content</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-orange-500 rounded"></div>
          <span>Diagrams</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>Tables</span>
        </div>
      </div>
    </div>
  );
}
