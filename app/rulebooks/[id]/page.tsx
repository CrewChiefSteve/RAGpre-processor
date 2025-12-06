import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPageCoverage } from "@/src/lib/metrics/pageCoverage";
import { PageCoverageStrip } from "@/components/PageCoverageStrip";

export const dynamic = "force-dynamic";

interface RulebookDetailPageProps {
  params: { id: string };
}

export default async function RulebookDetailPage({
  params,
}: RulebookDetailPageProps) {
  const { id } = params;

  // Fetch rulebook with sections and counts
  const rulebook = await prisma.rulebook.findUnique({
    where: { id },
    include: {
      sections: {
        where: { level: 1 },
        orderBy: { label: "asc" },
        include: {
          children: {
            orderBy: { label: "asc" },
            include: {
              children: {
                orderBy: { label: "asc" },
              },
            },
          },
        },
      },
      _count: {
        select: {
          sections: true,
          rules: true,
          tables: true,
          diagrams: true,
          chunks: true,
        },
      },
    },
  });

  if (!rulebook) {
    notFound();
  }

  // Get page coverage for heatmap
  const pageCoverage = await getPageCoverage(prisma, id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/rulebooks"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm mb-2 inline-block"
          >
            ← Back to Rulebooks
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {rulebook.title}
          </h1>
          <div className="flex gap-3 mt-2 text-sm">
            {rulebook.series && (
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                {rulebook.series}
              </span>
            )}
            {rulebook.year && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded">
                {rulebook.year}
              </span>
            )}
            {rulebook.version && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded">
                v{rulebook.version}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {rulebook.pageCount || 0}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Pages
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {rulebook._count.sections}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sections
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {rulebook._count.rules}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Rules
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {rulebook._count.diagrams}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Diagrams
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {rulebook._count.chunks}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Chunks
          </div>
        </div>
      </div>

      {/* Page Coverage */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Page Coverage
        </h2>
        <PageCoverageStrip pages={pageCoverage} rulebookId={id} />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          Click on a page to view its details
        </p>
      </div>

      {/* Section Tree */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Section Structure
        </h2>
        {rulebook.sections.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No sections detected in this rulebook
          </p>
        ) : (
          <div className="space-y-2">
            {rulebook.sections.map((section) => (
              <div key={section.id} className="space-y-1">
                {/* Level 1 Section */}
                <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <span className="font-semibold">{section.label}</span>
                  <span>{section.title}</span>
                  {section.pageStart && (
                    <Link
                      href={`/rulebooks/${id}/pages/${section.pageStart}`}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-auto"
                    >
                      Page {section.pageStart}
                    </Link>
                  )}
                </div>

                {/* Level 2 Sections */}
                {section.children.map((child) => (
                  <div key={child.id} className="ml-6 space-y-1">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm">
                      <span className="font-medium">{child.label}</span>
                      <span>{child.title}</span>
                      {child.pageStart && (
                        <Link
                          href={`/rulebooks/${id}/pages/${child.pageStart}`}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-auto"
                        >
                          Page {child.pageStart}
                        </Link>
                      )}
                    </div>

                    {/* Level 3 Sections */}
                    {child.children.map((grandchild) => (
                      <div
                        key={grandchild.id}
                        className="ml-6 flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm"
                      >
                        <span className="font-medium">{grandchild.label}</span>
                        <span>{grandchild.title}</span>
                        {grandchild.pageStart && (
                          <Link
                            href={`/rulebooks/${id}/pages/${grandchild.pageStart}`}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-auto"
                          >
                            Page {grandchild.pageStart}
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Quick Actions
        </h2>
        <div className="flex gap-3">
          {rulebook.pageCount && rulebook.pageCount > 0 && (
            <Link
              href={`/rulebooks/${id}/pages/1`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Browse Pages
            </Link>
          )}
          {rulebook.ingestionJobId && (
            <Link
              href={`/jobs/${rulebook.ingestionJobId}`}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              View Ingestion Job
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
