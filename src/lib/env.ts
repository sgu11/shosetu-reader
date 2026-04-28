import { z } from "zod";

const reasoningEffortSchema = z
  .enum(["off", "low", "high", "xhigh"])
  .optional();

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().optional().default(""),

  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_DEFAULT_MODEL: z.string().optional().default("deepseek/deepseek-v4-flash"),

  // Per-workload model overrides — fall back to OPENROUTER_DEFAULT_MODEL.
  OPENROUTER_TRANSLATE_MODEL: z.string().optional(),
  OPENROUTER_SUMMARY_MODEL: z.string().optional(),
  OPENROUTER_EXTRACTION_MODEL: z.string().optional(),
  OPENROUTER_TITLE_MODEL: z.string().optional(),
  OPENROUTER_COMPARE_MODEL: z.string().optional(),
  OPENROUTER_BOOTSTRAP_MODEL: z.string().optional(),

  // Per-workload reasoning effort overrides — fall back to WORKLOAD_PROFILE
  // defaults below. Accept off|low|high|xhigh.
  OPENROUTER_REASONING_TRANSLATE: reasoningEffortSchema,
  OPENROUTER_REASONING_SUMMARY: reasoningEffortSchema,
  OPENROUTER_REASONING_EXTRACTION: reasoningEffortSchema,
  OPENROUTER_REASONING_TITLE: reasoningEffortSchema,
  OPENROUTER_REASONING_COMPARE: reasoningEffortSchema,
  OPENROUTER_REASONING_BOOTSTRAP: reasoningEffortSchema,

  // Per-workload max-tokens overrides — same fallback pattern.
  OPENROUTER_MAX_TOKENS_TRANSLATE: z.coerce.number().int().positive().optional(),
  OPENROUTER_MAX_TOKENS_SUMMARY: z.coerce.number().int().positive().optional(),
  OPENROUTER_MAX_TOKENS_EXTRACTION: z.coerce.number().int().positive().optional(),
  OPENROUTER_MAX_TOKENS_TITLE: z.coerce.number().int().positive().optional(),
  OPENROUTER_MAX_TOKENS_COMPARE: z.coerce.number().int().positive().optional(),
  OPENROUTER_MAX_TOKENS_BOOTSTRAP: z.coerce.number().int().positive().optional(),

  // Provider routing override. Comma-separated list, e.g. "DeepSeek".
  // Empty string disables the auto-pin for deepseek/* models.
  OPENROUTER_PROVIDER_PIN: z.string().optional(),

  GLOSSARY_MAX_PROMPT_ENTRIES: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(500),
  ADMIN_API_KEY: z.string().optional(),
  TRANSLATION_COST_BUDGET_USD: z.coerce.number().positive().optional(),
  DEMO_MODE: z
    .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false"), z.literal("")])
    .optional()
    .transform((v) => v === "1" || v === "true"),
  DEMO_FIXTURES_PATH: z
    .string()
    .optional()
    .default("demo/seed/fixtures"),
});

export type Env = z.infer<typeof serverEnvSchema>;

