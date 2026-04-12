DO $$ BEGIN
  CREATE TYPE "session_status" AS ENUM ('active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "translation_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "novel_id" uuid NOT NULL,
  "status" "session_status" DEFAULT 'active' NOT NULL,
  "model_name" text NOT NULL,
  "glossary_version" integer NOT NULL DEFAULT 1,
  "prompt_fingerprint" text,
  "context_summary" text,
  "last_episode_number" integer,
  "episode_count" integer DEFAULT 0 NOT NULL,
  "total_cost_usd" real DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "translation_sessions" ADD CONSTRAINT "translation_sessions_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "translations" ADD CONSTRAINT "translations_session_id_translation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "translation_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
