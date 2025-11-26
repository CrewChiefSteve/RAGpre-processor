import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type SettingsPayload = {
  chunkSize: number;
  chunkOverlap: number;
  maxPages: number | null;
  enableTables: boolean;
  handwritingVision: boolean;
  captionDiagrams: boolean;
  debug: boolean;
};

/**
 * GET /api/settings
 * Returns the current global settings, creating defaults if needed.
 */
export async function GET() {
  try {
    // Upsert ensures we always have a settings row with id=1
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {},
      create: {}, // uses Prisma defaults from schema
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings
 * Partial update: only provided fields are updated.
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Build the update data object with only provided fields
    const updateData: Partial<SettingsPayload> = {};

    // Validate and process numeric fields
    if ("chunkSize" in body) {
      const val = Number(body.chunkSize);
      if (isNaN(val)) {
        return NextResponse.json(
          { error: "chunkSize must be a valid number" },
          { status: 400 }
        );
      }
      updateData.chunkSize = val;
    }

    if ("chunkOverlap" in body) {
      const val = Number(body.chunkOverlap);
      if (isNaN(val)) {
        return NextResponse.json(
          { error: "chunkOverlap must be a valid number" },
          { status: 400 }
        );
      }
      updateData.chunkOverlap = val;
    }

    if ("maxPages" in body) {
      // Handle maxPages: null, empty string, or number
      if (body.maxPages === null || body.maxPages === "") {
        updateData.maxPages = null;
      } else {
        const val = Number(body.maxPages);
        if (isNaN(val)) {
          return NextResponse.json(
            { error: "maxPages must be a valid number or null" },
            { status: 400 }
          );
        }
        // If <= 0, normalize to null (no limit)
        updateData.maxPages = val > 0 ? val : null;
      }
    }

    // Validate and process boolean fields
    const boolFields: Array<keyof Pick<SettingsPayload, "enableTables" | "handwritingVision" | "captionDiagrams" | "debug">> = [
      "enableTables",
      "handwritingVision",
      "captionDiagrams",
      "debug",
    ];

    for (const field of boolFields) {
      if (field in body) {
        if (typeof body[field] !== "boolean") {
          return NextResponse.json(
            { error: `${field} must be a boolean` },
            { status: 400 }
          );
        }
        updateData[field] = body[field];
      }
    }

    // Perform the upsert with partial data
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: updateData,
      create: {}, // use defaults if row doesn't exist
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("PUT /api/settings error:", error);

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
