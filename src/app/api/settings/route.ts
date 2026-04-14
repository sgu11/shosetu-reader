import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { resolveUserId } from "@/modules/identity/application/resolve-user-context";

// 30 settings reads per minute, 10 writes per minute
const READ_LIMIT = { limit: 30, windowSeconds: 60 };
const WRITE_LIMIT = { limit: 10, windowSeconds: 60 };

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, READ_LIMIT, "settings-r");
  if (limited) return limited;
  try {
    const userId = await resolveUserId();
    const db = getDb();

    const [user] = await db
      .select({
        preferredUiLocale: users.preferredUiLocale,
        preferredReaderLanguage: users.preferredReaderLanguage,
        theme: users.theme,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return NextResponse.json({
      locale: user?.preferredUiLocale ?? "ko",
      readerLanguage: user?.preferredReaderLanguage ?? "ja",
      theme: user?.theme ?? "system",
    });
  } catch (err) {
    console.error("Failed to fetch settings:", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const limited = await rateLimit(req, WRITE_LIMIT, "settings-w");
  if (limited) return limited;

  try {
    const userId = await resolveUserId();
    const db = getDb();
    const body = await req.json();

    const { locale, readerLanguage, theme } = body;

    // Update user preferences
    const userUpdate: Record<string, string> = {};
    if (locale === "en" || locale === "ko") userUpdate.preferredUiLocale = locale;
    if (readerLanguage === "ja" || readerLanguage === "ko") userUpdate.preferredReaderLanguage = readerLanguage;
    if (theme === "light" || theme === "dark" || theme === "system") userUpdate.theme = theme;

    if (Object.keys(userUpdate).length > 0) {
      await db
        .update(users)
        .set({ ...userUpdate, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to update settings:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
