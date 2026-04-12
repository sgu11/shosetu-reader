ALTER TABLE "reader_preferences" ADD COLUMN "font_family" text DEFAULT 'noto-serif-jp' NOT NULL;--> statement-breakpoint
ALTER TABLE "reader_preferences" ADD COLUMN "font_weight" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "novels" ADD COLUMN "title_ko" text;--> statement-breakpoint
ALTER TABLE "novels" ADD COLUMN "summary_ko" text;