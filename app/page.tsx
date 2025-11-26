import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Welcome to RAG Preprocessor Console
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          This dashboard allows you to upload and preprocess documents for RAG applications.
          The pipeline includes normalization, quality assessment, content extraction, and optional vision enhancement.
        </p>
        <div className="flex gap-4">
          <Link
            href="/jobs"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            View Jobs
          </Link>
          <Link
            href="/upload"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            New Job
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Phase A</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Input normalization for PDFs and images</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Phase B</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Quality assessment and content routing</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Phase C</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Export to narrative, tables, and diagrams</p>
        </div>
      </div>
    </div>
  );
}
