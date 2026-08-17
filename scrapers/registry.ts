import type { JobScraper } from "./types";

import { GreenhouseScraper } from "./ats/greenhouse";
import { LeverScraper } from "./ats/lever";

export type RegisteredScraperType =
  | "GREENHOUSE"
  | "LEVER"
  | "CHEERIO"
  | "PLAYWRIGHT"
  | "CUSTOM";

class ScraperRegistry {
  private readonly scrapers =
    new Map<RegisteredScraperType, JobScraper>();

  register(
    type: RegisteredScraperType,
    scraper: JobScraper
  ): void {
    this.scrapers.set(type, scraper);
  }

  get(type: RegisteredScraperType): JobScraper {
    const scraper = this.scrapers.get(type);

    if (!scraper) {
      throw new Error(
        `No scraper registered for ${type}`
      );
    }

    return scraper;
  }

  has(type: RegisteredScraperType): boolean {
    return this.scrapers.has(type);
  }
}

export const scraperRegistry =
  new ScraperRegistry();

scraperRegistry.register(
  "GREENHOUSE",
  new GreenhouseScraper()
);

scraperRegistry.register(
  "LEVER",
  new LeverScraper()
);