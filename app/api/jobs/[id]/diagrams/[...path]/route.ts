import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

/**
 * GET /api/jobs/[id]/diagrams/[...path]
 *
 * Serves diagram images from job output directory
 * Example: /api/jobs/abc123/diagrams/images/diagram_1.png
 * Maps to: out/jobs/abc123/diagrams/images/diagram_1.png
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
    const diagramsDir = path.join(jobDir, 'diagrams');
    const requestedPath = path.join(diagramsDir, ...filePath);

    // Security: Ensure the resolved path is within the diagrams directory
    const normalizedPath = path.normalize(requestedPath);
    const normalizedDiagramsDir = path.normalize(diagramsDir);

    if (!normalizedPath.startsWith(normalizedDiagramsDir)) {
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
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('[API /api/jobs/[id]/diagrams] Error serving file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
