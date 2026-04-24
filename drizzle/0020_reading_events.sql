-- V5.4: reading_events event log for weekly/monthly stats and streaks.
-- reading_progress only has one row per (user, novel) so it cannot drive
-- time-series aggregations. This table records one row per episode open.
CREATE TABLE "reading_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "novel_id" uuid NOT NULL,
    "episode_id" uuid NOT NULL,
    "event_kind" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "reading_events"
    ADD CONSTRAINT "reading_events_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "reading_events"
    ADD CONSTRAINT "reading_events_novel_id_novels_id_fk"
    FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE CASCADE;

ALTER TABLE "reading_events"
    ADD CONSTRAINT "reading_events_episode_id_episodes_id_fk"
    FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE;

CREATE INDEX "reading_events_user_created_idx"
    ON "reading_events" ("user_id", "created_at");

CREATE INDEX "reading_events_user_episode_created_idx"
    ON "reading_events" ("user_id", "episode_id", "created_at");
