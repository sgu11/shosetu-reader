-- Separate preface (前書き) and afterword (後書き) from episode body text.
-- These are author notes that should not contaminate translation context.

ALTER TABLE episodes ADD COLUMN preface_ja TEXT;
ALTER TABLE episodes ADD COLUMN afterword_ja TEXT;

ALTER TABLE translations ADD COLUMN translated_preface TEXT;
ALTER TABLE translations ADD COLUMN translated_afterword TEXT;
