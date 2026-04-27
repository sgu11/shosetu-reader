import { NextRequest } from "next/server";
import { isValidUuid } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildEpub,
  type ExportLang,
} from "@/modules/export/application/build-epub";

const RATE_LIMIT = { limit: 3, windowSeconds: 60 };
const ALLOWED_LANG: ExportLang[] = ["ko", "ja", "both"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ novelId: string }> },
) {
  const limited = await rateLimit(req, RATE_LIMIT, "epub-export");
  if (limited) return limited;

  const { novelId } = await params;
  if (!isValidUuid(novelId)) {
    return new Response("Invalid novel ID", { status: 400 });
  }

  const search = req.nextUrl.searchParams;
  const langRaw = search.get("lang") ?? "ko";
  if (!(ALLOWED_LANG as string[]).includes(langRaw)) {
    return new Response("Invalid lang", { status: 400 });
  }
  const lang = langRaw as ExportLang;
  const modelName = search.get("model") ?? undefined;
  if ((lang === "ko" || lang === "both") && !modelName) {
    return new Response("model is required when lang=ko|both", {
      status: 400,
    });
  }
  const fromRaw = search.get("from");
  const toRaw = search.get("to");
  const from = fromRaw ? Number(fromRaw) : undefined;
  const to = toRaw ? Number(toRaw) : undefined;
  if (from !== undefined && !Number.isFinite(from)) {
    return new Response("Invalid from", { status: 400 });
  }
  if (to !== undefined && !Number.isFinite(to)) {
    return new Response("Invalid to", { status: 400 });
  }

  try {
    const { stream, filename } = await buildEpub({
      novelId,
      lang,
      modelName,
      from,
      to,
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return new Response(message, { status: 500 });
  }
}
