import { prisma } from "../lib/db/prisma";
import { scoreJob } from "../jobs/score";

const BATCH_SIZE = 25;

async function main() {
  const profile = await prisma.candidateProfile.findFirst({ orderBy: { createdAt: "asc" } });
  if (!profile) {
    throw new Error("No CandidateProfile found. Run `npm run seed:profile` first.");
  }

  const jobs = await prisma.job.findMany({
    where: { status: { not: "CLOSED" } },
    orderBy: { lastSeenAt: "desc" },
  });

  console.log(`Scoring ${jobs.length} jobs against ${profile.name}...`);

  for (let index = 0; index < jobs.length; index += BATCH_SIZE) {
    const batch = jobs.slice(index, index + BATCH_SIZE);

    await Promise.all(
      batch.map(async (job) => {
        const result = scoreJob(
          {
            title: job.title,
            description: job.description,
            location: job.location,
            remote: job.remote,
            source: job.source,
          },
          profile
        );

        await prisma.job.update({
          where: { id: job.id },
          data: {
            matchScore: result.score,
            matchedSkills: result.matchedSkills,
            missingSkills: result.missingSkills,
            requiredExperienceMin: result.requiredExperienceMin ?? null,
            requiredExperienceMax: result.requiredExperienceMax ?? null,
            matchData: result.data,
          },
        });
      })
    );

    console.log(`Scored ${Math.min(index + batch.length, jobs.length)}/${jobs.length}`);
  }

  const top = await prisma.job.findMany({
    where: { status: { not: "CLOSED" }, matchScore: { not: null } },
    include: { company: { select: { name: true } } },
    orderBy: [{ matchScore: "desc" }, { firstSeenAt: "desc" }],
    take: 10,
  });

  console.log("\nTop matches");
  console.log("-----------");
  for (const job of top) {
    console.log(`${String(job.matchScore ?? 0).padStart(3)}%  ${job.title} — ${job.company.name}`);
  }
}

main()
  .catch((error) => {
    console.error("Scoring failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
