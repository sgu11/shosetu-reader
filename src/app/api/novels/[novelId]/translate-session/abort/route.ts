import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { translationSessions } from "@/lib/db/schema";
import { isValidUuid } from "@/lib/validation";

/**
 * POST /api/novels/:novelId/translate-session/abort
 *
 * Cancels the active translation session for a novel.
 * The advanceSession() loop already checks session.status !== "active"
 * and returns early, so setting status to "cancelled" stops the chain.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ novelId: string }> },
) {
  const { novelId } = await params;
  if (!isValidUuid(novelId)) {
    return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
  }

  const db = getDb();

  const [session] = await db
    .select({ id: translationSessions.id })
    .from(translationSessions)
    .where(
      and(
        eq(translationSessions.novelId, novelId),
        eq(translationSessions.status, "active"),
      ),
    )
    .limit(1);

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "No active translation session" },
      { status: 404 },
    );
  }

  await db
    .update(translationSessions)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(translationSessions.id, session.id));

  return NextResponse.json({ ok: true, sessionId: session.id });
}
