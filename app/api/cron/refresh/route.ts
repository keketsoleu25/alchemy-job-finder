import { prisma } from "../../../../lib/db/prisma";
import { scoreJobs } from "../../../../scripts/score-jobs";
import { scrapeJobs } from "../../../../workers/scrape-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    await scrapeJobs();
    await scoreJobs();
    return Response.json({ ok: true, completedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Scheduled refresh failed:", error);
    return Response.json({ ok: false, error: "Refresh failed; check function logs." }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
