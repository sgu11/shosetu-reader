import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export async function GET() {
  // In production, return minimal info — don't leak environment or internal URLs
  if (env.NODE_ENV === "production") {
    return NextResponse.json({
      ok: true,
      service: "shosetu-reader",
    });
  }

  return NextResponse.json({
    ok: true,
    service: "shosetu-reader",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
