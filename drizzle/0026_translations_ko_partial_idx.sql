-- migrate:no-transaction
-- Partial index optimized for the DISTINCT ON (episode_id) ... ORDER BY
-- episode_id, created_at DESC query used by getEpisodesByNovelId and
-- getNovelLiveStatus (both filter target_language = 'ko'). The existing
-- composite index includes target_language as a column, so PG can use
-- it but pays per-row filter cost. A partial index lets PG pick latest
-- per episode with index-only scans for the common Korean-translation
-- access pattern.
CREATE INDEX CONCURRENTLY IF NOT EXISTS translations_episode_created_ko_idx
  ON translations (episode_id, created_at DESC)
  WHERE target_language = 'ko';
