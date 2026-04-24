import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().optional().default(""),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_DEFAULT_MODEL: z.string().optional().default("deepseek/deepseek-v4-flash"),
  OPENROUTER_SUMMARY_MODEL: z.string().optional(),
  OPENROUTER_EXTRACTION_MODEL: z.string().optional(),
  OPENROUTER_TITLE_MODEL: z.string().optional(),
  GLOSSARY_MAX_PROMPT_ENTRIES: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(200),
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
  OPENROUTER_SUMMARY_MODEL: process.env.OPENROUTER_SUMMARY_MODEL,
  OPENROUTER_EXTRACTION_MODEL: process.env.OPENROUTER_EXTRACTION_MODEL,
  OPENROUTER_TITLE_MODEL: process.env.OPENROUTER_TITLE_MODEL,
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

export type ModelWorkload = "summary" | "extraction" | "title" | "default";

/**
 * Resolve the OpenRouter model for a specific workload.
 * Falls back to OPENROUTER_DEFAULT_MODEL if no workload-specific override is set.
 */
export function resolveModel(workload: ModelWorkload = "default"): string {
  switch (workload) {
    case "summary":
      return env.OPENROUTER_SUMMARY_MODEL || env.OPENROUTER_DEFAULT_MODEL;
    case "extraction":
      return env.OPENROUTER_EXTRACTION_MODEL || env.OPENROUTER_DEFAULT_MODEL;
    case "title":
      return env.OPENROUTER_TITLE_MODEL || env.OPENROUTER_DEFAULT_MODEL;
    default:
      return env.OPENROUTER_DEFAULT_MODEL;
  }
}

export function getPublicRuntimeConfig() {
  return {
    nodeEnv: env.NODE_ENV,
    appUrl: env.APP_URL,
  };
}
