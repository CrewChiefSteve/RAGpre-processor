import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

/**
 * GET /api/jobs/[id]/manifest
 *
 * Returns the manifest.json file for a specific job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Validate job ID format (basic CUID validation)
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // Build path to manifest.json
    const manifestPath = path.join(
      process.cwd(),
      'out',
      'jobs',
      id,
      'manifest.json'
    );

    // Check if manifest exists
    try {
      await fs.access(manifestPath);
    } catch (error) {
      return NextResponse.json(
        { error: 'Manifest not found' },
        { status: 404 }
      );
    }

    // Read and parse manifest
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    return NextResponse.json(manifest);
  } catch (error: any) {
    console.error('[API /api/jobs/[id]/manifest] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch manifest' },
      { status: 500 }
    );
  }
}
