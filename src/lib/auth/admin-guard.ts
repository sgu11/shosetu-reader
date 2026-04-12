import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * Validates that the request carries a valid admin API key.
 * Returns null if authorized, or a 401/403 NextResponse if not.
 *
 * The key must be sent as:
 *   Authorization: Bearer <ADMIN_API_KEY>
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const adminKey = env.ADMIN_API_KEY;

  if (!adminKey) {
    // If no admin key is configured, block all admin access in production
    if (env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Admin access is not configured" },
        { status: 403 },
      );
    }
    // In development, allow access without key
    return null;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 },
    );
  }

  const token = authHeader.slice(7);

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(token, adminKey)) {
    return NextResponse.json(
      { error: "Invalid admin API key" },
      { status: 403 },
    );
  }

  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
