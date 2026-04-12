-- Make subscriptions universal (shared across all profiles).
-- Profiles are only for settings, continue reading, and recent reading info.

-- Deduplicate — keep the earliest active subscription per novel,
-- or the earliest overall if none are active.
DELETE FROM "subscriptions" s1
  USING "subscriptions" s2
  WHERE s1.novel_id = s2.novel_id
    AND s1.id <> s2.id
    AND (
      (s2.is_active AND NOT s1.is_active)
      OR (s1.is_active = s2.is_active AND s1.subscribed_at > s2.subscribed_at)
      OR (s1.is_active = s2.is_active AND s1.subscribed_at = s2.subscribed_at AND s1.id > s2.id)
    );
--> statement-breakpoint
DROP INDEX IF EXISTS "subscriptions_user_novel_idx";
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "user_id";
--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_novel_idx" ON "subscriptions" ("novel_id");
