import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { translationSettings } from "@/lib/db/schema";
import { ensureDefaultUser } from "@/lib/auth/default-user";
import { env } from "@/lib/env";
import { DEFAULT_GLOBAL_PROMPT } from "@/modules/translation/domain/default-prompt";

export async function GET() {
  try {
    const userId = await ensureDefaultUser();
    const db = getDb();

    const [settings] = await db
      .select({
        modelName: translationSettings.modelName,
        globalPrompt: translationSettings.globalPrompt,
      })
      .from(translationSettings)
      .where(eq(translationSettings.userId, userId))
      .limit(1);

    return NextResponse.json({
      modelName: settings?.modelName ?? env.OPENROUTER_DEFAULT_MODEL,
      globalPrompt: settings?.globalPrompt ?? "",
      defaultGlobalPrompt: DEFAULT_GLOBAL_PROMPT,
    });
  } catch (err) {
    console.error("Failed to fetch translation settings:", err);
    return NextResponse.json({ error: "Failed to fetch translation settings" }, { status: 500 });
  }
}

const MAX_MODEL_NAME_LENGTH = 200;
const MAX_GLOBAL_PROMPT_LENGTH = 5000;

export async function PUT(req: NextRequest) {
  try {
    const userId = await ensureDefaultUser();
    const db = getDb();
    const body = await req.json();

    const { modelName, globalPrompt } = body;

    // Validate length limits
    if (typeof modelName === "string" && modelName.length > MAX_MODEL_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Model name too long (max ${MAX_MODEL_NAME_LENGTH} characters)` },
        { status: 400 },
      );
    }
    if (typeof globalPrompt === "string" && globalPrompt.length > MAX_GLOBAL_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Global prompt too long (max ${MAX_GLOBAL_PROMPT_LENGTH} characters)` },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select({ id: translationSettings.id })
      .from(translationSettings)
      .where(eq(translationSettings.userId, userId))
      .limit(1);

    const update: Record<string, string> = {};
    if (typeof modelName === "string" && modelName.trim()) {
      update.modelName = modelName.trim();
    }
    if (typeof globalPrompt === "string") {
      update.globalPrompt = globalPrompt;
    }

    if (existing) {
      await db
        .update(translationSettings)
        .set({ ...update, updatedAt: new Date() })
        .where(eq(translationSettings.userId, userId));
    } else {
      await db.insert(translationSettings).values({
        userId,
        modelName: update.modelName ?? env.OPENROUTER_DEFAULT_MODEL,
        globalPrompt: update.globalPrompt ?? "",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update translation settings:", err);
    return NextResponse.json({ error: "Failed to update translation settings" }, { status: 500 });
  }
}
