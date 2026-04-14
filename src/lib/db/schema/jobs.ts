import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { jobStatusEnum } from "./enums";

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobType: text("job_type").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    status: jobStatusEnum().notNull().default("queued"),
    attemptCount: integer("attempt_count").notNull().default(0),
    payloadJson: jsonb("payload_json"),
    resultJson: jsonb("result_json"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_runs_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    index("job_runs_entity_created_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
    index("job_runs_status_updated_idx").on(
      table.status,
      table.updatedAt,
    ),
  ],
);
