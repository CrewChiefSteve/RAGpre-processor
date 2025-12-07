import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

/**
 * GET /api/jobs/[id]/tables/[tableId]/csv
 *
 * Serves table CSV files from job output directory
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

    // Build file path
    const jobDir = path.join(process.cwd(), 'out', 'jobs', id);
    const tablesDir = path.join(jobDir, 'tables');
    const csvPath = path.join(tablesDir, `${tableId}.csv`);

    // Security: Ensure the resolved path is within the tables directory
    const normalizedPath = path.normalize(csvPath);
    const normalizedTablesDir = path.normalize(tablesDir);

    if (!normalizedPath.startsWith(normalizedTablesDir)) {
      return NextResponse.json(
        { error: 'Invalid file path - path traversal not allowed' },
        { status: 403 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(normalizedPath)) {
      return NextResponse.json(
        { error: 'CSV file not found' },
        { status: 404 }
      );
    }

    // Read file
    const content = fs.readFileSync(normalizedPath, 'utf-8');

    // Return CSV with appropriate headers
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${tableId}.csv"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('[API /api/jobs/[id]/tables/[tableId]/csv] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
