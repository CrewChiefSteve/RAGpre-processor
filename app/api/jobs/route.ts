import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { dbJobToPreprocessJob } from '@/lib/types/job';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// POST /api/jobs - Create a new job
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const configStr = formData.get('config') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Parse config or use defaults
    const config = configStr ? JSON.parse(configStr) : {};
    const {
      chunkSize = 800,
      chunkOverlap = 150,
      maxPages = null,
      enableTables = true,
      handwritingVision = false,
      captionDiagrams = false,
      debug = false,
    } = config;

    // Save the uploaded file to temp directory
    const uploadDir = join(process.cwd(), 'temp', 'uploads');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const timestamp = Date.now();
    const filename = file.name;
    const safeName = `${timestamp}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const uploadPath = join(uploadDir, safeName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(uploadPath, buffer);

    // Create output directory for this job
    const outputDir = join(process.cwd(), 'out', `job-${timestamp}`);

    // Create the job in the database
    const job = await prisma.job.create({
      data: {
        filename,
        status: 'pending',
        chunkSize,
        chunkOverlap,
        maxPages,
        enableTables,
        handwritingVision,
        captionDiagrams,
        debug,
        uploadedFilePath: uploadPath,
        outputDir,
        phasesJson: JSON.stringify({
          A: { status: 'not_started' },
          B: { status: 'not_started' },
          C: { status: 'not_started' },
          D: { status: 'not_started' },
        }),
      },
    });

    // Create initial log
    await prisma.log.create({
      data: {
        jobId: job.id,
        phase: 'system',
        level: 'info',
        message: `Job created for file: ${filename}`,
      },
    });

    return NextResponse.json({
      job: dbJobToPreprocessJob(job),
      message: 'Job created successfully',
    });
  } catch (error: any) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create job' },
      { status: 500 }
    );
  }
}

// GET /api/jobs - List all jobs with optional filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Build where clause
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.filename = {
        contains: search,
      };
    }

    const jobs = await prisma.job.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      jobs: jobs.map(dbJobToPreprocessJob),
    });
  } catch (error: any) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

// DELETE /api/jobs - Delete all jobs
export async function DELETE(request: NextRequest) {
  try {
    // Get all jobs to retrieve file paths
    const jobs = await prisma.job.findMany();

    // Delete all job files from disk
    for (const job of jobs) {
      if (job.outputDir && existsSync(job.outputDir)) {
        await rm(job.outputDir, { recursive: true, force: true });
      }

      if (job.uploadedFilePath && existsSync(job.uploadedFilePath)) {
        await rm(job.uploadedFilePath, { force: true });
      }
    }

    // Delete all logs
    await prisma.log.deleteMany();

    // Delete all jobs
    const result = await prisma.job.deleteMany();

    return NextResponse.json({
      message: 'All jobs deleted successfully',
      deletedCount: result.count,
    });
  } catch (error: any) {
    console.error('Error deleting all jobs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete all jobs' },
      { status: 500 }
    );
  }
}
