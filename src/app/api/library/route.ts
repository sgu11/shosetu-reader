import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getLibrary } from "@/modules/library/application/get-library";

export async function GET() {
  try {
    const library = await getLibrary();
    return NextResponse.json(library);
  } catch (err) {
    logger.error("Failed to fetch library", {
      err: err instanceof Error ? err.message : String(err),
      route: "GET /api/library",
    });
    return NextResponse.json({ error: "Failed to fetch library" }, { status: 500 });
  }
}
