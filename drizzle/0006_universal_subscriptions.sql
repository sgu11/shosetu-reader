-- Make subscriptions universal (shared across all profiles).
-- Profiles are only for settings, continue reading, and recent reading info.

-- Step 1: Deduplicate — keep the earliest active subscription per novel,
-- or the earliest overall if none are active.
DELETE FROM "subscriptions" s1
  USING "subscriptions" s2
  WHERE s1.novel_id = s2.novel_id
    AND s1.id <> s2.id
    AND (
      -- s1 is less preferred than s2: s2 is active and s1 is not, or s2 was subscribed earlier
      (s2.is_active AND NOT s1.is_active)
      OR (s1.is_active = s2.is_active AND s1.subscribed_at > s2.subscribed_at)
      OR (s1.is_active = s2.is_active AND s1.subscribed_at = s2.subscribed_at AND s1.id > s2.id)
    );

-- Step 2: Drop the old per-user unique index
DROP INDEX IF EXISTS "subscriptions_user_novel_idx";

-- Step 3: Drop the user_id column
ALTER TABLE "subscriptions" DROP COLUMN "user_id";

-- Step 4: Add new unique index on novel_id only
CREATE UNIQUE INDEX "subscriptions_novel_idx" ON "subscriptions" ("novel_id");
