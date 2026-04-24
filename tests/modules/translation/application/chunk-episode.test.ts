import { describe, it, expect } from "vitest";
import {
  shouldChunk,
  splitIntoChunks,
  reassembleChunks,
} from "@/modules/translation/application/chunk-episode";

describe("shouldChunk", () => {
  it("returns false for text under threshold", () => {
    expect(shouldChunk("short text")).toBe(false);
  });

  it("returns true for text over threshold", () => {
    const long = "あ".repeat(13_000);
    expect(shouldChunk(long)).toBe(true);
  });
});

describe("splitIntoChunks", () => {
  it("returns single-element array when no chunking needed", () => {
    const chunks = splitIntoChunks("短いテキストです。");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].total).toBe(1);
    expect(chunks[0].text).toBe("短いテキストです。");
  });

  it("splits on double-newline boundaries", () => {
    const paras = Array.from({ length: 20 }, (_, i) => `パラグラフ${i + 1}`.repeat(500));
    const text = paras.join("\n\n");
    const chunks = splitIntoChunks(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(15_000);
    }
  });

  it("overlapSourceTail is set on chunks after the first", () => {
    const paras = Array.from({ length: 20 }, (_, i) => `パラグラフ${i + 1}`.repeat(500));
    const text = paras.join("\n\n");
    const chunks = splitIntoChunks(text);
    expect(chunks[0].overlapSourceTail).toBeUndefined();
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].overlapSourceTail).toBeDefined();
      expect(chunks[i].overlapSourceTail!.length).toBeLessThanOrEqual(500);
    }
  });

  it("index and total are correct", () => {
    const paras = Array.from({ length: 20 }, (_, i) => `パラグラフ${i + 1}`.repeat(500));
    const text = paras.join("\n\n");
    const chunks = splitIntoChunks(text);
    const total = chunks.length;
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
      expect(chunks[i].total).toBe(total);
    }
  });

  it("falls back to single newlines for single-paragraph text", () => {
    // Text with \n newlines but no \n\n — should fall back to \n splitting
    const lines = Array.from({ length: 30 }, (_, i) => `ライン${i + 1}のテキストがここにあります。`.repeat(100));
    const text = lines.join("\n");
    expect(text.includes("\n\n")).toBe(false);
    const chunks = splitIntoChunks(text);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("reassembleChunks", () => {
  it("joins chunks with double newline", () => {
    const result = reassembleChunks(["A", "B", "C"]);
    expect(result).toBe("A\n\nB\n\nC");
  });

  it("returns single chunk as-is", () => {
    const result = reassembleChunks(["only one"]);
    expect(result).toBe("only one");
  });

  it("returns empty string for empty array", () => {
    const result = reassembleChunks([]);
    expect(result).toBe("");
  });
});
