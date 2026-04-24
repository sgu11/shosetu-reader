import { describe, it, expect } from "vitest";
import { computePromptFingerprint } from "@/modules/translation/application/prompt-fingerprint";

const baseInput = {
  provider: "openrouter",
  modelName: "deepseek/deepseek-v4-flash",
  promptVersion: "v3",
  globalPrompt: "Be accurate",
  styleGuide: "Use casual tone",
  glossaryVersion: 3,
  sessionMode: true,
};

describe("computePromptFingerprint", () => {
  it("returns a 16-character hex string", () => {
    const fp = computePromptFingerprint(baseInput);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it("returns the same hash for identical input", () => {
    const a = computePromptFingerprint(baseInput);
    const b = computePromptFingerprint(baseInput);
    expect(a).toBe(b);
  });

  it("changes hash when globalPrompt changes", () => {
    const a = computePromptFingerprint(baseInput);
    const b = computePromptFingerprint({
      ...baseInput,
      globalPrompt: "Be creative",
    });
    expect(a).not.toBe(b);
  });

  it("changes hash when modelName changes", () => {
    const a = computePromptFingerprint(baseInput);
    const b = computePromptFingerprint({
      ...baseInput,
      modelName: "anthropic/claude-sonnet-4",
    });
    expect(a).not.toBe(b);
  });

  it("changes hash when promptVersion changes", () => {
    const a = computePromptFingerprint(baseInput);
    const b = computePromptFingerprint({ ...baseInput, promptVersion: "v4" });
    expect(a).not.toBe(b);
  });

  it("changes hash when styleGuide changes", () => {
    const a = computePromptFingerprint(baseInput);
    const b = computePromptFingerprint({
      ...baseInput,
      styleGuide: "Use formal honorifics",
    });
    expect(a).not.toBe(b);
  });

  it("changes hash when glossaryVersion changes", () => {
    const a = computePromptFingerprint(baseInput);
    const b = computePromptFingerprint({
      ...baseInput,
      glossaryVersion: 5,
    });
    expect(a).not.toBe(b);
  });

  it("changes hash when sessionMode changes", () => {
    const a = computePromptFingerprint({ ...baseInput, sessionMode: true });
    const b = computePromptFingerprint({ ...baseInput, sessionMode: false });
    expect(a).not.toBe(b);
  });
});
