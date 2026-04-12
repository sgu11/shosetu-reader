import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  contentLanguageEnum,
  glossaryEntryCategoryEnum,
  glossaryEntryStatusEnum,
  sessionStatusEnum,
  translationStatusEnum,
} from "./enums";
import { episodes } from "./episodes";
import { users } from "./users";
import { novels } from "./novels";

// NOTE: novel_translation_prompts table was dropped in migration 0009.
// Per-novel translation guidance is now handled by novel_glossaries.

export const translations = pgTable(
  "translations",
  {
    id: uuid().primaryKey().defaultRandom(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    targetLanguage: contentLanguageEnum("target_language").notNull(),
    provider: text("provider").notNull(),
    modelName: text("model_name").notNull(),
    promptVersion: text("prompt_version").notNull(),
    sourceChecksum: text("source_checksum").notNull(),
    status: translationStatusEnum().notNull().default("queued"),
    translatedText: text("translated_text"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    estimatedCostUsd: real("estimated_cost_usd"),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    promptFingerprint: text("prompt_fingerprint"),
    qualityWarnings: jsonb("quality_warnings"),
    sessionId: uuid("session_id"),
    contextSummaryUsed: text("context_summary_used"),
    chunkCount: integer("chunk_count"),
    isCanonical: boolean("is_canonical").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("translations_identity_idx").on(
      table.episodeId,
      table.targetLanguage,
      table.provider,
      table.modelName,
      table.promptVersion,
      table.sourceChecksum,
    ),
  ],
);

export const translationSettings = pgTable("translation_settings", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  modelName: text("model_name").notNull().default("google/gemini-2.5-flash-lite"),
  globalPrompt: text("global_prompt").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const translationSessions = pgTable("translation_sessions", {
  id: uuid().primaryKey().defaultRandom(),
  novelId: uuid("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  status: sessionStatusEnum().notNull().default("active"),
  modelName: text("model_name").notNull(),
  glossaryVersion: integer("glossary_version").notNull().default(1),
  promptFingerprint: text("prompt_fingerprint"),
  contextSummary: text("context_summary"),
  lastEpisodeNumber: integer("last_episode_number"),
  episodeCount: integer("episode_count").notNull().default(0),
  totalCostUsd: real("total_cost_usd").notNull().default(0),
  creatorUserId: uuid("creator_user_id"),
  expectedNextIndex: integer("expected_next_index").notNull().default(0),
  globalPrompt: text("global_prompt").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const novelGlossaries = pgTable("novel_glossaries", {
  id: uuid().primaryKey().defaultRandom(),
  novelId: uuid("novel_id")
    .notNull()
    .unique()
    .references(() => novels.id, { onDelete: "cascade" }),
  glossary: text("glossary").notNull().default(""),
  glossaryVersion: integer("glossary_version").notNull().default(1),
  modelName: text("model_name"),
  episodeCount: integer("episode_count"),
  estimatedCostUsd: real("estimated_cost_usd"),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const novelGlossaryEntries = pgTable(
  "novel_glossary_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    termJa: text("term_ja").notNull(),
    termKo: text("term_ko").notNull(),
    reading: text("reading"),
    category: glossaryEntryCategoryEnum().notNull(),
    notes: text("notes"),
    sourceEpisodeNumber: integer("source_episode_number"),
    status: glossaryEntryStatusEnum().notNull().default("suggested"),
    importance: integer("importance").notNull().default(3),
    confidence: real("confidence"),
    provenanceTranslationId: uuid("provenance_translation_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("novel_glossary_entries_unique_idx").on(
      table.novelId,
      table.termJa,
      table.category,
    ),
  ],
);
