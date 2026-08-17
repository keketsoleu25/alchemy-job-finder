import { prisma } from "../lib/db/prisma";
import { persistJobs } from "../jobs/repository";
import { scraperRegistry } from "../scrapers/registry";

async function main() {
  const company = await prisma.company.upsert({
    where: {
      slug: "figma",
    },

    update: {
      name: "Figma",
      careerUrl: "https://www.figma.com/careers/",
      scraperType: "GREENHOUSE",
      atsIdentifier: "figma",
      enabled: true,
    },

    create: {
      name: "Figma",
      slug: "figma",
      careerUrl: "https://www.figma.com/careers/",
      websiteUrl: "https://www.figma.com",
      scraperType: "GREENHOUSE",
      atsIdentifier: "figma",
      enabled: true,
    },
  });

  console.log(`Scraping ${company.name}...`);

  const scraper =
    scraperRegistry.get("GREENHOUSE");

  const jobs = await scraper.fetch({
    id: company.id,
    name: company.name,
    careerUrl: company.careerUrl,
    atsIdentifier: company.atsIdentifier,
  });

  console.log(`Fetched ${jobs.length} jobs`);
  console.log("Persisting jobs...");

  const result =
    await persistJobs(company.id, jobs);

  await prisma.company.update({
    where: {
      id: company.id,
    },

    data: {
      lastScrapedAt: new Date(),
      lastSuccessfulScrapeAt: new Date(),
      lastError: null,
    },
  });

  console.log("");
  console.log("Persistence result");
  console.log("------------------");
  console.log(`Created: ${result.created}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Total:   ${result.total}`);
}

main()
  .catch((error) => {
    console.error("Persistence test failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });