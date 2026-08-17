import { scraperRegistry } from "../scrapers/registry";

async function main() {
  const scraper = scraperRegistry.get("GREENHOUSE");

  const company = {
  id: "test-company",
  name: "Figma",
  careerUrl: "https://www.figma.com/careers/",
  atsIdentifier: "figma",
};

  console.log(`Testing Greenhouse scraper for ${company.name}...`);

  const jobs = await scraper.fetch(company);

  console.log(`Found ${jobs.length} jobs`);

  for (const job of jobs.slice(0, 10)) {
    console.log("--------------------------------");
    console.log(`Title: ${job.title}`);
    console.log(`Location: ${job.location ?? "Unknown"}`);
    console.log(`Remote: ${job.remote ? "Yes" : "No"}`);
    console.log(`Apply: ${job.applyUrl}`);
  }

  console.log("--------------------------------");
  console.log(`Total normalized jobs: ${jobs.length}`);
}

main().catch((error) => {
  console.error("Greenhouse test failed:");
  console.error(error);
  process.exit(1);
});