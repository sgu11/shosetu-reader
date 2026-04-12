import { NextRequest, NextResponse } from "next/server";
import { importGlossaryEntries } from "@/modules/translation/application/glossary-entries";
import { isValidUuid } from "@/lib/validation";

interface RouteContext {
  params: Promise<{ novelId: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { novelId } = await context.params;
    if (!isValidUuid(novelId)) {
      return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
    }
    const body = await req.json();
    if (!Array.isArray(body.entries)) {
      return NextResponse.json({ error: "entries array is required" }, { status: 400 });
    }
    if (body.entries.length > 500) {
      return NextResponse.json({ error: "Max 500 entries per import" }, { status: 400 });
    }
    const result = await importGlossaryEntries(novelId, body.entries);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to import glossary entries:", err);
    return NextResponse.json({ error: "Failed to import glossary entries" }, { status: 500 });
  }
}
