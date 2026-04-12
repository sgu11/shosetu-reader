import { describe, expect, it } from "vitest";
import {
  parseToc,
  parseEpisodePage,
} from "@/modules/source/infra/episode-scraper";

const SAMPLE_TOC_HTML = `
<html>
<body>
<div class="p-eplist">
  <div class="p-eplist__chapter-title">第１章　幼年期</div>
  <div class="p-eplist__sublist">
    <a href="/n9669bk/1/" class="p-eplist__subtitle">プロローグ</a>
  </div>
  <div class="p-eplist__sublist">
    <a href="/n9669bk/2/" class="p-eplist__subtitle">転生</a>
  </div>
  <div class="p-eplist__chapter-title">第２章　少年期</div>
  <div class="p-eplist__sublist">
    <a href="/n9669bk/3/" class="p-eplist__subtitle">旅立ち</a>
  </div>
</div>
</body>
</html>
`;

const SAMPLE_EPISODE_HTML = `
<html>
<body>
<h1 class="p-novel__title p-novel__title--rensai">プロローグ</h1>
<div id="novel_honbun">
  <p id="L1">　俺は34歳住所不定無職。</p>
  <p id="L2">　人生を後悔している真っ最中だ。</p>
  <p id="L3">　ただの引きこもりだった。</p>
</div>
</body>
</html>
`;

describe("parseToc", () => {
  it("extracts episode entries from TOC HTML", () => {
    const entries = parseToc(SAMPLE_TOC_HTML, "n9669bk");

    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({
      episodeNumber: 1,
      title: "プロローグ",
      sourceUrl: "https://ncode.syosetu.com/n9669bk/1/",
    });
    expect(entries[1].episodeNumber).toBe(2);
    expect(entries[1].title).toBe("転生");
    expect(entries[2].episodeNumber).toBe(3);
  });

  it("returns empty array for HTML with no episodes", () => {
    const entries = parseToc("<html><body></body></html>", "n1234ab");
    expect(entries).toHaveLength(0);
  });
});

describe("parseEpisodePage", () => {
  it("extracts title and body paragraphs", () => {
    const content = parseEpisodePage(SAMPLE_EPISODE_HTML);

    expect(content.title).toBe("プロローグ");
    expect(content.normalizedText).toContain("俺は34歳住所不定無職。");
    expect(content.normalizedText).toContain("ただの引きこもりだった。");
  });

  it("splits paragraphs by newlines", () => {
    const content = parseEpisodePage(SAMPLE_EPISODE_HTML);
    const lines = content.normalizedText.split("\n");
    expect(lines).toHaveLength(3);
  });

  it("computes a non-empty checksum", () => {
    const content = parseEpisodePage(SAMPLE_EPISODE_HTML);
    expect(content.checksum).toBeTruthy();
    expect(content.checksum.length).toBe(16);
  });

  it("produces consistent checksum for same content", () => {
    const a = parseEpisodePage(SAMPLE_EPISODE_HTML);
    const b = parseEpisodePage(SAMPLE_EPISODE_HTML);
    expect(a.checksum).toBe(b.checksum);
  });
});
