import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { dbJobToOutputs } from '@/lib/types/job';

// GET /api/jobs/[id]/outputs - Get outputs for a specific job
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

    const outputs = dbJobToOutputs(job);

    return NextResponse.json({
      outputs,
    });
  } catch (error: any) {
    console.error('Error fetching outputs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch outputs' },
      { status: 500 }
    );
  }
}
