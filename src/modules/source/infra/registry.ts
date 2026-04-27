/**
 * Source adapter registry. Holds one instance per site.
 *
 * `parseInput` is the entry point for register/URL parsing — tries every
 * adapter's URL matcher first, then falls back to bare-id matchers in a
 * deterministic priority order.
 *
 * Note on rate limiting: an earlier iteration wrapped each adapter in a
 * promise-chain token bucket per host. That serialized every outbound fetch
 * across the whole process — fine for a worker batch loop, but a hard
 * deadlock for API routes when the worker was busy: a /ranking or /reader
 * request would queue behind every pending ingest fetch and time out at
 * 20s. The current design pushes throttling responsibility back to each
 * caller (the ingest worker has its own per-novel sleep loop) and keeps
 * the registry thin.
 */

import type { SourceAdapter, SourceSite } from "../domain/source-adapter";
import { syosetuAdapter } from "./syosetu-adapter";
import { nocturneAdapter } from "./nocturne-adapter";
import { kakuyomuAdapter } from "./kakuyomu-adapter";
import { alphapolisAdapter } from "./alphapolis-adapter";

const adapters: Partial<Record<SourceSite, SourceAdapter>> = {
  syosetu: syosetuAdapter,
  nocturne: nocturneAdapter,
  kakuyomu: kakuyomuAdapter,
  alphapolis: alphapolisAdapter,
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
