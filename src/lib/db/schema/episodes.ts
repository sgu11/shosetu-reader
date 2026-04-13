import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { fetchStatusEnum } from "./enums";
import { novels } from "./novels";

export const episodes = pgTable(
  "episodes",
  {
    id: uuid().primaryKey().defaultRandom(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    sourceEpisodeId: text("source_episode_id").notNull(),
    episodeNumber: integer("episode_number").notNull(),
    titleJa: text("title_ja"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAtSource: timestamp("updated_at_source", { withTimezone: true }),
    sourceUrl: text("source_url").notNull(),
    rawHtmlChecksum: text("raw_html_checksum"),
    rawTextJa: text("raw_text_ja"),
    normalizedTextJa: text("normalized_text_ja"),
    prefaceJa: text("preface_ja"),
    afterwordJa: text("afterword_ja"),
    fetchStatus: fetchStatusEnum("fetch_status").notNull().default("pending"),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("episodes_novel_source_idx").on(
      table.novelId,
      table.sourceEpisodeId,
    ),
  ],
);
