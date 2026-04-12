import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uiLocaleEnum, contentLanguageEnum, themeEnum } from "./enums";

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  displayName: text("display_name"),
  preferredUiLocale: uiLocaleEnum("preferred_ui_locale").notNull().default("en"),
  preferredReaderLanguage: contentLanguageEnum("preferred_reader_language")
    .notNull()
    .default("ja"),
  theme: themeEnum().notNull().default("system"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const readerPreferences = pgTable("reader_preferences", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  fontSize: text("font_size").notNull().default("medium"),
  lineHeight: text("line_height").notNull().default("1.8"),
  contentWidth: text("content_width").notNull().default("680"),
  fontFamily: text("font_family").notNull().default("noto-serif-jp"),
  fontWeight: text("font_weight").notNull().default("normal"),
  themeOverride: themeEnum("theme_override"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
