import {
  boolean,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { contentLanguageEnum } from "./enums";
import { episodes } from "./episodes";
import { novels } from "./novels";
import { users } from "./users";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    subscribedAt: timestamp("subscribed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("subscriptions_novel_idx").on(table.novelId),
  ],
);

export const readingProgress = pgTable(
  "reading_progress",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    currentEpisodeId: uuid("current_episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "set null" }),
    currentLanguage: contentLanguageEnum("current_language")
      .notNull()
      .default("ja"),
    scrollAnchor: text("scroll_anchor"),
    progressPercent: real("progress_percent"),
    lastReadAt: timestamp("last_read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reading_progress_user_novel_idx").on(
      table.userId,
      table.novelId,
    ),
  ],
);
