import { pgEnum } from "drizzle-orm/pg-core";

// --- Source ---

export const sourceSiteEnum = pgEnum("source_site", ["syosetu"]);

// --- Content fetch lifecycle ---

export const fetchStatusEnum = pgEnum("fetch_status", [
  "pending",
  "fetching",
  "fetched",
  "failed",
]);

// --- Translation lifecycle ---

export const translationStatusEnum = pgEnum("translation_status", [
  "queued",
  "processing",
  "available",
  "failed",
]);

// --- User preferences ---

export const uiLocaleEnum = pgEnum("ui_locale", ["en", "ko"]);

export const contentLanguageEnum = pgEnum("content_language", ["ja", "ko"]);

export const themeEnum = pgEnum("theme", ["light", "dark", "system"]);

// --- Job tracking ---

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

// --- Translation sessions ---

export const sessionStatusEnum = pgEnum("session_status", [
  "active",
  "completed",
  "cancelled",
]);

// --- Glossary ---

export const glossaryEntryStatusEnum = pgEnum("glossary_entry_status", [
  "confirmed",
  "suggested",
  "rejected",
]);

export const glossaryEntryCategoryEnum = pgEnum("glossary_entry_category", [
  "character",
  "place",
  "term",
  "skill",
  "honorific",
]);
