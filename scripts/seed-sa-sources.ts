import { prisma } from "../lib/db/prisma";
import { SA_VERIFIED_SOURCES } from "../jobs/sa-source-intelligence";

async function main() {
  console.log("🇿🇦 Seeding curated South African employer sources...");

  for (const source of SA_VERIFIED_SOURCES) {
    const company = {
      name: source.name,
      slug: source.slug,
      websiteUrl: source.websiteUrl,
      careerUrl: source.careerUrl,
      scraperType: source.scraperType,
      atsIdentifier: source.atsIdentifier ?? null,
      enabled: true,
      priority: source.priority,
    };

    await prisma.company.upsert({
      where: { slug: company.slug },
      update: company,
      create: company,
    });

    console.log(`✓ ${source.name} — ${source.tier}`);
  }

  console.log(`Seeded ${SA_VERIFIED_SOURCES.length} SA sources.`);
}

main()
  .catch((error) => {
    console.error("SA source seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
