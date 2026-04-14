import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isValidUuid } from "@/lib/validation";
import { getLatestNovelJob } from "@/modules/jobs/application/job-runs";

interface Ctx {
  params: Promise<{ novelId: string }>;
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { novelId } = await ctx.params;
    if (!isValidUuid(novelId)) {
      return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
    }

    const job = await getLatestNovelJob(novelId);

    if (!job) {
      return NextResponse.json({ job: null });
    }

    return NextResponse.json({
      job: {
        id: job.id,
        jobType: job.jobType,
        status: job.status,
      },
    });
  } catch (err) {
    logger.error("Failed to fetch current novel job", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return NextResponse.json({ error: "Failed to fetch current novel job" }, { status: 500 });
  }
}
