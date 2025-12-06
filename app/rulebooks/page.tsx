import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RulebooksPage() {
  // Fetch all rulebooks with basic info
  const rulebooks = await prisma.rulebook.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      series: true,
      year: true,
      version: true,
      pageCount: true,
      createdAt: true,
      _count: {
        select: {
          sections: true,
          rules: true,
          diagrams: true,
          tables: true,
          chunks: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Rulebooks
        </h1>
        <Link
          href="/upload"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Upload New
        </Link>
      </div>

      {rulebooks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No rulebooks found
          </p>
          <Link
            href="/upload"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Upload Your First Rulebook
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {rulebooks.map((rb) => (
            <Link
              key={rb.id}
              href={`/rulebooks/${rb.id}`}
              className="block bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {rb.title}
                  </h2>
                  <div className="flex gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {rb.series && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                        {rb.series}
                      </span>
                    )}
                    {rb.year && (
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded">
                        {rb.year}
                      </span>
                    )}
                    {rb.version && (
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded">
                        v{rb.version}
                      </span>
                    )}
                    {rb.pageCount && (
                      <span className="text-gray-500 dark:text-gray-400">
                        {rb.pageCount} pages
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Created {new Date(rb.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-blue-600 dark:text-blue-400 hover:underline ml-4">
                  View →
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3 mt-4 text-center text-sm">
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                  <div className="font-bold text-xl text-gray-900 dark:text-gray-100">
                    {rb._count.sections}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                    Sections
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                  <div className="font-bold text-xl text-gray-900 dark:text-gray-100">
                    {rb._count.rules}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                    Rules
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                  <div className="font-bold text-xl text-gray-900 dark:text-gray-100">
                    {rb._count.tables}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                    Tables
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                  <div className="font-bold text-xl text-gray-900 dark:text-gray-100">
                    {rb._count.diagrams}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                    Diagrams
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                  <div className="font-bold text-xl text-gray-900 dark:text-gray-100">
                    {rb._count.chunks}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                    Chunks
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
