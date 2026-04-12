DO $$ BEGIN
  CREATE TYPE "glossary_entry_status" AS ENUM ('confirmed', 'suggested', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "glossary_entry_category" AS ENUM ('character', 'place', 'term', 'skill', 'honorific');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "novel_glossary_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "novel_id" uuid NOT NULL,
  "term_ja" text NOT NULL,
  "term_ko" text NOT NULL,
  "reading" text,
  "category" "glossary_entry_category" NOT NULL,
  "notes" text,
  "source_episode_number" integer,
  "status" "glossary_entry_status" DEFAULT 'suggested' NOT NULL,
  "confidence" real,
  "provenance_translation_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "novel_glossary_entries_unique_idx" ON "novel_glossary_entries" ("novel_id", "term_ja", "category");

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "novel_glossary_entries" ADD CONSTRAINT "novel_glossary_entries_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
