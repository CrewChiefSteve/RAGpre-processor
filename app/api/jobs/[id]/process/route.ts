import { NextRequest, NextResponse } from 'next/server';
import { getJobRunner } from '@/lib/jobRunner';

// POST /api/jobs/[id]/process - Manually trigger job processing
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const runner = getJobRunner();

    // Process the job immediately (bypassing the queue)
    // This runs in the background
    runner.processJob(id).catch((error) => {
      console.error(`Failed to process job ${id}:`, error);
    });

    return NextResponse.json({
      message: 'Job processing started',
      jobId: id,
    });
  } catch (error: any) {
    console.error('Error triggering job processing:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to trigger job processing' },
      { status: 500 }
    );
  }
}
