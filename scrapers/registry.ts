import type { JobScraper, ScraperCompanyConfig, ScrapedJob } from "./types";

import { GreenhouseScraper } from "./ats/greenhouse";
import { LeverScraper } from "./ats/lever";
import { ExecutivePlacementsScraper } from "./generic/executive-placements";
import { StructuredHtmlScraper } from "./generic/structured-html";
import { StaticJobBoardScraper } from "./job-boards/static-job-board";

export type RegisteredScraperType =
  | "GREENHOUSE"
  | "LEVER"
  | "CHEERIO"
  | "PLAYWRIGHT"
  | "CUSTOM";

class CustomSourceRouter implements JobScraper {
  private readonly direct = new StructuredHtmlScraper();
  private readonly executivePlacements = new ExecutivePlacementsScraper();
  private readonly board = new StaticJobBoardScraper();

  fetch(company: ScraperCompanyConfig): Promise<ScrapedJob[]> {
    const host = new URL(company.careerUrl)
      .hostname
      .replace(/^www\./, "")
      .toLowerCase();

    if (host === "executiveplacements.com") {
      return this.executivePlacements.fetch(company);
    }

    const isBoard =
      host.endsWith("pnet.co.za") ||
      host.endsWith("careerjunction.co.za") ||
      host.endsWith("careers24.com");

    return isBoard ? this.board.fetch(company) : this.direct.fetch(company);
  }
}

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

export const scraperRegistry = new ScraperRegistry();

scraperRegistry.register("GREENHOUSE", new GreenhouseScraper());
scraperRegistry.register("LEVER", new LeverScraper());
// CUSTOM stays dependency-free. Known public sources are routed to focused
// adapters; ordinary employer pages keep the structured HTML fallback.
scraperRegistry.register("CUSTOM", new CustomSourceRouter());
