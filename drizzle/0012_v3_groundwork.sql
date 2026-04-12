ALTER TABLE "novel_glossaries"
ADD COLUMN IF NOT EXISTS "glossary_version" integer DEFAULT 1 NOT NULL;

--> statement-breakpoint
ALTER TABLE "translations"
ADD COLUMN IF NOT EXISTS "prompt_fingerprint" text;

--> statement-breakpoint
ALTER TABLE "translations"
ADD COLUMN IF NOT EXISTS "quality_warnings" jsonb;

--> statement-breakpoint
ALTER TABLE "translations"
ADD COLUMN IF NOT EXISTS "session_id" uuid;

--> statement-breakpoint
ALTER TABLE "translations"
ADD COLUMN IF NOT EXISTS "context_summary_used" text;

--> statement-breakpoint
ALTER TABLE "translations"
ADD COLUMN IF NOT EXISTS "chunk_count" integer;

--> statement-breakpoint
ALTER TABLE "translations"
ADD COLUMN IF NOT EXISTS "is_canonical" boolean DEFAULT false NOT NULL;
