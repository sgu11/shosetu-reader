export const jobKinds = [
  "catalog.ingest-all",
  "catalog.metadata-refresh",
  "glossary.extract",
  "translation.bulk-translate-all",
  "translation.episode",
  "translation.session-advance",
  "translation.session-summary",
] as const;

export type JobKind = (typeof jobKinds)[number];
