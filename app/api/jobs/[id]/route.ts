import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { dbJobToPreprocessJob } from '@/lib/types/job';
import { rm } from 'fs/promises';
import { existsSync } from 'fs';

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

// DELETE /api/jobs/[id] - Delete a single job by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get the job to retrieve file paths
    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Delete job files from disk
    if (job.outputDir && existsSync(job.outputDir)) {
      await rm(job.outputDir, { recursive: true, force: true });
    }

    if (job.uploadedFilePath && existsSync(job.uploadedFilePath)) {
      await rm(job.uploadedFilePath, { force: true });
    }

    // Delete logs associated with the job
    await prisma.log.deleteMany({
      where: { jobId: id },
    });

    // Delete the job from database
    await prisma.job.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Job deleted successfully',
      deletedJob: dbJobToPreprocessJob(job),
    });
  } catch (error: any) {
    console.error('Error deleting job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete job' },
      { status: 500 }
    );
  }
}
