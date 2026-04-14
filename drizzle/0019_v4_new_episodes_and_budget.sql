-- V4: Add last_checked_episode_count to subscriptions for new-episode detection
ALTER TABLE "subscriptions" ADD COLUMN "last_checked_episode_count" integer;

-- V4: Add cost_budget_usd to translation_sessions for cost budgeting
ALTER TABLE "translation_sessions" ADD COLUMN "cost_budget_usd" real;

-- V4: Add paused_budget status to session_status enum
ALTER TYPE "session_status" ADD VALUE IF NOT EXISTS 'paused_budget';
