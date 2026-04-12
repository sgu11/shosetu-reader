-- Align DB column defaults with Drizzle schema definitions.
-- These drifted as the schema evolved via drizzle-kit push in dev
-- without corresponding migration files.

ALTER TABLE "users" ALTER COLUMN "preferred_ui_locale" SET DEFAULT 'ko';
--> statement-breakpoint
ALTER TABLE "reader_preferences" ALTER COLUMN "content_width" SET DEFAULT '800';
--> statement-breakpoint
ALTER TABLE "reader_preferences" ALTER COLUMN "font_family" SET DEFAULT 'nanum-myeongjo';
--> statement-breakpoint
ALTER TABLE "reader_preferences" ALTER COLUMN "font_weight" SET DEFAULT 'bold';
