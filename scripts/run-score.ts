import { prisma } from "../lib/db/prisma";
import { scoreJobs } from "./score-jobs";

scoreJobs()
  .catch((error) => { console.error("Scoring failed:", error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
