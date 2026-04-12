import { and, eq } from "drizzle-orm";
import { getDefaultUserId } from "@/lib/auth/default-user";
import { getDb } from "@/lib/db/client";
import {
  novelTranslationPrompts,
  readerPreferences,
  readingProgress,
  translationSettings,
  users,
} from "@/lib/db/schema";

const DEFAULT_UI_LOCALE = "ko";
const DEFAULT_READER_LANGUAGE = "ja";
const DEFAULT_THEME = "system";

function targetLooksDefault(targetUser: {
  preferredUiLocale: "en" | "ko";
  preferredReaderLanguage: "ja" | "ko";
  theme: "light" | "dark" | "system";
}) {
  return (
    targetUser.preferredUiLocale === DEFAULT_UI_LOCALE
    && targetUser.preferredReaderLanguage === DEFAULT_READER_LANGUAGE
    && targetUser.theme === DEFAULT_THEME
  );
}

export async function migrateGuestStateToProfile(
  targetUserId: string,
  isNewProfile: boolean,
): Promise<void> {
  const guestUserId = getDefaultUserId();
  if (targetUserId === guestUserId) {
    return;
  }

  const db = getDb();

  await db.transaction(async (tx) => {
    const [guestUsers, targetUsers] = await Promise.all([
      tx
        .select({
          preferredUiLocale: users.preferredUiLocale,
          preferredReaderLanguage: users.preferredReaderLanguage,
          theme: users.theme,
        })
        .from(users)
        .where(eq(users.id, guestUserId))
        .limit(1),
      tx
        .select({
          preferredUiLocale: users.preferredUiLocale,
          preferredReaderLanguage: users.preferredReaderLanguage,
          theme: users.theme,
        })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1),
    ]);

    const guestUser = guestUsers[0];
    const targetUser = targetUsers[0];

    if (guestUser && targetUser && (isNewProfile || targetLooksDefault(targetUser))) {
      await tx
        .update(users)
        .set({
          preferredUiLocale: guestUser.preferredUiLocale,
          preferredReaderLanguage: guestUser.preferredReaderLanguage,
          theme: guestUser.theme,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUserId));
    }

    if (guestUser) {
      await tx
        .update(users)
        .set({
          preferredUiLocale: DEFAULT_UI_LOCALE,
          preferredReaderLanguage: DEFAULT_READER_LANGUAGE,
          theme: DEFAULT_THEME,
          updatedAt: new Date(),
        })
        .where(eq(users.id, guestUserId));
    }

    const [guestReaderPrefs] = await tx
      .select()
      .from(readerPreferences)
      .where(eq(readerPreferences.userId, guestUserId))
      .limit(1);

    if (guestReaderPrefs) {
      const [targetPrefs] = await tx
        .select({ id: readerPreferences.id })
        .from(readerPreferences)
        .where(eq(readerPreferences.userId, targetUserId))
        .limit(1);

      if (!targetPrefs) {
        await tx.insert(readerPreferences).values({
          userId: targetUserId,
          fontSize: guestReaderPrefs.fontSize,
          lineHeight: guestReaderPrefs.lineHeight,
          contentWidth: guestReaderPrefs.contentWidth,
          fontFamily: guestReaderPrefs.fontFamily,
          fontWeight: guestReaderPrefs.fontWeight,
          themeOverride: guestReaderPrefs.themeOverride,
        });
      }

      await tx
        .delete(readerPreferences)
        .where(eq(readerPreferences.id, guestReaderPrefs.id));
    }

    const [guestTranslationSettings] = await tx
      .select()
      .from(translationSettings)
      .where(eq(translationSettings.userId, guestUserId))
      .limit(1);

    if (guestTranslationSettings) {
      const [targetTranslationSettings] = await tx
        .select({ id: translationSettings.id })
        .from(translationSettings)
        .where(eq(translationSettings.userId, targetUserId))
        .limit(1);

      if (!targetTranslationSettings) {
        await tx.insert(translationSettings).values({
          userId: targetUserId,
          modelName: guestTranslationSettings.modelName,
          globalPrompt: guestTranslationSettings.globalPrompt,
        });
      }

      await tx
        .delete(translationSettings)
        .where(eq(translationSettings.id, guestTranslationSettings.id));
    }

    const guestPrompts = await tx
      .select()
      .from(novelTranslationPrompts)
      .where(eq(novelTranslationPrompts.userId, guestUserId));

    for (const prompt of guestPrompts) {
      const [targetPrompt] = await tx
        .select({ id: novelTranslationPrompts.id })
        .from(novelTranslationPrompts)
        .where(
          and(
            eq(novelTranslationPrompts.userId, targetUserId),
            eq(novelTranslationPrompts.novelId, prompt.novelId),
          ),
        )
        .limit(1);

      if (!targetPrompt) {
        await tx.insert(novelTranslationPrompts).values({
          userId: targetUserId,
          novelId: prompt.novelId,
          prompt: prompt.prompt,
        });
      }

      await tx
        .delete(novelTranslationPrompts)
        .where(eq(novelTranslationPrompts.id, prompt.id));
    }

    // Subscriptions are universal (not per-user), so no migration needed.

    const guestProgressRows = await tx
      .select()
      .from(readingProgress)
      .where(eq(readingProgress.userId, guestUserId));

    for (const progress of guestProgressRows) {
      const [targetProgress] = await tx
        .select()
        .from(readingProgress)
        .where(
          and(
            eq(readingProgress.userId, targetUserId),
            eq(readingProgress.novelId, progress.novelId),
          ),
        )
        .limit(1);

      if (!targetProgress) {
        await tx.insert(readingProgress).values({
          userId: targetUserId,
          novelId: progress.novelId,
          currentEpisodeId: progress.currentEpisodeId,
          currentLanguage: progress.currentLanguage,
          scrollAnchor: progress.scrollAnchor,
          progressPercent: progress.progressPercent,
          lastReadAt: progress.lastReadAt,
        });
      } else if (progress.lastReadAt > targetProgress.lastReadAt) {
        await tx
          .update(readingProgress)
          .set({
            currentEpisodeId: progress.currentEpisodeId,
            currentLanguage: progress.currentLanguage,
            scrollAnchor: progress.scrollAnchor,
            progressPercent: progress.progressPercent,
            lastReadAt: progress.lastReadAt,
            updatedAt: new Date(),
          })
          .where(eq(readingProgress.id, targetProgress.id));
      }

      await tx
        .delete(readingProgress)
        .where(eq(readingProgress.id, progress.id));
    }
  });
}
