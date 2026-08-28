import { scrapedJobsSchema } from "@/lib/validation/scraped-job";
import type { JobScraper, ScrapedJob, ScraperCompanyConfig } from "@/scrapers/types";

const LISTING_URL = "https://www.executiveplacements.com/jobList.asp";
const MAX_RESPONSE_BYTES = 8_000_000;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—");
}

function titleFromPath(pathname: string): string {
  const filename = pathname.split("/").pop() ?? "";
  const marker = filename.toLowerCase().indexOf("-job-search-");
  const slug = marker >= 0 ? filename.slice(0, marker) : filename.replace(/\.asp$/i, "");

  return decodeURIComponent(slug)
    .replace(/-\d+$/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function externalIdFromPath(pathname: string): string | undefined {
  const filename = pathname.split("/").pop() ?? "";
  const match = filename.match(/-(\d+)-Job-Search-/i);
  return match?.[1];
}

function publishedAtFromPath(pathname: string): Date | undefined {
  const filename = pathname.split("/").pop() ?? "";
  const match = filename.match(/-Job-Search-(\d{2})-(\d{2})-(\d{4})-/i);
  if (!match) return undefined;

  const [, month, day, year] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00+02:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function detailUrls(html: string): URL[] {
  const urls = new Map<string, URL>();
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;

  for (const match of html.matchAll(hrefPattern)) {
    const rawHref = decodeHtml(match[1].trim());
    let url: URL;

    try {
      url = new URL(rawHref, LISTING_URL);
    } catch {
      continue;
    }

    if (url.hostname.toLowerCase() !== "www.executiveplacements.com") continue;
    if (!/\/Jobs\/[A-Z]\/.+-Job-Search-\d{2}-\d{2}-\d{4}-.+\.asp$/i.test(url.pathname)) continue;

    // Tracking parameters do not identify the vacancy and create duplicate URLs.
    url.search = "";
    url.hash = "";
    urls.set(url.pathname.toLowerCase(), url);
  }

  return [...urls.values()];
}

/**
 * Executive Placements exposes its current vacancies as ordinary server-rendered
 * HTML. The detail links themselves contain a stable vacancy id, title slug and
 * posting date, so collection can remain dependency-free and does not need a
 * browser, CAPTCHA bypass, or other anti-bot technique.
 *
 * This adapter intentionally collects only the currently visible results page.
 * Pagination can be added later once its public paging contract is verified.
 */
export class ExecutivePlacementsScraper implements JobScraper {
  async fetch(company: ScraperCompanyConfig): Promise<ScrapedJob[]> {
    const response = await fetch(LISTING_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "AlchemyJobFinder/1.0 (+direct-job-discovery)",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Executive Placements request failed: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    if (html.length > MAX_RESPONSE_BYTES) {
      throw new Error("Executive Placements response exceeds 8 MB safety limit");
    }

    const scrapedAt = new Date();
    const jobs: ScrapedJob[] = detailUrls(html).flatMap((url) => {
      const title = titleFromPath(url.pathname);
      if (!title) return [];

      return [{
        externalId: externalIdFromPath(url.pathname),
        title,
        company: company.name,
        remote: /\bremote\b/i.test(title),
        description: title,
        applyUrl: url.toString(),
        sourceUrl: LISTING_URL,
        source: "COMPANY_SITE" as const,
        publishedAt: publishedAtFromPath(url.pathname),
        scrapedAt,
      }];
    });

    if (!jobs.length) {
      throw new Error("No Executive Placements vacancy links found on the current jobs page");
    }

    return scrapedJobsSchema.parse(jobs);
  }
}
