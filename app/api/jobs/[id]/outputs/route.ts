import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { dbJobToOutputs } from '@/lib/types/job';
import fs from 'fs';
import path from 'path';

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

    let outputs = dbJobToOutputs(job);

    // Filesystem fallback: if database has no outputs but job has outputDir,
    // try reading from manifest.json
    if ((!outputs || !outputs.manifest) && job.outputDir) {
      try {
        const manifestPath = path.join(job.outputDir, 'manifest.json');

        if (fs.existsSync(manifestPath)) {
          const manifestContent = fs.readFileSync(manifestPath, 'utf8');
          const manifest = JSON.parse(manifestContent);

          outputs = {
            ...outputs,
            manifest,
          };
        }
      } catch (fsError: any) {
        console.error('Error reading manifest from filesystem:', fsError);
        // Continue with database outputs (which may be empty)
      }
    }

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
