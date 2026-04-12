/**
 * Syosetu episode scraping — TOC parsing and episode body extraction.
 *
 * TOC page: https://ncode.syosetu.com/{ncode}/
 *   - Episodes listed as <a href="/{ncode}/{num}/" class="p-eplist__subtitle">
 *   - Chapter headings in <div class="p-eplist__chapter-title">
 *
 * Episode page: https://ncode.syosetu.com/{ncode}/{num}/
 *   - Title in <h1 class="p-novel__title">
 *   - Body paragraphs in <p id="L1">, <p id="L2">, etc.
 */

import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { buildNovelUrl, buildEpisodeUrl } from "../domain/ncode";

const USER_AGENT = "ShosetuReader/0.1";

export interface TocEntry {
  episodeNumber: number;
  title: string;
  sourceUrl: string;
}

export interface EpisodeContent {
  title: string;
  rawHtml: string;
  normalizedText: string;
  checksum: string;
}

/**
 * Fetch and parse the novel's table of contents to get episode list.
 */
export async function fetchEpisodeList(ncode: string): Promise<TocEntry[]> {
  const url = buildNovelUrl(ncode);
  const html = await fetchPage(url);
  return parseToc(html, ncode);
}

/**
 * Fetch and parse a single episode's content.
 */
export async function fetchEpisodeContent(
  ncode: string,
  episodeNumber: number,
): Promise<EpisodeContent> {
  const url = buildEpisodeUrl(ncode, episodeNumber);
  const html = await fetchPage(url);
  return parseEpisodePage(html);
}

// --- Internal ---

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }

  return res.text();
}

export function parseToc(html: string, ncode: string): TocEntry[] {
  const $ = cheerio.load(html);
  const entries: TocEntry[] = [];

  $("a.p-eplist__subtitle").each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/\/(\d+)\/?\s*$/);
    if (!match) return;

    const episodeNumber = parseInt(match[1], 10);
    const title = $(el).text().trim();

    entries.push({
      episodeNumber,
      title,
      sourceUrl: buildEpisodeUrl(ncode, episodeNumber),
    });
  });

  return entries;
}

export function parseEpisodePage(html: string): EpisodeContent {
  const $ = cheerio.load(html);

  const title = $("h1.p-novel__title").first().text().trim();

  // Collect body paragraphs (id="L1", "L2", etc.)
  const paragraphs: string[] = [];
  $('p[id^="L"]').each((_i, el) => {
    paragraphs.push($(el).text());
  });

  const rawHtml = $('p[id^="L"]')
    .map((_i, el) => $.html(el))
    .get()
    .join("\n");

  const normalizedText = paragraphs.join("\n");

  const checksum = createHash("sha256")
    .update(normalizedText)
    .digest("hex")
    .slice(0, 16);

  return {
    title: title || "",
    rawHtml,
    normalizedText,
    checksum,
  };
}
