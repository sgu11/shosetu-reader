import { describe, expect, it } from "vitest";
import { getAdapter, listEnabledSites, parseInput } from "@/modules/source/infra/registry";

describe("source registry", () => {
  it("returns the syosetu adapter for site=syosetu", () => {
    const adapter = getAdapter("syosetu");
    expect(adapter.site).toBe("syosetu");
    expect(adapter.isAdult).toBe(false);
  });

  it("returns the nocturne adapter for site=nocturne", () => {
    const adapter = getAdapter("nocturne");
    expect(adapter.site).toBe("nocturne");
    expect(adapter.isAdult).toBe(true);
  });

  it("returns the kakuyomu adapter for site=kakuyomu", () => {
    const adapter = getAdapter("kakuyomu");
    expect(adapter.site).toBe("kakuyomu");
    expect(adapter.isAdult).toBe(false);
  });

  it("throws for sites that are not yet registered", () => {
    expect(() => getAdapter("alphapolis")).toThrow(/not implemented/i);
  });

  it("lists only enabled sites", () => {
    expect(listEnabledSites()).toEqual(["syosetu", "nocturne", "kakuyomu"]);
  });
});

describe("parseInput", () => {
  it("recognizes a syosetu URL", () => {
    expect(parseInput("https://ncode.syosetu.com/n1234ab/")).toEqual({
      site: "syosetu",
      id: "n1234ab",
    });
  });

  it("recognizes a nocturne URL", () => {
    expect(parseInput("https://novel18.syosetu.com/n5555aa/")).toEqual({
      site: "nocturne",
      id: "n5555aa",
    });
  });

  it("recognizes a bare ncode as syosetu (nocturne requires URL form)", () => {
    expect(parseInput("n1234ab")).toEqual({ site: "syosetu", id: "n1234ab" });
  });

  it("returns null for unrecognized input", () => {
    expect(parseInput("not a code")).toBeNull();
    expect(parseInput("https://example.com/n1234ab/")).toBeNull();
    expect(parseInput("")).toBeNull();
  });
});
