import { NextResponse } from "next/server";
import { getLibrary } from "@/modules/library/application/get-library";

export async function GET() {
  try {
    const library = await getLibrary();
    return NextResponse.json(library);
  } catch (err) {
    console.error("Failed to fetch library:", err);
    return NextResponse.json({ error: "Failed to fetch library" }, { status: 500 });
  }
}