const parsedEnv = serverEnvSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  APP_URL: process.env.APP_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,

  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_DEFAULT_MODEL: process.env.OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_TRANSLATE_MODEL: process.env.OPENROUTER_TRANSLATE_MODEL,
  OPENROUTER_SUMMARY_MODEL: process.env.OPENROUTER_SUMMARY_MODEL,
  OPENROUTER_EXTRACTION_MODEL: process.env.OPENROUTER_EXTRACTION_MODEL,
  OPENROUTER_TITLE_MODEL: process.env.OPENROUTER_TITLE_MODEL,
  OPENROUTER_COMPARE_MODEL: process.env.OPENROUTER_COMPARE_MODEL,
  OPENROUTER_BOOTSTRAP_MODEL: process.env.OPENROUTER_BOOTSTRAP_MODEL,

  OPENROUTER_REASONING_TRANSLATE: process.env.OPENROUTER_REASONING_TRANSLATE,
  OPENROUTER_REASONING_SUMMARY: process.env.OPENROUTER_REASONING_SUMMARY,
  OPENROUTER_REASONING_EXTRACTION: process.env.OPENROUTER_REASONING_EXTRACTION,
  OPENROUTER_REASONING_TITLE: process.env.OPENROUTER_REASONING_TITLE,
  OPENROUTER_REASONING_COMPARE: process.env.OPENROUTER_REASONING_COMPARE,
  OPENROUTER_REASONING_BOOTSTRAP: process.env.OPENROUTER_REASONING_BOOTSTRAP,

  OPENROUTER_MAX_TOKENS_TRANSLATE: process.env.OPENROUTER_MAX_TOKENS_TRANSLATE,
  OPENROUTER_MAX_TOKENS_SUMMARY: process.env.OPENROUTER_MAX_TOKENS_SUMMARY,
  OPENROUTER_MAX_TOKENS_EXTRACTION: process.env.OPENROUTER_MAX_TOKENS_EXTRACTION,
  OPENROUTER_MAX_TOKENS_TITLE: process.env.OPENROUTER_MAX_TOKENS_TITLE,
  OPENROUTER_MAX_TOKENS_COMPARE: process.env.OPENROUTER_MAX_TOKENS_COMPARE,
  OPENROUTER_MAX_TOKENS_BOOTSTRAP: process.env.OPENROUTER_MAX_TOKENS_BOOTSTRAP,

  OPENROUTER_PROVIDER_PIN: process.env.OPENROUTER_PROVIDER_PIN,

  GLOSSARY_MAX_PROMPT_ENTRIES: process.env.GLOSSARY_MAX_PROMPT_ENTRIES,
  ADMIN_API_KEY: process.env.ADMIN_API_KEY,
  TRANSLATION_COST_BUDGET_USD: process.env.TRANSLATION_COST_BUDGET_USD,
  DEMO_MODE: process.env.DEMO_MODE,
  DEMO_FIXTURES_PATH: process.env.DEMO_FIXTURES_PATH,
});

if (!parsedEnv.success) {
  console.error(
    "Invalid environment configuration",
    parsedEnv.error.flatten().fieldErrors,
  );
  throw new Error("Environment validation failed");
}

export const env = parsedEnv.data;

export type ModelWorkload =
  | "summary"
  | "extraction"
  | "title"
  | "translate"
  | "compare"
  | "bootstrap"
  | "default";

export type ReasoningEffort = "off" | "low" | "high" | "xhigh";

export interface WorkloadProfile {
  modelName: string;
  reasoning: ReasoningEffort;
  maxTokens: number;
}

type WorkloadKey = Exclude<ModelWorkload, "default">;

/**
 * Per-workload defaults applied when no env override is set.
 *
 * Output cost dominates routine translation. Body translation runs with
 * reasoning OFF so the model emits target text only. Glossary, bootstrap,
 * and comparison workloads are quality-sensitive single-shots — reasoning
 * HIGH pays for itself.
 */
const WORKLOAD_DEFAULTS: Record<
  WorkloadKey,
  { reasoning: ReasoningEffort; maxTokens: number }
> = {
  translate:  { reasoning: "off",  maxTokens: 4096 },
  title:      { reasoning: "off",  maxTokens: 1024 },
  summary:    { reasoning: "off",  maxTokens: 2048 },
  extraction: { reasoning: "low",  maxTokens: 4096 },
  compare:    { reasoning: "high", maxTokens: 8192 },
  bootstrap:  { reasoning: "high", maxTokens: 8192 },
};

const ENV_MODEL_KEY: Record<WorkloadKey, keyof Env> = {
  translate:  "OPENROUTER_TRANSLATE_MODEL",
  summary:    "OPENROUTER_SUMMARY_MODEL",
  extraction: "OPENROUTER_EXTRACTION_MODEL",
  title:      "OPENROUTER_TITLE_MODEL",
  compare:    "OPENROUTER_COMPARE_MODEL",
  bootstrap:  "OPENROUTER_BOOTSTRAP_MODEL",
};

