import { prisma } from "../lib/db/prisma";
import { scrapeJobs } from "../workers/scrape-jobs";

scrapeJobs()
  .catch((error) => { console.error("Fatal worker error:", error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
