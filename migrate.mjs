/**
 * Lightweight migration runner — reads drizzle journal and applies
 * pending SQL files directly via postgres. No drizzle-kit/esbuild needed.
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set, skipping migrations.");
  process.exit(0);
}

const DRIZZLE_DIR = path.resolve("drizzle");
const JOURNAL_PATH = path.join(DRIZZLE_DIR, "meta", "_journal.json");
const MIGRATIONS_TABLE = "__drizzle_migrations";

const sql = postgres(DATABASE_URL, { max: 1, connect_timeout: 10 });

try {
  // Ensure migrations tracking table exists
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql(MIGRATIONS_TABLE)} (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT
    )
  `;

  // Realign SERIAL sequence with max(id). Prior runs that inserted explicit ids
  // (drizzle-orm/migrator) leave the sequence behind, causing PK collisions here.
  await sql.unsafe(`
    SELECT setval(
      pg_get_serial_sequence('${MIGRATIONS_TABLE}', 'id'),
      COALESCE((SELECT MAX(id) FROM ${MIGRATIONS_TABLE}), 0) + 1,
      false
    )
  `);

  // Read journal
  const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf-8"));
  const entries = journal.entries;

  // Get already-applied migrations
  const applied = await sql`SELECT hash FROM ${sql(MIGRATIONS_TABLE)}`;
  const appliedSet = new Set(applied.map((r) => r.hash));

  let count = 0;
  for (const entry of entries) {
    if (appliedSet.has(entry.tag)) continue;

    const sqlFile = path.join(DRIZZLE_DIR, `${entry.tag}.sql`);
    const content = fs.readFileSync(sqlFile, "utf-8");

    // Split on drizzle statement breakpoints
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`  Applying migration: ${entry.tag} (${statements.length} statements)`);

    await sql.begin(async (tx) => {
      for (const stmt of statements) {
        await tx.unsafe(stmt);
      }
      await tx`INSERT INTO ${tx(MIGRATIONS_TABLE)} (hash, created_at) VALUES (${entry.tag}, ${entry.when})`;
    });

    count++;
  }

  if (count === 0) {
    console.log("  No pending migrations.");
  } else {
    console.log(`  Applied ${count} migration(s).`);
  }
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await sql.end();
}
