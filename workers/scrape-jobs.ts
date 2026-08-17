import { prisma } from "../lib/db/prisma";
import { persistJobs } from "../jobs/repository";
import { scraperRegistry } from "../scrapers/registry";

type CompanyRunResult = {
  company: string;
  success: boolean;
  found: number;
  created: number;
  updated: number;
  error?: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function scrapeCompany(
  company: {
    id: string;
    name: string;
    careerUrl: string;
    scraperType:
      | "GREENHOUSE"
      | "LEVER"
      | "CHEERIO"
      | "PLAYWRIGHT"
      | "CUSTOM";
    atsIdentifier: string | null;
  }
): Promise<CompanyRunResult> {
  console.log("");
  console.log(`▶ ${company.name}`);
  console.log(`  Scraper: ${company.scraperType}`);

  const startedAt = Date.now();

  try {
    const scraper =
      scraperRegistry.get(company.scraperType);

    const jobs = await scraper.fetch({
      id: company.id,
      name: company.name,
      careerUrl: company.careerUrl,
      atsIdentifier: company.atsIdentifier,
    });

    console.log(`  Found: ${jobs.length}`);

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

    const duration =
      ((Date.now() - startedAt) / 1000).toFixed(1);

    console.log(
      `  ✓ Created ${result.created}, updated ${result.updated} (${duration}s)`
    );

    return {
      company: company.name,
      success: true,
      found: jobs.length,
      created: result.created,
      updated: result.updated,
    };
  } catch (error) {
    const message =
      getErrorMessage(error);

    await prisma.company.update({
      where: {
        id: company.id,
      },

      data: {
        lastScrapedAt: new Date(),
        lastError: message.slice(0, 2000),
      },
    });

    console.error(
      `  ✗ ${company.name} failed: ${message}`
    );

    return {
      company: company.name,
      success: false,
      found: 0,
      created: 0,
      updated: 0,
      error: message,
    };
  }
}

async function main() {
  console.log("===============================");
  console.log("   ALCHEMY JOB FINDER");
  console.log("===============================");
  console.log(`Started: ${new Date().toISOString()}`);

  const companies =
    await prisma.company.findMany({
      where: {
        enabled: true,
      },

      orderBy: [
        {
          priority: "desc",
        },
        {
          name: "asc",
        },
      ],

      select: {
        id: true,
        name: true,
        careerUrl: true,
        scraperType: true,
        atsIdentifier: true,
      },
    });

  console.log(
    `Enabled companies: ${companies.length}`
  );

  const results: CompanyRunResult[] = [];

  // Intentionally sequential at company level for now.
  // Job persistence already uses controlled concurrency.
  for (const company of companies) {
    const result =
      await scrapeCompany(company);

    results.push(result);
  }

  const successful =
    results.filter(
      (result) => result.success
    ).length;

  const failed =
    results.length - successful;

  const totalFound =
    results.reduce(
      (sum, result) =>
        sum + result.found,
      0
    );

  const totalCreated =
    results.reduce(
      (sum, result) =>
        sum + result.created,
      0
    );

  const totalUpdated =
    results.reduce(
      (sum, result) =>
        sum + result.updated,
      0
    );

  console.log("");
  console.log("===============================");
  console.log("SCRAPE SUMMARY");
  console.log("===============================");
  console.log(`Companies:  ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed:     ${failed}`);
  console.log(`Jobs found: ${totalFound}`);
  console.log(`Created:    ${totalCreated}`);
  console.log(`Updated:    ${totalUpdated}`);

  if (failed > 0) {
    console.log("");
    console.log("Failures:");

    for (const result of results) {
      if (!result.success) {
        console.log(
          `- ${result.company}: ${result.error}`
        );
      }
    }
  }
}

main()
  .catch((error) => {
    console.error(
      "Fatal worker error:"
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });