import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { userSessions, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { UserContext } from "../domain/user-context";
import {
  createSessionExpiry,
  createSessionToken,
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "../infra/session-cookie";
import { migrateGuestStateToProfile } from "./guest-profile-migration";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function fallbackDisplayName(email: string): string {
  return normalizeEmail(email).split("@")[0] || "Reader";
}

export async function resolveAuthenticatedUserContext(): Promise<UserContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const db = getDb();
  const tokenHash = hashSessionToken(token);
  const now = new Date();

  const [row] = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      preferredUiLocale: users.preferredUiLocale,
      preferredReaderLanguage: users.preferredReaderLanguage,
      theme: users.theme,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(
      and(
        eq(userSessions.sessionTokenHash, tokenHash),
        gt(userSessions.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    userId: row.userId,
    authStrategy: "session",
    isAuthenticated: true,
    email: row.email,
    displayName: row.displayName,
    preferredUiLocale: row.preferredUiLocale,
    preferredReaderLanguage: row.preferredReaderLanguage,
    theme: row.theme,
  };
}

export async function signInWithEmail(input: {
  email: string;
  displayName?: string;
}) {
  const db = getDb();
  const normalizedEmail = normalizeEmail(input.email);
  const displayName = input.displayName?.trim() || fallbackDisplayName(normalizedEmail);

  const inserted = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      displayName,
    })
    .onConflictDoNothing({ target: users.email })
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
    });

  let user: { id: string; email: string; displayName: string | null };
  const createdNewUser = inserted.length > 0;
  if (createdNewUser) {
    user = inserted[0];
  } else {
    const [existing] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    if (!existing) {
      throw new Error("Unexpected: upsert conflict but no row found");
    }
    user = existing;

    if (!existing.displayName && displayName) {
      await db
        .update(users)
        .set({ displayName, updatedAt: new Date() })
        .where(eq(users.id, existing.id));
      user.displayName = displayName;
    }
  }

  await migrateGuestStateToProfile(user.id, createdNewUser);

  const sessionToken = createSessionToken();
  const tokenHash = hashSessionToken(sessionToken);
  const expiresAt = createSessionExpiry();

  await db.insert(userSessions).values({
    userId: user.id,
    sessionTokenHash: tokenHash,
    expiresAt,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });

  logger.info("User session created", {
    userId: user.id,
    authStrategy: "session",
  });

  return {
    isAuthenticated: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
  };
}

export async function signOutCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const db = getDb();
    const tokenHash = hashSessionToken(token);

    await db
      .delete(userSessions)
      .where(eq(userSessions.sessionTokenHash, tokenHash));
  }

  store.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
}
