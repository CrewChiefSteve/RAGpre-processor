import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { dbJobToPreprocessJob } from '@/lib/types/job';

// GET /api/jobs/[id] - Get a single job by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      job: dbJobToPreprocessJob(job),
    });
  } catch (error: any) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job' },
      { status: 500 }
    );
  }
}
