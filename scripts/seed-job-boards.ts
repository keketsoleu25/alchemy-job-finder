import { prisma } from "../lib/db/prisma";
import { SA_JOB_BOARDS } from "../jobs/sa-job-boards";

async function main() {
  console.log("Seeding South African discovery job boards...");

  for (const source of SA_JOB_BOARDS) {
    await prisma.company.upsert({
      where: { slug: source.slug },
      update: {
        name: source.name,
        websiteUrl: source.websiteUrl,
        careerUrl: source.careerUrl,
        scraperType: "CUSTOM",
        atsIdentifier: null,
        enabled: true,
        priority: source.priority,
      },
      create: {
        name: source.name,
        slug: source.slug,
        websiteUrl: source.websiteUrl,
        careerUrl: source.careerUrl,
        scraperType: "CUSTOM",
        atsIdentifier: null,
        enabled: true,
        priority: source.priority,
      },
    });
    console.log(`✓ ${source.name}`);
  }

  console.log(`Seeded ${SA_JOB_BOARDS.length} discovery boards.`);
}

main()
  .catch((error) => {
    console.error("Job board seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
