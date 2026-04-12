import { NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * Returns a safe error JSON response.
 * In production, internal error details are suppressed.
 * In development, the full error message is included.
 */
export function apiError(
  err: unknown,
  fallbackMessage: string,
  status = 500,
): NextResponse {
  const message = err instanceof Error ? err.message : String(err);

  if (env.NODE_ENV === "production" && status >= 500) {
    // Log the real error server-side but don't expose it to the client
    console.error(`[API Error] ${fallbackMessage}:`, message);
    return NextResponse.json({ error: fallbackMessage }, { status });
  }

  return NextResponse.json({ error: message }, { status });
}
