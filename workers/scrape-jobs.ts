import { prisma } from "../lib/db/prisma";
import { persistJobs } from "../jobs/repository";
import { scraperRegistry } from "../scrapers/registry";

type CompanyRunResult = {
  company: string;
  success: boolean;
  found: number;
  created: number;
  updated: number;
  closed: number;
  error?: string;
};

const STALE_AFTER_MS = 72 * 60 * 60 * 1000;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function scrapeCompany(company: {
  id: string;
  name: string;
  careerUrl: string;
  scraperType: "GREENHOUSE" | "LEVER" | "CHEERIO" | "PLAYWRIGHT" | "CUSTOM";
  atsIdentifier: string | null;
}): Promise<CompanyRunResult> {
  console.log(`\n▶ ${company.name}`);
  console.log(`  Scraper: ${company.scraperType}`);
  const startedAt = Date.now();

  try {
    const scraper = scraperRegistry.get(company.scraperType);
    const jobs = await scraper.fetch({
      id: company.id,
      name: company.name,
      careerUrl: company.careerUrl,
      atsIdentifier: company.atsIdentifier,
    });

    console.log(`  Found: ${jobs.length}`);
    const result = await persistJobs(company.id, jobs);

    // A single missing scrape should never close a vacancy. Only successful runs can
    // advance lifecycle state, and a 72-hour grace period protects against transient
    // ATS omissions or temporary network inconsistencies.
    const staleBefore = new Date(Date.now() - STALE_AFTER_MS);
    const closed = await prisma.job.updateMany({
      where: {
        companyId: company.id,
        status: { not: "CLOSED" },
        lastSeenAt: { lt: staleBefore },
      },
      data: { status: "CLOSED" },
    });

    await prisma.company.update({
      where: { id: company.id },
      data: {
        lastScrapedAt: new Date(),
        lastSuccessfulScrapeAt: new Date(),
        lastError: null,
      },
    });

    const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`  ✓ Created ${result.created}, updated ${result.updated}, closed ${closed.count} (${duration}s)`);

    return {
      company: company.name,
      success: true,
      found: jobs.length,
      created: result.created,
      updated: result.updated,
      closed: closed.count,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    await prisma.company.update({
      where: { id: company.id },
      data: { lastScrapedAt: new Date(), lastError: message.slice(0, 2000) },
    });
    console.error(`  ✗ ${company.name} failed: ${message}`);
    return { company: company.name, success: false, found: 0, created: 0, updated: 0, closed: 0, error: message };
  }
}

async function main() {
  console.log("===============================");
  console.log("   ALCHEMY JOB FINDER");
  console.log("===============================");
  console.log(`Started: ${new Date().toISOString()}`);

  const companies = await prisma.company.findMany({
    where: { enabled: true },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      careerUrl: true,
      scraperType: true,
      atsIdentifier: true,
    },
  });

  console.log(`Enabled companies: ${companies.length}`);
  const results: CompanyRunResult[] = [];

  // Company-level scraping remains sequential to be polite to external ATS providers;
  // persistence inside each company is already concurrency-limited.
  for (const company of companies) {
    results.push(await scrapeCompany(company));
  }

  const successful = results.filter((result) => result.success).length;
  const failed = results.length - successful;
  const sum = (key: "found" | "created" | "updated" | "closed") =>
    results.reduce((total, result) => total + result[key], 0);

  console.log("\n===============================");
  console.log("SCRAPE SUMMARY");
  console.log("===============================");
  console.log(`Companies:  ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed:     ${failed}`);
  console.log(`Jobs found: ${sum("found")}`);
  console.log(`Created:    ${sum("created")}`);
  console.log(`Updated:    ${sum("updated")}`);
  console.log(`Closed:     ${sum("closed")}`);

  if (failed > 0) {
    console.log("\nFailures:");
    for (const result of results) {
      if (!result.success) console.log(`- ${result.company}: ${result.error}`);
    }
  }
}

main()
  .catch((error) => {
    console.error("Fatal worker error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
