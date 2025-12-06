import Link from 'next/link';
import { notFound } from 'next/navigation';
import JobDetail from '@/components/JobDetail';
import { prisma } from '@/lib/db';
import { dbJobToPreprocessJob, dbJobToOutputs } from '@/lib/types/job';
import { getRulebookMetricsForJob } from '@/src/lib/metrics/rulebookMetrics';

export const dynamic = 'force-dynamic';

interface JobDetailPageProps {
  params: { id: string };
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = params;

  // Fetch job from database
  const dbJob = await prisma.job.findUnique({
    where: { id },
  });

  if (!dbJob) {
    notFound();
  }

  const job = dbJobToPreprocessJob(dbJob);

  // Fetch initial outputs if job is completed
  let initialOutputs = null;
  if (job.status === 'completed') {
    initialOutputs = dbJobToOutputs(dbJob);
  }

  // Fetch rulebook metrics for this job
  const rulebookMetrics = await getRulebookMetricsForJob(prisma, id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/jobs"
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          ← Back to Jobs
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Job Detail
        </h1>
      </div>

      <JobDetail
        jobId={id}
        initialJob={job}
        initialOutputs={initialOutputs}
        rulebookMetrics={rulebookMetrics}
      />
    </div>
  );
}
