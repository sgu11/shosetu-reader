import { describe, it, expect } from "vitest";
import { validateTermsAgainstCorpus } from "@/modules/translation/application/validate-terms";

describe("validateTermsAgainstCorpus", () => {
  it("accepts terms present in both source and translation", () => {
    const res = validateTermsAgainstCorpus(
      [{ termJa: "魔法", termKo: "마법" }],
      {
        sourceTexts: ["彼は魔法を使った。"],
        translatedTexts: ["그는 마법을 사용했다."],
      },
    );
    expect(res.accepted).toHaveLength(1);
    expect(res.rejected).toHaveLength(0);
  });

  it("rejects when term_ja is missing from source", () => {
    const res = validateTermsAgainstCorpus(
      [{ termJa: "幻想", termKo: "마법" }],
      {
        sourceTexts: ["彼は魔法を使った。"],
        translatedTexts: ["그는 마법을 사용했다."],
      },
    );
    expect(res.accepted).toHaveLength(0);
    expect(res.rejected).toHaveLength(1);
    expect(res.rejected[0].reason).toBe("missing-source");
  });

  it("rejects when term_ko is missing from translation", () => {
    const res = validateTermsAgainstCorpus(
      [{ termJa: "魔法", termKo: "환상" }],
      {
        sourceTexts: ["彼は魔法を使った。"],
        translatedTexts: ["그는 마법을 사용했다."],
      },
    );
    expect(res.accepted).toHaveLength(0);
    expect(res.rejected).toHaveLength(1);
    expect(res.rejected[0].reason).toBe("missing-translation");
  });

  it("normalizes whitespace and case on Korean matching", () => {
    const res = validateTermsAgainstCorpus(
      [{ termJa: "魔法", termKo: " 마 법 " }],
      {
        sourceTexts: ["魔法"],
        translatedTexts: ["마법"],
      },
    );
    expect(res.accepted).toHaveLength(1);
  });

  it("handles empty term fields", () => {
    const res = validateTermsAgainstCorpus(
      [{ termJa: "", termKo: "마법" }],
      { sourceTexts: ["魔法"], translatedTexts: ["마법"] },
    );
    expect(res.accepted).toHaveLength(0);
    expect(res.rejected).toHaveLength(1);
  });

  it("concatenates multiple source and translation texts", () => {
    const res = validateTermsAgainstCorpus(
      [{ termJa: "勇者", termKo: "용사" }],
      {
        sourceTexts: ["町の話。", "勇者が現れた。"],
        translatedTexts: ["마을 이야기.", "용사가 나타났다."],
      },
    );
    expect(res.accepted).toHaveLength(1);
  });
});
