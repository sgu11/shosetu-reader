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
<div class="p-novel__body">
<div class="js-novel-text p-novel__text">
  <p id="L1">　俺は34歳住所不定無職。</p>
  <p id="L2">　人生を後悔している真っ最中だ。</p>
  <p id="L3">　ただの引きこもりだった。</p>
</div>
</div>
</body>
</html>
`;

const SAMPLE_EPISODE_WITH_PREFACE_AND_AFTERWORD = `
<html>
<body>
<h1 class="p-novel__title p-novel__title--rensai">特別編</h1>
<div class="p-novel__body">
<div class="js-novel-text p-novel__text p-novel__text--preface">
  <p id="Lp1">　特賞のスペシャルブックレット用に書きおろし小説です。</p>
  <p id="Lp2">　お楽しみください。</p>
</div>
<div class="js-novel-text p-novel__text">
  <p id="L1">　物語の本文がここに始まる。</p>
  <p id="L2">　主人公は旅に出た。</p>
</div>
<div class="js-novel-text p-novel__text p-novel__text--afterword">
  <p id="La1">　活動報告も更新しましたので、そちらも確認してみて下さい。</p>
</div>
</div>
</body>
</html>
`;

const SAMPLE_EPISODE_WITH_AFTERWORD_ONLY = `
<html>
<body>
<h1 class="p-novel__title p-novel__title--rensai">最終話</h1>
<div class="p-novel__body">
<div class="js-novel-text p-novel__text">
  <p id="L1">　最後の一文。</p>
</div>
<div class="js-novel-text p-novel__text p-novel__text--afterword">
  <p id="La1">- あとがき -</p>
  <p id="La2">　ご愛読ありがとうございました。</p>
</div>
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

  it("returns null preface/afterword for body-only episodes", () => {
    const content = parseEpisodePage(SAMPLE_EPISODE_HTML);
    expect(content.prefaceText).toBeNull();
    expect(content.afterwordText).toBeNull();
  });

  it("extracts preface and afterword when present", () => {
    const content = parseEpisodePage(SAMPLE_EPISODE_WITH_PREFACE_AND_AFTERWORD);

    expect(content.title).toBe("特別編");

    // Body should contain only main text, not preface/afterword
    expect(content.normalizedText).toContain("物語の本文がここに始まる。");
    expect(content.normalizedText).toContain("主人公は旅に出た。");
    expect(content.normalizedText).not.toContain("スペシャルブックレット");
    expect(content.normalizedText).not.toContain("活動報告");

    // Preface
    expect(content.prefaceText).toContain("スペシャルブックレット");
    expect(content.prefaceText).toContain("お楽しみください");

    // Afterword
    expect(content.afterwordText).toContain("活動報告");
  });

  it("handles afterword-only episodes", () => {
    const content = parseEpisodePage(SAMPLE_EPISODE_WITH_AFTERWORD_ONLY);

    expect(content.normalizedText).toBe("　最後の一文。");
    expect(content.prefaceText).toBeNull();
    expect(content.afterwordText).toContain("あとがき");
    expect(content.afterwordText).toContain("ご愛読ありがとうございました");
  });

  it("does not mix preface/afterword paragraphs into body", () => {
    const content = parseEpisodePage(SAMPLE_EPISODE_WITH_PREFACE_AND_AFTERWORD);
    const bodyLines = content.normalizedText.split("\n");

    // Body should have exactly 2 paragraphs
    expect(bodyLines).toHaveLength(2);
  });

  it("includes preface/afterword in checksum", () => {
    const withNotes = parseEpisodePage(SAMPLE_EPISODE_WITH_PREFACE_AND_AFTERWORD);
    const bodyOnly = parseEpisodePage(SAMPLE_EPISODE_HTML);

    // Different content should produce different checksums
    expect(withNotes.checksum).not.toBe(bodyOnly.checksum);
  });
});
