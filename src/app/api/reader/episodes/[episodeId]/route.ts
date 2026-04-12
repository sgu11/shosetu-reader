import { NextRequest, NextResponse } from "next/server";
import { getReaderPayload } from "@/modules/reader/application/get-reader-payload";
import { isValidUuid } from "@/lib/validation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> },
) {
  const { episodeId } = await params;
  if (!isValidUuid(episodeId)) {
    return NextResponse.json({ error: "Invalid episode ID" }, { status: 400 });
  }

  const payload = await getReaderPayload(episodeId);
  if (!payload) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
