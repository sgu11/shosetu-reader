import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users, readerPreferences } from "@/lib/db/schema";
import { ensureDefaultUser } from "@/lib/auth/default-user";
import { rateLimit } from "@/lib/rate-limit";

// 30 settings reads per minute, 10 writes per minute
const READ_LIMIT = { limit: 30, windowSeconds: 60 };
const WRITE_LIMIT = { limit: 10, windowSeconds: 60 };

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, READ_LIMIT, "settings-r");
  if (limited) return limited;
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
        fontFamily: readerPreferences.fontFamily,
        fontWeight: readerPreferences.fontWeight,
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
        fontFamily: "noto-serif-jp",
        fontWeight: "normal",
        themeOverride: null,
      },
    });
  } catch (err) {
    console.error("Failed to fetch settings:", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const limited = rateLimit(req, WRITE_LIMIT, "settings-w");
  if (limited) return limited;

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

    // Upsert reader preferences (allowlist values to prevent CSS injection)
    const ALLOWED_FONT_FAMILIES = new Set(["noto-serif-jp", "nanum-myeongjo", "nanum-gothic", "pretendard"]);
    const ALLOWED_FONT_WEIGHTS = new Set(["normal", "bold"]);
    const ALLOWED_FONT_SIZES = new Set(["small", "medium", "large"]);
    const ALLOWED_THEME_OVERRIDES = new Set(["light", "dark"]);

    if (reader) {
      const readerUpdate: Record<string, string | null> = {};
      if (reader.fontSize && ALLOWED_FONT_SIZES.has(String(reader.fontSize))) {
        readerUpdate.fontSize = String(reader.fontSize);
      }
      if (reader.lineHeight) {
        const lh = parseFloat(String(reader.lineHeight));
        if (!isNaN(lh) && lh >= 1.0 && lh <= 3.0) {
          readerUpdate.lineHeight = String(lh);
        }
      }
      if (reader.contentWidth) {
        const cw = parseInt(String(reader.contentWidth), 10);
        if (!isNaN(cw) && cw >= 400 && cw <= 1200) {
          readerUpdate.contentWidth = String(cw);
        }
      }
      if (reader.fontFamily && ALLOWED_FONT_FAMILIES.has(String(reader.fontFamily))) {
        readerUpdate.fontFamily = String(reader.fontFamily);
      }
      if (reader.fontWeight && ALLOWED_FONT_WEIGHTS.has(String(reader.fontWeight))) {
        readerUpdate.fontWeight = String(reader.fontWeight);
      }
      if (reader.themeOverride !== undefined) {
        readerUpdate.themeOverride = reader.themeOverride === null || ALLOWED_THEME_OVERRIDES.has(String(reader.themeOverride))
          ? reader.themeOverride
          : null;
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
    console.error("Failed to update settings:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