const ENV_REASONING_KEY: Record<WorkloadKey, keyof Env> = {
  translate:  "OPENROUTER_REASONING_TRANSLATE",
  summary:    "OPENROUTER_REASONING_SUMMARY",
  extraction: "OPENROUTER_REASONING_EXTRACTION",
  title:      "OPENROUTER_REASONING_TITLE",
  compare:    "OPENROUTER_REASONING_COMPARE",
  bootstrap:  "OPENROUTER_REASONING_BOOTSTRAP",
};

const ENV_MAX_TOKENS_KEY: Record<WorkloadKey, keyof Env> = {
  translate:  "OPENROUTER_MAX_TOKENS_TRANSLATE",
  summary:    "OPENROUTER_MAX_TOKENS_SUMMARY",
  extraction: "OPENROUTER_MAX_TOKENS_EXTRACTION",
  title:      "OPENROUTER_MAX_TOKENS_TITLE",
  compare:    "OPENROUTER_MAX_TOKENS_COMPARE",
  bootstrap:  "OPENROUTER_MAX_TOKENS_BOOTSTRAP",
};

function workloadKey(workload: ModelWorkload): WorkloadKey {
  return workload === "default" ? "translate" : workload;
}

/**
 * Resolve the OpenRouter model for a specific workload.
 * Falls back to OPENROUTER_DEFAULT_MODEL when the workload-specific override
 * is absent.
 */
export function resolveModel(workload: ModelWorkload = "default"): string {
  const key = workloadKey(workload);
  const override = env[ENV_MODEL_KEY[key]] as string | undefined;
  return override || env.OPENROUTER_DEFAULT_MODEL;
}

export function resolveWorkloadProfile(workload: ModelWorkload): WorkloadProfile {
  const key = workloadKey(workload);
  const defaults = WORKLOAD_DEFAULTS[key];
  const reasoningOverride = env[ENV_REASONING_KEY[key]] as
    | ReasoningEffort
    | undefined;
  const maxTokensOverride = env[ENV_MAX_TOKENS_KEY[key]] as number | undefined;
  return {
    modelName: resolveModel(workload),
    reasoning: reasoningOverride ?? defaults.reasoning,
    maxTokens: maxTokensOverride ?? defaults.maxTokens,
  };
}

/**
 * Provider routing hint for OpenRouter requests. By default deepseek/*
 * requests pin to provider:{ only:["DeepSeek"] } so OpenRouter doesn't route
 * to a fallback host outside DeepSeek's KV-cache domain (≈50× cheaper hits).
 *
 * OPENROUTER_PROVIDER_PIN — comma-separated provider list — overrides this.
 * Set to an empty string to disable auto-pinning.
 */
export function providerHintFor(modelName: string): { only: string[] } | undefined {
  const override = env.OPENROUTER_PROVIDER_PIN;
  if (override !== undefined) {
    const list = override
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return list.length > 0 ? { only: list } : undefined;
  }
  if (modelName.startsWith("deepseek/")) {
    return { only: ["DeepSeek"] };
  }
  return undefined;
}

/**
 * Translate a workload profile + model name into the OpenRouter body
 * fragment (reasoning + provider) for chat-completions.
 */
export function buildOpenRouterRoutingBody(
  workload: ModelWorkload,
  modelName: string,
): Record<string, unknown> {
  const profile = resolveWorkloadProfile(workload);
  const body: Record<string, unknown> = {};
  const provider = providerHintFor(modelName);
  if (provider) body.provider = provider;
  if (profile.reasoning !== "off") {
    body.reasoning = { effort: profile.reasoning };
  } else if (modelName.startsWith("deepseek/")) {
    // Explicitly disable thinking on DeepSeek so V4 doesn't burn output
    // tokens on chain-of-thought during routine body translation.
    body.reasoning = { exclude: true };
  }
  return body;
}

export function getPublicRuntimeConfig() {
  return {
    nodeEnv: env.NODE_ENV,
    appUrl: env.APP_URL,
  };
}
