import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { subscriptions, novels } from "@/lib/db/schema";

export async function subscribeToNovel(
  novelId: string,
): Promise<{ subscriptionId: string; isNew: boolean }> {
  const db = getDb();

  // Verify novel exists
  const [novel] = await db
    .select({ id: novels.id })
    .from(novels)
    .where(eq(novels.id, novelId))
    .limit(1);

  if (!novel) {
    throw new Error("Novel not found");
  }

  // Check for existing subscription (universal — not per-user)
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.novelId, novelId))
    .limit(1);

  if (existing) {
    // Reactivate if inactive
    if (!existing.isActive) {
      await db
        .update(subscriptions)
        .set({ isActive: true })
        .where(eq(subscriptions.id, existing.id));
    }
    return { subscriptionId: existing.id, isNew: false };
  }

  const [row] = await db
    .insert(subscriptions)
    .values({ novelId })
    .returning({ id: subscriptions.id });

  return { subscriptionId: row.id, isNew: true };
}

export async function unsubscribeFromNovel(novelId: string): Promise<boolean> {
  const db = getDb();

  const result = await db
    .update(subscriptions)
    .set({ isActive: false })
    .where(
      and(
        eq(subscriptions.novelId, novelId),
        eq(subscriptions.isActive, true),
      ),
    )
    .returning({ id: subscriptions.id });

  return result.length > 0;
}

export async function isSubscribed(novelId: string): Promise<boolean> {
  const db = getDb();

  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.novelId, novelId),
        eq(subscriptions.isActive, true),
      ),
    )
    .limit(1);

  return !!row;
}
