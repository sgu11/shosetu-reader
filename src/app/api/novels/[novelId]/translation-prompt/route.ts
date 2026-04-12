import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { novelTranslationPrompts } from "@/lib/db/schema";
import { ensureDefaultUser } from "@/lib/auth/default-user";

interface RouteContext {
  params: Promise<{ novelId: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { novelId } = await context.params;
    const userId = await ensureDefaultUser();
    const db = getDb();

    const [row] = await db
      .select({ prompt: novelTranslationPrompts.prompt })
      .from(novelTranslationPrompts)
      .where(
        and(
          eq(novelTranslationPrompts.novelId, novelId),
          eq(novelTranslationPrompts.userId, userId),
        ),
      )
      .limit(1);

    return NextResponse.json({
      prompt: row?.prompt ?? "",
    });
  } catch (err) {
    console.error("Failed to fetch novel prompt:", err);
    return NextResponse.json({ error: "Failed to fetch novel prompt" }, { status: 500 });
  }
}

const MAX_PROMPT_LENGTH = 5000;

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { novelId } = await context.params;
    const userId = await ensureDefaultUser();
    const db = getDb();
    const body = await req.json();

    const rawPrompt = typeof body.prompt === "string" ? body.prompt : "";
    if (rawPrompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)` },
        { status: 400 },
      );
    }
    const prompt = rawPrompt;

    const [existing] = await db
      .select({ id: novelTranslationPrompts.id })
      .from(novelTranslationPrompts)
      .where(
        and(
          eq(novelTranslationPrompts.novelId, novelId),
          eq(novelTranslationPrompts.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(novelTranslationPrompts)
        .set({ prompt, updatedAt: new Date() })
        .where(eq(novelTranslationPrompts.id, existing.id));
    } else {
      await db.insert(novelTranslationPrompts).values({
        novelId,
        userId,
        prompt,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update novel prompt:", err);
    return NextResponse.json({ error: "Failed to update novel prompt" }, { status: 500 });
  }
}
