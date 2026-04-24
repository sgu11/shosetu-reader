import { NextRequest, NextResponse } from "next/server";
import { signInInputSchema } from "@/modules/identity/api/schemas";
import { signInWithEmail } from "@/modules/identity/application/session-auth";
import { rateLimit } from "@/lib/rate-limit";

const SIGN_IN_RATE_LIMIT = { limit: 5, windowSeconds: 60 };

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, SIGN_IN_RATE_LIMIT, "auth-sign-in");
  if (limited) return limited;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = signInInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const session = await signInWithEmail(parsed.data);
  return NextResponse.json(session, { status: 201 });
}
