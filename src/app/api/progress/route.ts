import { NextResponse } from "next/server";
import { updateProgressInputSchema } from "@/modules/library/api/schemas";
import { logger } from "@/lib/logger";
import { updateReadingProgress } from "@/modules/library/application/update-progress";

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const parsed = updateProgressInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 },
      );
    }

    await updateReadingProgress(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("Failed to update progress", {
      err: err instanceof Error ? err.message : String(err),
      route: "PUT /api/progress",
    });
    return NextResponse.json({ error: "Failed to update progress" }, { status: 400 });
  }
}
