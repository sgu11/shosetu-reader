export const jobKinds = [
  "catalog.ingest-all",
  "catalog.metadata-refresh",
  "catalog.translate-titles",
  "glossary.generate",
  "glossary.extract",
  "glossary.refresh",
  "translation.bulk-translate-all",
  "translation.episode",
  "translation.session-advance",
  "translation.session-summary",
] as const;

export type JobKind = (typeof jobKinds)[number];
