import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db/client";
import {
  novels,
  episodes,
  translations,
  novelGlossaries,
  novelGlossaryEntries,
  subscriptions,
  readingProgress,
  users,
} from "@/lib/db/schema";

const DEMO_USER_ID = "00000000-0000-4000-a000-000000000001";

type NovelFixture = {
  id: string;
  source_site: "syosetu";
  source_ncode: string;
  source_url: string;
  title_ja: string;
  title_ko: string | null;
  author_name: string | null;
  summary_ja: string | null;
  summary_ko: string | null;
  total_episodes: number;
};

type EpisodeJaFixture = {
  id: string;
  novel_id: string;
  source_episode_id: string;
  episode_number: number;
  title_ja: string;
  source_url: string;
  raw_text_ja: string;
  fetch_status: "pending" | "fetching" | "fetched" | "failed";
};

type TranslationFixture = {
  episode_id: string;
  target_language: "ja" | "ko";
  provider: string;
  model_name: string;
  prompt_version: string;
  source_checksum: string;
  status: "queued" | "processing" | "available" | "failed";
  is_canonical: boolean;
  translated_text: string;
};

type GlossaryFixture = {
  novel_id: string;
  glossary_version: number;
  glossary_text: string;
  entries: Array<{
    term_ja: string;
    term_ko: string;
    category: "character" | "place" | "term" | "skill" | "honorific";
    status: "confirmed" | "suggested" | "rejected";
  }>;
};

function readFixture<T>(name: string): T {
  const full = path.resolve(process.cwd(), env.DEMO_FIXTURES_PATH, name);
  return JSON.parse(readFileSync(full, "utf8")) as T;
}

export async function seedDemo() {
  const novel = readFixture<NovelFixture>("novel.json");
  const epJa = readFixture<EpisodeJaFixture[]>("episodes.ja.json");
  const txFix = readFixture<TranslationFixture[]>("episodes.ko.json");
  const gloss = readFixture<GlossaryFixture>("glossary.json");

  const db = getDb();

  await db.transaction(async (tx) => {
    // Delete in FK order
    await tx.delete(readingProgress).where(eq(readingProgress.novelId, novel.id));
    await tx.delete(subscriptions).where(eq(subscriptions.novelId, novel.id));
    for (const ep of epJa) {
      await tx.delete(translations).where(eq(translations.episodeId, ep.id));
    }
    await tx.delete(novelGlossaryEntries).where(eq(novelGlossaryEntries.novelId, novel.id));
    await tx.delete(novelGlossaries).where(eq(novelGlossaries.novelId, novel.id));
    await tx.delete(episodes).where(eq(episodes.novelId, novel.id));
    await tx.delete(novels).where(eq(novels.id, novel.id));

    await tx
      .insert(users)
      .values({
        id: DEMO_USER_ID,
        email: "demo@shosetu-reader.local",
        displayName: "Demo Reader",
        preferredUiLocale: "ko",
        preferredReaderLanguage: "ko",
      })
      .onConflictDoNothing();

    await tx.insert(novels).values({
      id: novel.id,
      sourceSite: novel.source_site,
      sourceNcode: novel.source_ncode,
      sourceUrl: novel.source_url,
      titleJa: novel.title_ja,
      titleKo: novel.title_ko,
      authorName: novel.author_name,
      summaryJa: novel.summary_ja,
      summaryKo: novel.summary_ko,
      totalEpisodes: novel.total_episodes,
    });

    await tx.insert(episodes).values(
      epJa.map((e) => ({
        id: e.id,
        novelId: e.novel_id,
        sourceEpisodeId: e.source_episode_id,
        episodeNumber: e.episode_number,
        titleJa: e.title_ja,
        sourceUrl: e.source_url,
        rawTextJa: e.raw_text_ja,
        normalizedTextJa: e.raw_text_ja,
        fetchStatus: e.fetch_status,
      })),
    );

    await tx.insert(translations).values(
      txFix.map((t) => ({
        episodeId: t.episode_id,
        targetLanguage: t.target_language,
        provider: t.provider,
        modelName: t.model_name,
        promptVersion: t.prompt_version,
        sourceChecksum: t.source_checksum,
        status: t.status,
        translatedText: t.translated_text,
        isCanonical: t.is_canonical,
      })),
    );

    await tx.insert(novelGlossaries).values({
      novelId: gloss.novel_id,
      glossary: gloss.glossary_text,
      glossaryVersion: gloss.glossary_version,
    });

    if (gloss.entries.length > 0) {
      await tx.insert(novelGlossaryEntries).values(
        gloss.entries.map((e) => ({
          novelId: gloss.novel_id,
          termJa: e.term_ja,
          termKo: e.term_ko,
          category: e.category,
          status: e.status,
        })),
      );
    }

    await tx.insert(subscriptions).values({
      novelId: novel.id,
      isActive: true,
      lastCheckedEpisodeCount: novel.total_episodes,
    });

    await tx.insert(readingProgress).values({
      userId: DEMO_USER_ID,
      novelId: novel.id,
      currentEpisodeId: epJa[1]?.id ?? epJa[0].id,
      currentLanguage: "ko",
      progressPercent: 0.35,
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemo()
    .then(() => {
      console.log("demo seeded");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
