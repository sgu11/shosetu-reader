import { describe, expect, it, vi } from "vitest";

// Ensure DATABASE_URL is available so env.ts doesn't throw during module load
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/test";

describe("env demo flags", () => {
  it("parses DEMO_MODE as boolean and defaults to false", async () => {
    vi.resetModules();
    const prev = process.env.DEMO_MODE;
    process.env.DEMO_MODE = "1";
    const mod = await import("@/lib/env");
    expect(mod.env.DEMO_MODE).toBe(true);
    process.env.DEMO_MODE = prev;
  });

  it("exposes DEMO_FIXTURES_PATH default", async () => {
    vi.resetModules();
    delete process.env.DEMO_MODE;
    const mod = await import("@/lib/env");
    expect(mod.env.DEMO_FIXTURES_PATH).toBe("demo/seed/fixtures");
  });
});
