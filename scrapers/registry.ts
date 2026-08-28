import type { JobScraper, ScraperCompanyConfig, ScrapedJob } from "./types";

import { GreenhouseScraper } from "./ats/greenhouse";
import { LeverScraper } from "./ats/lever";
import { ExecutivePlacementsScraper } from "./generic/executive-placements";
import { StructuredHtmlScraper } from "./generic/structured-html";

export type RegisteredScraperType =
  | "GREENHOUSE"
  | "LEVER"
  | "CHEERIO"
  | "PLAYWRIGHT"
  | "CUSTOM";

class ScraperRegistry {
  private readonly scrapers = new Map<RegisteredScraperType, JobScraper>();

  register(type: RegisteredScraperType, scraper: JobScraper): void {
    this.scrapers.set(type, scraper);
  }

  get(type: RegisteredScraperType): JobScraper {
    const scraper = this.scrapers.get(type);
    if (!scraper) throw new Error(`No scraper registered for ${type}`);
    return scraper;
  }

  has(type: RegisteredScraperType): boolean {
    return this.scrapers.has(type);
  }
}

class CompanySiteScraper implements JobScraper {
  private readonly structuredHtml = new StructuredHtmlScraper();
  private readonly executivePlacements = new ExecutivePlacementsScraper();

  fetch(company: ScraperCompanyConfig): Promise<ScrapedJob[]> {
    const hostname = new URL(company.careerUrl).hostname.toLowerCase();

    if (hostname === "executiveplacements.com" || hostname === "www.executiveplacements.com") {
      return this.executivePlacements.fetch(company);
    }

    return this.structuredHtml.fetch(company);
  }
}

export const scraperRegistry = new ScraperRegistry();

scraperRegistry.register("GREENHOUSE", new GreenhouseScraper());
scraperRegistry.register("LEVER", new LeverScraper());
// CUSTOM stays the lightweight company-site path. Known public job boards can
// receive a focused adapter while ordinary employer sites keep the JSON-LD fallback.
scraperRegistry.register("CUSTOM", new CompanySiteScraper());
