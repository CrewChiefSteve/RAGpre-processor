import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPageDetail } from "@/src/lib/metrics/pageCoverage";
import path from "path";

export const dynamic = "force-dynamic";

interface PageViewerProps {
  params: { id: string; page: string };
}

export default async function PageViewer({ params }: PageViewerProps) {
  const { id, page: pageStr } = params;
  const pageNum = parseInt(pageStr, 10);

  if (isNaN(pageNum) || pageNum < 1) {
    notFound();
  }

  // Fetch rulebook
  const rulebook = await prisma.rulebook.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      pageCount: true,
    },
  });

  if (!rulebook) {
    notFound();
  }

  if (rulebook.pageCount && pageNum > rulebook.pageCount) {
    notFound();
  }

  // Get page details
  const pageDetail = await getPageDetail(prisma, id, pageNum);

  // Construct page image path
  // Based on Phase D rendering: outDir/rulebooks/{rulebookId}/pages/page-{page}.png
  // We'll use the public URL or construct relative path
  const pageImageUrl = `/api/jobs/${rulebook.id}/pages/${pageNum}.png`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/rulebooks/${id}`}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm mb-2 inline-block"
          >
            ← Back to {rulebook.title}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Page {pageNum}
          </h1>
        </div>

        {/* Navigation */}
        <div className="flex gap-2">
          {pageNum > 1 && (
            <Link
              href={`/rulebooks/${id}/pages/${pageNum - 1}`}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              ← Previous
            </Link>
          )}
          {rulebook.pageCount && pageNum < rulebook.pageCount && (
            <Link
              href={`/rulebooks/${id}/pages/${pageNum + 1}`}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Next →
            </Link>
          )}
        </div>
      </div>

      {/* Page Image */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Page Image
        </h2>
        <div className="relative border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          {/* For now, we'll use a placeholder or attempt to load the image */}
          {/* In production, you'd need an API route to serve these images */}
          <div className="bg-gray-100 dark:bg-gray-900 p-4 text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">
              Page image rendering requires additional API setup
            </p>
            <p className="text-xs mt-2">
              Image path would be: out/rulebooks/{id}/pages/page-{pageNum}.png
            </p>
          </div>
        </div>

        {/* Diagram Overlays Info */}
        {pageDetail.diagrams.length > 0 && (
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            <p>{pageDetail.diagrams.length} diagram(s) detected on this page</p>
          </div>
        )}
      </div>

      {/* Rules on this page */}
      {pageDetail.rules.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Rules ({pageDetail.rules.length})
          </h2>
          <div className="space-y-4">
            {pageDetail.rules.map((rule) => (
              <div
                key={rule.id}
                className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm font-semibold">
                    {rule.code}
                  </span>
                  <div className="flex-1">
                    {rule.title && (
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {rule.title}
                      </h3>
                    )}
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {rule.text.length > 300
                        ? rule.text.substring(0, 300) + "..."
                        : rule.text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagrams on this page */}
      {pageDetail.diagrams.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Diagrams ({pageDetail.diagrams.length})
          </h2>
          <div className="space-y-4">
            {pageDetail.diagrams.map((diagram) => (
              <div
                key={diagram.id}
                className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
              >
                {diagram.caption && (
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {diagram.caption}
                  </h3>
                )}
                {diagram.explanation && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    {diagram.explanation}
                  </p>
                )}
                {diagram.refersToRuleCode && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Refers to rule: {diagram.refersToRuleCode}
                  </p>
                )}
                {diagram.publicUrl && (
                  <a
                    href={diagram.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View image →
                  </a>
                )}
                {diagram.boundingBox && (
                  <details className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <summary className="cursor-pointer">
                      Bounding box data
                    </summary>
                    <pre className="mt-1 bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                      {diagram.boundingBox}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tables on this page */}
      {pageDetail.tables.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Tables ({pageDetail.tables.length})
          </h2>
          <div className="space-y-4">
            {pageDetail.tables.map((table) => (
              <div
                key={table.id}
                className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-x-auto"
              >
                {table.markdown ? (
                  <div className="prose dark:prose-invert max-w-none text-sm">
                    <pre className="whitespace-pre-wrap bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                      {table.markdown}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Table data available in JSON format
                  </p>
                )}
                {table.jsonData && (
                  <details className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <summary className="cursor-pointer">View JSON data</summary>
                    <pre className="mt-1 bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                      {JSON.stringify(JSON.parse(table.jsonData), null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chunks on this page */}
      {pageDetail.chunks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Chunks ({pageDetail.chunks.length})
          </h2>
          <div className="space-y-2">
            {pageDetail.chunks.map((chunk) => (
              <div
                key={chunk.id}
                className="p-3 bg-gray-50 dark:bg-gray-900 rounded text-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-xs font-semibold">
                    {chunk.type}
                  </span>
                  {chunk.tokenCount && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {chunk.tokenCount} tokens
                    </span>
                  )}
                </div>
                <p className="text-gray-700 dark:text-gray-300">
                  {chunk.text.length > 200
                    ? chunk.text.substring(0, 200) + "..."
                    : chunk.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No content message */}
      {pageDetail.rules.length === 0 &&
        pageDetail.diagrams.length === 0 &&
        pageDetail.tables.length === 0 &&
        pageDetail.chunks.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No content extracted from this page
            </p>
          </div>
        )}
    </div>
  );
}
