CREATE INDEX IF NOT EXISTS "episodes_novel_number_idx"
  ON "episodes" ("novel_id", "episode_number");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "episodes_novel_fetch_number_idx"
  ON "episodes" ("novel_id", "fetch_status", "episode_number");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "translations_episode_language_created_idx"
  ON "translations" ("episode_id", "target_language", "created_at" DESC);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "translations_status_completed_idx"
  ON "translations" ("status", "completed_at" DESC);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "translations_active_status_idx"
  ON "translations" ("episode_id", "status")
  WHERE "status" IN ('queued', 'processing');

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "translation_sessions_novel_status_idx"
  ON "translation_sessions" ("novel_id", "status");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "novel_glossary_entries_status_importance_idx"
  ON "novel_glossary_entries" ("novel_id", "status", "importance" DESC);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_runs_status_created_idx"
  ON "job_runs" ("status", "created_at" DESC);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_runs_entity_created_idx"
  ON "job_runs" ("entity_type", "entity_id", "created_at" DESC);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_runs_status_updated_idx"
  ON "job_runs" ("status", "updated_at" ASC);
