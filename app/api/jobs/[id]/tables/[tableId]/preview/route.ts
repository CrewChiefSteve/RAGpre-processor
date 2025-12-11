import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

/**
 * GET /api/jobs/[id]/tables/[tableId]/preview
 *
 * Serves table markdown preview files from job output directory
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; tableId: string } }
) {
  try {
    const { id, tableId } = params;

    // Validate job ID
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // Try both auto_ok and needs_review directories
    const jobDir = path.join(process.cwd(), 'out', 'jobs', id);
    const possiblePaths = [
      path.join(jobDir, 'auto_ok', 'tables_previews', `${tableId}_preview.md`),
      path.join(jobDir, 'needs_review', 'tables_previews', `${tableId}_preview.md`),
    ];

    let previewPath: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        previewPath = p;
        break;
      }
    }

    if (!previewPath) {
      return NextResponse.json(
        { error: 'Preview file not found' },
        { status: 404 }
      );
    }

    // Read file
    const content = fs.readFileSync(previewPath, 'utf-8');

    // Return as plain text
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('[API /api/jobs/[id]/tables/[tableId]/preview] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
