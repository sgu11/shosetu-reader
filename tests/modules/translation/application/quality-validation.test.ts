import { describe, it, expect } from "vitest";
import { validateTranslation } from "@/modules/translation/application/quality-validation";

describe("validateTranslation", () => {
  // 1. EMPTY_OUTPUT
  it("flags empty output", () => {
    const warnings = validateTranslation({
      sourceText: "こんにちは。世界。",
      translatedText: "   ",
      chunkCount: null,
    });
    expect(warnings.some((w) => w.code === "EMPTY_OUTPUT")).toBe(true);
    expect(warnings[0].severity).toBe("error");
  });

  it("does not flag non-empty output", () => {
    const warnings = validateTranslation({
      sourceText: "こんにちは。",
      translatedText: "안녕하세요.",
      chunkCount: null,
    });
    expect(warnings.some((w) => w.code === "EMPTY_OUTPUT")).toBe(false);
  });

  // 2. SUSPICIOUSLY_SHORT
  it("flags suspiciously short translation", () => {
    const warnings = validateTranslation({
      sourceText: "長い日本語のテキストがここにあります。十分な長さの文章です。テストテキスト。",
      translatedText: "짧음",
      chunkCount: null,
    });
    expect(warnings.some((w) => w.code === "SUSPICIOUSLY_SHORT")).toBe(true);
  });

  it("does not flag normal length translation", () => {
    const source = "こんにちは。今日はいい天気ですね。散歩に行きましょう。お昼ご飯を食べましたか。";
    const translated = "안녕하세요. 오늘은 날씨가 좋네요. 산책하러 갑시다. 점심 드셨어요. 배가 부릅니다.";
    const warnings = validateTranslation({
      sourceText: source,
      translatedText: translated,
      chunkCount: null,
    });
    expect(warnings.some((w) => w.code === "SUSPICIOUSLY_SHORT")).toBe(false);
  });

  // 3. SUSPICIOUSLY_LONG
  it("flags suspiciously long translation", () => {
    const warnings = validateTranslation({
      sourceText: "短いテキスト",
      translatedText: "매우".repeat(200),
      chunkCount: null,
    });
    expect(warnings.some((w) => w.code === "SUSPICIOUSLY_LONG")).toBe(true);
  });

  // 4. UNTRANSLATED_SEGMENTS
  it("flags untranslated Japanese segments", () => {
    const warnings = validateTranslation({
      sourceText: "こんにちは。世界。",
      translatedText: "안녕. これはまだ日本語ですよ。",
      chunkCount: null,
      confirmedTerms: [],
    });
    expect(warnings.some((w) => w.code === "UNTRANSLATED_SEGMENTS")).toBe(true);
  });

  it("does not flag pure Korean translation", () => {
    const warnings = validateTranslation({
      sourceText: "こんにちは。",
      translatedText: "안녕하세요. 오늘은 날씨가 좋네요. 점심 식사 하셨나요? 배고파요.",
      chunkCount: null,
      confirmedTerms: [],
    });
    expect(warnings.some((w) => w.code === "UNTRANSLATED_SEGMENTS")).toBe(false);
  });

  // 5. PARAGRAPH_COUNT_MISMATCH
  it("flags paragraph count mismatch", () => {
    const warnings = validateTranslation({
      sourceText: "A\n\nB\n\nC\n\nD",
      translatedText: "A\n\nB",
      chunkCount: null,
    });
    expect(warnings.some((w) => w.code === "PARAGRAPH_COUNT_MISMATCH")).toBe(true);
  });

  it("does not flag matching paragraph counts", () => {
    const warnings = validateTranslation({
      sourceText: "A\n\nB\n\nC",
      translatedText: "가\n\n나\n\n다",
      chunkCount: null,
    });
    expect(warnings.some((w) => w.code === "PARAGRAPH_COUNT_MISMATCH")).toBe(false);
  });

  // 6. POSSIBLE_TRUNCATION
  it("flags possible truncation without sentence ending", () => {
    const longPara = "이것은 긴 문장인데 마지막에 마침표 없이 끝나는 중간이에";
    const warnings = validateTranslation({
      sourceText: "こんにちは。世界。".repeat(10),
      translatedText: longPara.repeat(5),
      chunkCount: null,
    });
    expect(warnings.some((w) => w.code === "POSSIBLE_TRUNCATION")).toBe(true);
  });

  it("does not flag Korean text ending with sentence punctuation", () => {
    const warnings = validateTranslation({
      sourceText: "こんにちは。世界。".repeat(10),
      translatedText: "이 문장은 마침표로 끝납니다. 한국어를 했습니다. 완료했습니다.",
      chunkCount: null,
    });
    expect(warnings.some((w) => w.code === "POSSIBLE_TRUNCATION")).toBe(false);
  });

  it("does not flag dialogue tail closing with 」 + (계속)", () => {
    // Real production sample (ep 232): episode ends with
    // dialogue lines and a "(계속)" footer. The earlier heuristic
    // false-flagged this as truncation.
    const warnings = validateTranslation({
      sourceText: "「やはり人間はダメ?」".repeat(20),
      translatedText:
        "「역시 인간은 안 돼?」\n「……그렇지도 않지만……」\n「얼굴, 취향이야?」\n「……뭐, 그럭저럭……」\n「……쿠우」\n\n(계속)",
      chunkCount: null,
    });
    expect(warnings.some((w) => w.code === "POSSIBLE_TRUNCATION")).toBe(false);
  });

  it("does not flag dialogue ending with closing 」 quote", () => {
    const warnings = validateTranslation({
      sourceText: "test".repeat(40),
      translatedText: "그가 웃으며 말했다。「뭐, 어쩌다 보니까」".repeat(5),
      chunkCount: null,
    });
    expect(warnings.some((w) => w.code === "POSSIBLE_TRUNCATION")).toBe(false);
  });

  // 7. GLOSSARY_MISMATCH
  it("flags glossary terms missing from translation", () => {
    const warnings = validateTranslation({
      sourceText: "田中さんが魔法を使った。",
      translatedText: "타나카 씨가 기술을 사용했다.",
      chunkCount: null,
      confirmedTerms: [
        { termJa: "田中", termKo: "타나카" },
        { termJa: "魔法", termKo: "마법" },
      ],
    });
    expect(warnings.some((w) => w.code === "GLOSSARY_MISMATCH")).toBe(true);
  });

  it("does not flag when glossary terms are present", () => {
    const warnings = validateTranslation({
      sourceText: "田中さんが魔法を使った。",
      translatedText: "타나카 씨가 마법을 사용했다.",
      chunkCount: null,
      confirmedTerms: [
        { termJa: "田中", termKo: "타나카" },
        { termJa: "魔法", termKo: "마법" },
      ],
    });
    expect(warnings.some((w) => w.code === "GLOSSARY_MISMATCH")).toBe(false);
  });

  it("skips glossary terms not present in source", () => {
    const warnings = validateTranslation({
      sourceText: "田中さんが歩いた。",
      translatedText: "타나카 씨가 걸었다.",
      chunkCount: null,
      confirmedTerms: [{ termJa: "魔法", termKo: "마법" }],
    });
    expect(warnings.some((w) => w.code === "GLOSSARY_MISMATCH")).toBe(false);
  });

  // 8. CHUNK_DUPLICATE_LINES
  it("flags duplicate lines across chunk boundaries", () => {
    const warnings = validateTranslation({
      sourceText: "a".repeat(200),
      translatedText: "hello world long line here\nhello world long line here\nother text",
      chunkCount: 2,
    });
    expect(warnings.some((w) => w.code === "CHUNK_DUPLICATE_LINES")).toBe(true);
  });

  it("does not flag non-duplicate lines", () => {
    const warnings = validateTranslation({
      sourceText: "a".repeat(200),
      translatedText: "first line is here\nsecond line is here\nthird is different",
      chunkCount: 2,
    });
    expect(warnings.some((w) => w.code === "CHUNK_DUPLICATE_LINES")).toBe(false);
  });

  it("skips short lines in chunk duplicate check", () => {
    const warnings = validateTranslation({
      sourceText: "a".repeat(200),
      translatedText: "hi\nhi\nother long enough line of text here",
      chunkCount: 2,
    });
    expect(warnings.some((w) => w.code === "CHUNK_DUPLICATE_LINES")).toBe(false);
  });

  // Edge: empty source text produces SUSPICIOUSLY_LONG (ratio = Infinity)
  it("flags empty source text as suspiciously long", () => {
    const warnings = validateTranslation({
      sourceText: "",
      translatedText: "무언가",
      chunkCount: null,
    });
    expect(warnings.some((w) => w.code === "SUSPICIOUSLY_LONG")).toBe(true);
  });
});
