import { NextRequest, NextResponse } from "next/server";
import { getReaderPayload } from "@/modules/reader/application/get-reader-payload";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> },
) {
  const { episodeId } = await params;

  const payload = await getReaderPayload(episodeId);
  if (!payload) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
