/**
 * Source adapter registry. Holds one instance per site, optionally wrapped in
 * a per-host token bucket so concurrent calls from API routes and the worker
 * share one rate budget against the upstream domain.
 *
 * `parseInput` is the entry point for register/URL parsing — tries every
 * adapter's URL matcher first, then falls back to bare-id matchers in a
 * deterministic priority order.
 */

import type { SourceAdapter, SourceSite } from "../domain/source-adapter";
import { syosetuAdapter } from "./syosetu-adapter";

class HostBucket {
  private chain: Promise<unknown> = Promise.resolve();
  private last = 0;

  constructor(private readonly intervalMs: number) {}

  async acquire(): Promise<void> {
    const next = this.chain.then(async () => {
      const now = Date.now();
      const wait = Math.max(0, this.last + this.intervalMs - now);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.last = Date.now();
    });
    this.chain = next.catch(() => undefined);
    await next;
  }
}

function withRateLimit(adapter: SourceAdapter, bucket: HostBucket): SourceAdapter {
  const gate = async <T>(thunk: () => Promise<T>): Promise<T> => {
    await bucket.acquire();
    return thunk();
  };
  return {
    ...adapter,
    fetchNovelMetadata: (id) => gate(() => adapter.fetchNovelMetadata(id)),
    fetchEpisodeList: (id) => gate(() => adapter.fetchEpisodeList(id)),
    fetchEpisodeContent: (id, ep) => gate(() => adapter.fetchEpisodeContent(id, ep)),
    fetchRanking: (period, limit) => gate(() => adapter.fetchRanking(period, limit)),
  };
}

const SYOSETU_HOST_BUCKET = new HostBucket(1000);

const adapters: Partial<Record<SourceSite, SourceAdapter>> = {
  syosetu: withRateLimit(syosetuAdapter, SYOSETU_HOST_BUCKET),
};

export function getAdapter(site: SourceSite): SourceAdapter {
  const adapter = adapters[site];
  if (!adapter) {
    throw new Error(`Source adapter not implemented: ${site}`);
  }
  return adapter;
}

export function listEnabledSites(): SourceSite[] {
  return Object.keys(adapters) as SourceSite[];
}

/**
 * Parse a user-supplied URL or bare id into a registered source.
 * URL matching runs across every enabled adapter first; bare-id matching
 * falls back in priority order.
 */
export function parseInput(input: string): { site: SourceSite; id: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  for (const site of listEnabledSites()) {
    const adapter = adapters[site];
    const id = adapter?.matchUrl(trimmed);
    if (id) return { site, id };
  }

  for (const site of listEnabledSites()) {
    const adapter = adapters[site];
    const id = adapter?.matchBareId(trimmed);
    if (id) return { site, id };
  }

  return null;
}
