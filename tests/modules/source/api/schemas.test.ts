import { describe, expect, it } from "vitest";
import { registerNovelInputSchema } from "@/modules/source/api/schemas";

describe("registerNovelInputSchema", () => {
  it("accepts a bare ncode and transforms it to syosetu", () => {
    const result = registerNovelInputSchema.safeParse({ input: "n1234ab" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ site: "syosetu", id: "n1234ab" });
    }
  });

  it("accepts a Syosetu URL and extracts site + id", () => {
    const result = registerNovelInputSchema.safeParse({
      input: "https://ncode.syosetu.com/n9876zz/",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ site: "syosetu", id: "n9876zz" });
    }
  });

  it("rejects empty input", () => {
    const result = registerNovelInputSchema.safeParse({ input: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid input with a helpful message", () => {
    const result = registerNovelInputSchema.safeParse({
      input: "not-a-valid-code",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes("supported"))).toBe(true);
    }
  });

  it("rejects an unrecognized URL", () => {
    const result = registerNovelInputSchema.safeParse({
      input: "https://example.com/n1234ab/",
    });
    expect(result.success).toBe(false);
  });
});
