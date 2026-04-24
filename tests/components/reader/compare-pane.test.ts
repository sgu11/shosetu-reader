import { describe, expect, it } from "vitest";
import { buildRows, splitNonBlank } from "@/components/reader/compare-pane";

describe("splitNonBlank", () => {
  it("drops empty and whitespace-only lines", () => {
    expect(splitNonBlank("a\n\nb\n  \nc")).toEqual(["a", "b", "c"]);
  });
  it("returns [] for null/empty", () => {
    expect(splitNonBlank(null)).toEqual([]);
    expect(splitNonBlank("")).toEqual([]);
  });
});

describe("buildRows", () => {
  it("aligns translations by non-blank source paragraph", () => {
    const src = ["first", "", "second", "third"];
    const primary = ["번역1", "번역2", "번역3"];
    const compare = ["trans1", "trans2", "trans3"];
    const { rows, mismatch } = buildRows(src, primary, compare);
    expect(mismatch).toBe(false);
    expect(rows).toEqual([
      { kind: "content", src: "first", primary: "번역1", compare: "trans1" },
      { kind: "blank", src: "" },
      { kind: "content", src: "second", primary: "번역2", compare: "trans2" },
      { kind: "content", src: "third", primary: "번역3", compare: "trans3" },
    ]);
  });

  it("does not shift when one translation drops a line", () => {
    // src has 3 non-blank paragraphs; primary has 3, compare only 2 — the
    // second/third primary still pair with a blank and src[2] respectively,
    // and compare pads with "" rather than stealing primary's next line.
    const src = ["a", "b", "c"];
    const primary = ["p1", "p2", "p3"];
    const compare = ["c1", "c2"];
    const { rows, mismatch } = buildRows(src, primary, compare);
    expect(mismatch).toBe(true);
    expect(rows).toEqual([
      { kind: "content", src: "a", primary: "p1", compare: "c1" },
      { kind: "content", src: "b", primary: "p2", compare: "c2" },
      { kind: "content", src: "c", primary: "p3", compare: "" },
    ]);
  });

  it("appends leftover translation lines past source length", () => {
    const src = ["a"];
    const primary = ["p1", "p2"];
    const compare = ["c1", "c2", "c3"];
    const { rows, mismatch } = buildRows(src, primary, compare);
    expect(mismatch).toBe(true);
    expect(rows).toEqual([
      { kind: "content", src: "a", primary: "p1", compare: "c1" },
      { kind: "content", src: "", primary: "p2", compare: "c2" },
      { kind: "content", src: "", primary: "", compare: "c3" },
    ]);
  });

  it("blank source rows do not consume translation lines", () => {
    const src = ["a", "", "", "b"];
    const primary = ["p1", "p2"];
    const compare = ["c1", "c2"];
    const { rows, mismatch } = buildRows(src, primary, compare);
    expect(mismatch).toBe(false);
    expect(rows.filter((r) => r.kind === "content")).toEqual([
      { kind: "content", src: "a", primary: "p1", compare: "c1" },
      { kind: "content", src: "b", primary: "p2", compare: "c2" },
    ]);
  });
});
