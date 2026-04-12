-- V3.6 hardening: importance ratings, session ordering, creator tracking

--> statement-breakpoint
ALTER TABLE "novel_glossary_entries"
ADD COLUMN IF NOT EXISTS "importance" integer DEFAULT 3 NOT NULL;

--> statement-breakpoint
ALTER TABLE "translation_sessions"
ADD COLUMN IF NOT EXISTS "creator_user_id" uuid;

--> statement-breakpoint
ALTER TABLE "translation_sessions"
ADD COLUMN IF NOT EXISTS "expected_next_index" integer DEFAULT 0 NOT NULL;

--> statement-breakpoint
ALTER TABLE "translation_sessions"
ADD COLUMN IF NOT EXISTS "global_prompt" text DEFAULT '' NOT NULL;
