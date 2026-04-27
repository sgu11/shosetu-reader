/**
 * Read the active profile's adult-content preference. Returns null when
 * there is no active profile (anonymous), which the filter helper treats
 * as SFW-only.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { readerPreferences } from "@/lib/db/schema/users";
import type { AdultFilterContext } from "./adult-filter";

export async function resolveAdultContext(
  userId: string | null,
): Promise<AdultFilterContext | null> {
  if (!userId) return null;
  const db = getDb();
  const [row] = await db
    .select({ adultContentEnabled: readerPreferences.adultContentEnabled })
    .from(readerPreferences)
    .where(eq(readerPreferences.userId, userId))
    .limit(1);
  // Missing row → use the column default (true) for an authenticated profile.
  return { adultContentEnabled: row?.adultContentEnabled ?? true };
}
