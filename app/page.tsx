import Link from 'next/link';
import { prisma } from '@/lib/db';
import { dbJobToPreprocessJob } from '@/lib/types/job';
import DashboardStats from '@/components/dashboard/DashboardStats';
import RecentJobCard from '@/components/dashboard/RecentJobCard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Fetch stats and recent jobs
  let stats = {
    totalJobs: 0,
    completedJobs: 0,
    runningJobs: 0,
    failedJobs: 0,
  };
  let recentJobs: any[] = [];

  try {
    // Get stats
    const [total, completed, running, failed] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { status: 'completed' } }),
      prisma.job.count({ where: { status: 'running' } }),
      prisma.job.count({ where: { status: 'failed' } }),
    ]);

    stats = {
      totalJobs: total,
      completedJobs: completed,
      runningJobs: running,
      failedJobs: failed,
    };

    // Get recent jobs (last 6)
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    recentJobs = jobs.map(dbJobToPreprocessJob);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-8 text-white">
        <h1 className="text-4xl font-bold mb-2">RAG Preprocessor Dashboard</h1>
        <p className="text-blue-100 mb-6">
          Transform documents into RAG-ready content with AI-powered preprocessing
        </p>
        <div className="flex gap-4">
          <Link
            href="/upload"
            className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition font-semibold"
          >
            📤 Upload Document
          </Link>
          <Link
            href="/jobs"
            className="px-6 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-600 transition font-semibold"
          >
            📊 View All Jobs
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Overview
        </h2>
        <DashboardStats {...stats} />
      </div>

      {/* Recent Jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Recent Jobs
          </h2>
          {recentJobs.length > 0 && (
            <Link
              href="/jobs"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              View all →
            </Link>
          )}
        </div>

        {recentJobs.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📄</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No jobs yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Upload your first document to get started with preprocessing
            </p>
            <Link
              href="/upload"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Upload Document
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentJobs.map((job) => (
              <RecentJobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>

      {/* Pipeline Info */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Processing Pipeline
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl mb-3">📥</div>
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">
              Phase A: Input
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Normalize PDFs and images for consistent processing
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">
              Phase B: Analysis
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Quality assessment and intelligent content routing
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">
              Phase C: Export
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Extract narratives, tables, and diagrams
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl mb-3">✨</div>
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">
              Phase D: Vision
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              AI-powered enhancements and captioning
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
