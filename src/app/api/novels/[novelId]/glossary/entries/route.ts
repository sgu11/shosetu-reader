import { NextRequest, NextResponse } from "next/server";
import { listGlossaryEntries, createGlossaryEntry } from "@/modules/translation/application/glossary-entries";
import { isValidUuid } from "@/lib/validation";

interface RouteContext {
  params: Promise<{ novelId: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { novelId } = await context.params;
    if (!isValidUuid(novelId)) {
      return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
    }
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const entries = await listGlossaryEntries(novelId, status);
    return NextResponse.json({ entries });
  } catch (err) {
    console.error("Failed to list glossary entries:", err);
    return NextResponse.json({ error: "Failed to list glossary entries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { novelId } = await context.params;
    if (!isValidUuid(novelId)) {
      return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
    }
    const body = await req.json();
    if (!body.termJa || !body.termKo || !body.category) {
      return NextResponse.json({ error: "termJa, termKo, and category are required" }, { status: 400 });
    }
    const validCategories = ["character", "place", "term", "skill", "honorific"];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    const entry = await createGlossaryEntry(novelId, {
      termJa: body.termJa,
      termKo: body.termKo,
      reading: body.reading ?? undefined,
      category: body.category,
      notes: body.notes ?? undefined,
      sourceEpisodeNumber: body.sourceEpisodeNumber ?? undefined,
      status: body.status ?? undefined,
    });
    if (!entry) {
      return NextResponse.json({ error: "Entry already exists" }, { status: 409 });
    }
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    console.error("Failed to create glossary entry:", err);
    return NextResponse.json({ error: "Failed to create glossary entry" }, { status: 500 });
  }
}
