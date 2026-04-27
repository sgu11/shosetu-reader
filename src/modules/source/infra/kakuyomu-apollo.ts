/**
 * Tolerant parser for kakuyomu's `__NEXT_DATA__` Apollo state.
 *
 * Kakuyomu embeds `<script id="__NEXT_DATA__" type="application/json">` on
 * every work + episode page. The relevant slice is at
 * `props.pageProps.__APOLLO_STATE__`, a normalized cache keyed by
 * `{__typename}:{id}`. We only require the 5–6 fields we read from the
 * Work and Episode entities; everything else passes through so additive
 * upstream schema changes don't break parsing.
 */

import { z } from "zod";

const refSchema = z.object({ __ref: z.string() });

const workEntitySchema = z
  .object({
    __typename: z.literal("Work").optional(),
    id: z.string(),
    title: z.string(),
    introduction: z.string().nullish(),
    catchphrase: z.string().nullish(),
    publishedAt: z.string().nullish(),
    lastEpisodePublishedAt: z.string().nullish(),
    serialStatus: z.string().nullish(),
    publicEpisodeCount: z.number().nullish(),
    totalCharacterCount: z.number().nullish(),
    isCruel: z.boolean().nullish(),
    isViolent: z.boolean().nullish(),
    isSexual: z.boolean().nullish(),
    author: refSchema.nullish(),
    tableOfContentsV2: z.array(refSchema).nullish(),
  })
  .passthrough();

const userAccountSchema = z
  .object({
    activityName: z.string().nullish(),
    name: z.string().nullish(),
  })
  .passthrough();

const tocChapterSchema = z
  .object({
    episodeUnions: z.array(refSchema).nullish(),
    chapter: refSchema.nullish(),
  })
  .passthrough();

const chapterSchema = z
  .object({
    title: z.string().nullish(),
    level: z.number().nullish(),
  })
  .passthrough();

const episodeSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    publishedAt: z.string().nullish(),
  })
  .passthrough();

export interface KakuyomuWorkSnapshot {
  id: string;
  title: string;
  authorName: string;
  summary: string;
  catchphrase: string | null;
  publishedAt: string | null;
  lastEpisodePublishedAt: string | null;
  isCompleted: boolean | null;
  publicEpisodeCount: number | null;
  totalCharacterCount: number | null;
  /** Aggregated adult flags from kakuyomu's per-work toggles. */
  isAdult: boolean;
  episodes: KakuyomuEpisodeRef[];
  raw: unknown;
}

export interface KakuyomuEpisodeRef {
  id: string;
  title: string;
  episodeNumber: number;
  chapterTitle: string | null;
  publishedAt: string | null;
}

export class KakuyomuParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KakuyomuParseError";
  }
}

function extractApolloState(html: string): Record<string, unknown> {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) {
    throw new KakuyomuParseError("__NEXT_DATA__ script tag not found");
  }
  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch (err) {
    throw new KakuyomuParseError(
      `__NEXT_DATA__ JSON parse failed: ${(err as Error).message}`,
    );
  }
  const state = (data as { props?: { pageProps?: { __APOLLO_STATE__?: unknown } } })
    ?.props?.pageProps?.__APOLLO_STATE__;
  if (!state || typeof state !== "object") {
    throw new KakuyomuParseError("__APOLLO_STATE__ missing in __NEXT_DATA__");
  }
  return state as Record<string, unknown>;
}

function refId(ref: { __ref: string } | null | undefined): string | null {
  if (!ref) return null;
  return ref.__ref;
}

export function parseWorkPage(
  html: string,
  workId: string,
): KakuyomuWorkSnapshot {
  const state = extractApolloState(html);
  const workKey = `Work:${workId}`;
  const rawWork = state[workKey];
  if (!rawWork) {
    throw new KakuyomuParseError(`Work entity ${workKey} not in Apollo state`);
  }
  const work = workEntitySchema.parse(rawWork);

  let authorName = "";
  const authorRef = refId(work.author ?? null);
  if (authorRef) {
    const rawAuthor = state[authorRef];
    if (rawAuthor) {
      const author = userAccountSchema.parse(rawAuthor);
      authorName = author.activityName ?? author.name ?? "";
    }
  }

  // Walk tableOfContentsV2 → TableOfContentsChapter → episodeUnions → Episode
  const episodes: KakuyomuEpisodeRef[] = [];
  let counter = 1;
  for (const tocRef of work.tableOfContentsV2 ?? []) {
    const tocKey = refId(tocRef);
    if (!tocKey) continue;
    const rawToc = state[tocKey];
    if (!rawToc) continue;
    const toc = tocChapterSchema.parse(rawToc);

    let chapterTitle: string | null = null;
    const chapterKey = refId(toc.chapter ?? null);
    if (chapterKey) {
      const rawChapter = state[chapterKey];
      if (rawChapter) {
        chapterTitle = chapterSchema.parse(rawChapter).title ?? null;
      }
    }

    for (const epRef of toc.episodeUnions ?? []) {
      const epKey = refId(epRef);
      if (!epKey) continue;
      const rawEp = state[epKey];
      if (!rawEp) continue;
      const ep = episodeSchema.parse(rawEp);
      episodes.push({
        id: ep.id,
        title: ep.title,
        episodeNumber: counter++,
        chapterTitle,
        publishedAt: ep.publishedAt ?? null,
      });
    }
  }

  return {
    id: work.id,
    title: work.title,
    authorName,
    summary: work.introduction ?? "",
    catchphrase: work.catchphrase ?? null,
    publishedAt: work.publishedAt ?? null,
    lastEpisodePublishedAt: work.lastEpisodePublishedAt ?? null,
    isCompleted:
      work.serialStatus == null
        ? null
        : work.serialStatus === "COMPLETED",
    publicEpisodeCount: work.publicEpisodeCount ?? null,
    totalCharacterCount: work.totalCharacterCount ?? null,
    isAdult: Boolean(work.isCruel || work.isViolent || work.isSexual),
    episodes,
    raw: rawWork,
  };
}
