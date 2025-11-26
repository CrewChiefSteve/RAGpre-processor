import { NextRequest, NextResponse } from 'next/server';
import { getJobRunner, startJobRunner, stopJobRunner } from '@/lib/jobRunner';

// GET /api/runner - Get runner status
export async function GET(request: NextRequest) {
  try {
    const runner = getJobRunner();
    const currentJobId = runner.getCurrentJobId();

    return NextResponse.json({
      running: currentJobId !== null || true, // simplified check
      currentJobId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get runner status' },
      { status: 500 }
    );
  }
}

// POST /api/runner - Start or stop the runner
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'start') {
      startJobRunner();
      return NextResponse.json({ message: 'Job runner started' });
    } else if (action === 'stop') {
      stopJobRunner();
      return NextResponse.json({ message: 'Job runner stopped' });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "start" or "stop"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to control runner' },
      { status: 500 }
    );
  }
}
