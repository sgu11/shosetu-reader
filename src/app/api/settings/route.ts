import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users, readerPreferences } from "@/lib/db/schema";
import { ensureDefaultUser, getDefaultUserId } from "@/lib/auth/default-user";

export async function GET() {
  try {
    const userId = await ensureDefaultUser();
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

    const [prefs] = await db
      .select({
        fontSize: readerPreferences.fontSize,
        lineHeight: readerPreferences.lineHeight,
        contentWidth: readerPreferences.contentWidth,
        themeOverride: readerPreferences.themeOverride,
      })
      .from(readerPreferences)
      .where(eq(readerPreferences.userId, userId))
      .limit(1);

    return NextResponse.json({
      locale: user?.preferredUiLocale ?? "en",
      readerLanguage: user?.preferredReaderLanguage ?? "ja",
      theme: user?.theme ?? "system",
      reader: prefs ?? {
        fontSize: "medium",
        lineHeight: "1.8",
        contentWidth: "680",
        themeOverride: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = await ensureDefaultUser();
    const db = getDb();
    const body = await req.json();

    const { locale, readerLanguage, theme, reader } = body;

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

    // Upsert reader preferences
    if (reader) {
      const readerUpdate: Record<string, string | null> = {};
      if (reader.fontSize) readerUpdate.fontSize = String(reader.fontSize);
      if (reader.lineHeight) readerUpdate.lineHeight = String(reader.lineHeight);
      if (reader.contentWidth) readerUpdate.contentWidth = String(reader.contentWidth);
      if (reader.themeOverride !== undefined) {
        readerUpdate.themeOverride = reader.themeOverride;
      }

      const [existing] = await db
        .select({ id: readerPreferences.id })
        .from(readerPreferences)
        .where(eq(readerPreferences.userId, userId))
        .limit(1);

      if (existing) {
        await db
          .update(readerPreferences)
          .set({ ...readerUpdate, updatedAt: new Date() })
          .where(eq(readerPreferences.userId, userId));
      } else {
        await db.insert(readerPreferences).values({
          userId,
          ...readerUpdate,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
