/**
 * Multi-source ranking aggregator. Fan-out across the registry, apply the
 * adult-content filter, and return one section per requested site so the UI
 * can render each as its own grouped block.
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { novels } from "@/lib/db/schema";
import { getAdapter, listEnabledSites } from "@/modules/source/infra/registry";
import type {
  NovelMetadata,
  RankingPeriod,
  SourceSite,
} from "@/modules/source/domain/source-adapter";
import {
  filterAdultContent,
  type AdultFilterContext,
} from "./adult-filter";

const SECTION_TIMEOUT_MS = 8000;

export type SectionStatus = "ok" | "timeout" | "error";

export interface RankingSectionItem {
  rank: number;
  site: SourceSite;
  sourceId: string;
  title: string;
  authorName: string;
  totalEpisodes: number | null;
  isCompleted: boolean | null;
  sourceUrl: string;
  /** null if not yet registered locally. */
  novelId: string | null;
}

export interface RankingSection {
  site: SourceSite;
  status: SectionStatus;
  errorMessage: string | null;
  items: RankingSectionItem[];
}

export type RankingScope = "sfw" | "all" | SourceSite;

interface FetchOpts {
  scope: RankingScope;
  period: RankingPeriod;
  limit: number;
  ctx: AdultFilterContext | null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Object.assign(new Error("timeout"), { name: "TimeoutError" })),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function resolveSitesForScope(scope: RankingScope, ctx: AdultFilterContext | null): SourceSite[] {
  const enabled = listEnabledSites();
  if (scope === "sfw") {
    return enabled.filter((s) => !getAdapter(s).isAdult);
  }
  if (scope === "all") {
    if (!ctx?.adultContentEnabled) {
      return enabled.filter((s) => !getAdapter(s).isAdult);
    }
    return enabled;
  }
  if (!enabled.includes(scope)) return [];
  // Specific site requested — gate adult sites by ctx.
  const adapter = getAdapter(scope);
  if (adapter.isAdult && !ctx?.adultContentEnabled) return [];
  return [scope];
}

async function loadExistingNovelIds(
  picks: Array<{ site: SourceSite; sourceId: string }>,
): Promise<Map<string, string>> {
  if (picks.length === 0) return new Map();
  const db = getDb();
  const bySite = new Map<SourceSite, string[]>();
  for (const p of picks) {
    const arr = bySite.get(p.site) ?? [];
    arr.push(p.sourceId);
    bySite.set(p.site, arr);
  }
  const out = new Map<string, string>();
  for (const [site, ids] of bySite) {
    const rows = await db
      .select({ id: novels.id, sourceSite: novels.sourceSite, sourceId: novels.sourceId })
      .from(novels)
      .where(and(eq(novels.sourceSite, site), inArray(novels.sourceId, ids)));
    for (const row of rows) {
      out.set(`${row.sourceSite}::${row.sourceId}`, row.id);
    }
  }
  return out;
}

function toSectionItems(
  site: SourceSite,
  items: NovelMetadata[],
  novelIdLookup: Map<string, string>,
): RankingSectionItem[] {
  const adapter = getAdapter(site);
  return items.map((meta, index) => ({
    rank: index + 1,
    site,
    sourceId: meta.id,
    title: meta.title,
    authorName: meta.authorName,
    totalEpisodes: meta.totalEpisodes,
    isCompleted: meta.isCompleted,
    sourceUrl: adapter.buildNovelUrl(meta.id),
    novelId: novelIdLookup.get(`${site}::${meta.id}`) ?? null,
  }));
}

export async function getRankingSections(
  opts: FetchOpts,
): Promise<RankingSection[]> {
  const sites = resolveSitesForScope(opts.scope, opts.ctx);
  if (sites.length === 0) return [];

  const settled = await Promise.allSettled(
    sites.map((site) => {
      const adapter = getAdapter(site);
      const period: RankingPeriod = adapter.supportedPeriods.includes(opts.period)
        ? opts.period
        : adapter.supportedPeriods[0];
      return withTimeout(adapter.fetchRanking(period, opts.limit), SECTION_TIMEOUT_MS).then(
        (items) => ({ site, items }),
      );
    }),
  );

  // Collect all (site, sourceId) pairs from successful results so we can do
  // a single grouped DB lookup before mapping back to per-site sections.
  const all: Array<{ site: SourceSite; sourceId: string }> = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      for (const m of r.value.items) {
        all.push({ site: r.value.site, sourceId: m.id });
      }
    }
  }
  const novelIdLookup = await loadExistingNovelIds(all);

  return sites.map((site, i) => {
    const r = settled[i];
    if (r.status === "fulfilled") {
      const filtered = filterAdultContent(
        r.value.items.map((m) => ({ ...m, sourceSite: site })),
        opts.ctx,
      );
      return {
        site,
        status: "ok",
        errorMessage: null,
        items: toSectionItems(site, filtered, novelIdLookup),
      };
    }
    const err = r.reason as Error | undefined;
    const isTimeout = err?.name === "TimeoutError";
    return {
      site,
      status: isTimeout ? "timeout" : "error",
      errorMessage: isTimeout ? "timeout" : err?.message ?? "unknown error",
      items: [],
    };
  });
}
