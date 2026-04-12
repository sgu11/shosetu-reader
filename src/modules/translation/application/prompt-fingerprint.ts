import { createHash } from "crypto";

/**
 * Compute a deterministic fingerprint of all prompt-affecting inputs.
 * Used to distinguish translation artifacts produced under different
 * glossary/prompt/context configurations, even if the 6-column identity
 * index otherwise matches.
 */
export function computePromptFingerprint(inputs: {
  provider: string;
  modelName: string;
  promptVersion: string;
  globalPrompt: string;
  styleGuide: string;
  glossaryVersion: number;
  sessionMode: boolean;
}): string {
  const payload = [
    inputs.provider,
    inputs.modelName,
    inputs.promptVersion,
    inputs.globalPrompt,
    inputs.styleGuide,
    String(inputs.glossaryVersion),
    inputs.sessionMode ? "session" : "standalone",
  ].join("\0");

  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
