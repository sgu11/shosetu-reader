import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { listWarnings, type Severity } from "@/modules/translation/application/quality-warnings-aggregation";

const ALLOWED_SEVERITY: Severity[] = ["info", "warning", "error"];

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const novelId = params.get("novelId") ?? undefined;
    const code = params.get("code") ?? undefined;
    const severityRaw = params.get("severity");
    const severity = (severityRaw && (ALLOWED_SEVERITY as string[]).includes(severityRaw))
      ? (severityRaw as Severity)
      : undefined;
    if (severityRaw && !severity) {
      return NextResponse.json({ error: "invalid severity" }, { status: 400 });
    }
    const limit = Math.min(Math.max(Number(params.get("limit") ?? 50), 1), 200);
    const offset = Math.max(Number(params.get("offset") ?? 0), 0);

    const result = await listWarnings({ novelId, code, severity, limit, offset });
    return NextResponse.json(result);
  } catch (err) {
    logger.error("quality list failed", {
      err: err instanceof Error ? err.message : String(err),
      route: "GET /api/translations/quality/list",
    });
    return NextResponse.json({ error: "Failed to list warnings" }, { status: 500 });
  }
}
