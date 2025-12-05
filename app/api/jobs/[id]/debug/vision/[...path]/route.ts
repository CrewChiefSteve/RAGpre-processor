import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

/**
 * GET /api/jobs/[id]/debug/vision/[...path]
 *
 * Serves vision debug artifacts from job output directory
 * Examples:
 * - /api/jobs/abc123/debug/vision/pages/page-001.png
 * - /api/jobs/abc123/debug/vision/pages/page-001_overlay.png
 * - /api/jobs/abc123/debug/vision/segments/page-001_segments.json
 *
 * Maps to: out/jobs/abc123/debug/vision/...
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; path: string[] } }
) {
  try {
    const { id, path: filePath } = params;

    // Validate job ID format (basic CUID validation)
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // Validate path
    if (!filePath || !Array.isArray(filePath) || filePath.length === 0) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }

    // Build safe file path
    const jobDir = path.join(process.cwd(), 'out', 'jobs', id);
    const debugDir = path.join(jobDir, 'debug', 'vision');
    const requestedPath = path.join(debugDir, ...filePath);

    // Security: Ensure the resolved path is within the debug directory
    const normalizedPath = path.normalize(requestedPath);
    const normalizedDebugDir = path.normalize(debugDir);

    if (!normalizedPath.startsWith(normalizedDebugDir)) {
      return NextResponse.json(
        { error: 'Invalid file path - path traversal not allowed' },
        { status: 403 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(normalizedPath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Check if it's a file (not directory)
    const stats = fs.statSync(normalizedPath);
    if (!stats.isFile()) {
      return NextResponse.json(
        { error: 'Not a file' },
        { status: 400 }
      );
    }

    // Read file
    const fileBuffer = fs.readFileSync(normalizedPath);

    // Determine content type based on extension
    const ext = path.extname(normalizedPath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.png': 'image/png',
      '.json': 'application/json',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Set cache headers based on content type
    let cacheControl = 'public, max-age=3600'; // 1 hour default
    if (contentType === 'image/png') {
      cacheControl = 'public, max-age=31536000, immutable';
    } else if (contentType === 'application/json') {
      cacheControl = 'public, max-age=3600';
    }

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
      },
    });
  } catch (error: any) {
    console.error('[API /api/jobs/[id]/debug/vision] Error serving file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
