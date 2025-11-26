import Link from 'next/link';
import JobsList from '@/components/JobsList';
import { prisma } from '@/lib/db';
import { dbJobToPreprocessJob, PreprocessJob } from '@/lib/types/job';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  // Fetch initial jobs from database
  let initialJobs: PreprocessJob[] = [];
  try {
    const jobs = await prisma.job.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    initialJobs = jobs.map(dbJobToPreprocessJob);
  } catch (error) {
    console.error('Error fetching initial jobs:', error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Jobs Dashboard
        </h1>
        <Link
          href="/upload"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          New Upload
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <JobsList initialJobs={initialJobs} />
      </div>
    </div>
  );
}
