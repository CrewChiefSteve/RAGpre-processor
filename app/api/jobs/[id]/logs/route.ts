import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/jobs/[id]/logs - Get logs for a specific job
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const phase = searchParams.get('phase');

    // Build where clause
    const where: any = { jobId: id };
    if (phase) {
      where.phase = phase;
    }

    const logs = await prisma.log.findMany({
      where,
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        jobId: log.jobId,
        phase: log.phase,
        level: log.level,
        message: log.message,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
