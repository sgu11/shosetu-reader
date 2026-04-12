import { NextRequest, NextResponse } from "next/server";
import { updateGlossaryEntry, deleteGlossaryEntry } from "@/modules/translation/application/glossary-entries";
import { isValidUuid } from "@/lib/validation";

interface RouteContext {
  params: Promise<{ novelId: string; entryId: string }>;
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { novelId, entryId } = await context.params;
    if (!isValidUuid(novelId) || !isValidUuid(entryId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }
    const body = await req.json();
    const entry = await updateGlossaryEntry(entryId, novelId, body);
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    return NextResponse.json({ entry });
  } catch (err) {
    console.error("Failed to update glossary entry:", err);
    return NextResponse.json({ error: "Failed to update glossary entry" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { novelId, entryId } = await context.params;
    if (!isValidUuid(novelId) || !isValidUuid(entryId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }
    const deleted = await deleteGlossaryEntry(entryId, novelId);
    if (!deleted) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete glossary entry:", err);
    return NextResponse.json({ error: "Failed to delete glossary entry" }, { status: 500 });
  }
}
