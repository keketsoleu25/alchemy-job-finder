import { scrapedJobsSchema } from "@/lib/validation/scraped-job";
import type { JobScraper, ScrapedJob, ScraperCompanyConfig } from "@/scrapers/types";

const LISTING_URL = "https://www.executiveplacements.com/jobList.asp";
const MAX_RESPONSE_BYTES = 8_000_000;
const MAX_DESCRIPTION_CHARS = 30_000;
const DETAIL_CONCURRENCY = 4;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function htmlToText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

    url.search = "";
    url.hash = "";
    urls.set(url.pathname.toLowerCase(), url);
  }

  return [...urls.values()];
}

function extractDescription(text: string, title: string): string {
  const lower = text.toLowerCase();
  const markers = [
    "job description",
    "job & company description",
    "job and company description",
    "position description",
    "minimum requirements",
  ];

  let start = -1;
  for (const marker of markers) {
    const index = lower.indexOf(marker);
    if (index >= 0 && (start < 0 || index < start)) start = index;
  }

  if (start < 0) start = lower.indexOf(title.toLowerCase());
  if (start < 0) start = 0;

  let description = text.slice(start, start + MAX_DESCRIPTION_CHARS);
  const endMarkers = ["similar jobs", "related jobs", "jobseekers\nregister your cv", "recruiter\nadvertise jobs"];
  const descriptionLower = description.toLowerCase();

  for (const marker of endMarkers) {
    const index = descriptionLower.indexOf(marker);
    if (index > 300) description = description.slice(0, index);
  }

  return description.trim() || title;
}

function extractLocation(text: string): string | undefined {
  const labelled = text.match(/(?:^|\n)(?:location|area|city)\s*:?\s*([^\n]{2,80})/i)?.[1]?.trim();
  if (labelled && !/search|keyword|select/i.test(labelled)) return labelled;

  const knownLocations = [
    "Johannesburg", "Cape Town", "Pretoria", "Durban", "Centurion", "Midrand", "Sandton", "Randburg",
    "Woodmead", "Stellenbosch", "Gqeberha", "East London", "Bloemfontein", "Polokwane", "Mbombela", "Rustenburg",
    "Kimberley", "Umhlanga", "Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape", "Free State", "Limpopo",
    "Mpumalanga", "North West", "Northern Cape",
  ];

  return knownLocations.find((location) => new RegExp(`\\b${location.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i").test(text));
}

function extractEmploymentType(text: string): string | undefined {
  const types = [
    ["full-time", /\bfull[- ]time\b/i],
    ["part-time", /\bpart[- ]time\b/i],
    ["contract", /\b(?:fixed[- ]term|contract)\b/i],
    ["internship", /\bintern(?:ship)?\b/i],
    ["learnership", /\blearnership\b/i],
  ] as const;

  return types.find(([, pattern]) => pattern.test(text))?.[0];
}

async function fetchDetail(url: URL, title: string): Promise<Pick<ScrapedJob, "description" | "location" | "remote" | "employmentType">> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "AlchemyJobFinder/1.0 (+direct-job-discovery)",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) throw new Error(`detail request failed: ${response.status}`);
  const html = await response.text();
  if (html.length > MAX_RESPONSE_BYTES) throw new Error("detail response exceeds 8 MB safety limit");

  const text = htmlToText(html);
  const description = extractDescription(text, title);
  const combined = `${title}\n${description}`;

  return {
    description,
    location: extractLocation(combined),
    remote: /\bremote\b|work from home|work from anywhere/i.test(combined),
    employmentType: extractEmploymentType(combined),
  };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

/**
 * Executive Placements exposes ordinary server-rendered vacancy links. We use
 * the listing page for discovery, then fetch each public detail page so the
 * existing SA normalization, skills and scoring pipeline receives meaningful
 * vacancy text instead of a title-only placeholder.
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

    const urls = detailUrls(html);
    if (!urls.length) throw new Error("No Executive Placements vacancy links found on the current jobs page");

    const scrapedAt = new Date();
    const jobs = await mapWithConcurrency(urls, DETAIL_CONCURRENCY, async (url): Promise<ScrapedJob> => {
      const title = titleFromPath(url.pathname);
      let detail: Awaited<ReturnType<typeof fetchDetail>>;

      try {
        detail = await fetchDetail(url, title);
      } catch (error) {
        // A single malformed or temporarily unavailable detail page must not
        // discard the rest of the collection batch.
        console.warn(`Executive Placements detail skipped for enrichment: ${url.pathname} (${error instanceof Error ? error.message : "unknown error"})`);
        detail = { description: title, remote: /\bremote\b/i.test(title) };
      }

      return {
        externalId: externalIdFromPath(url.pathname),
        title,
        company: company.name,
        location: detail.location,
        remote: detail.remote,
        employmentType: detail.employmentType,
        description: detail.description,
        applyUrl: url.toString(),
        sourceUrl: LISTING_URL,
        source: "COMPANY_SITE",
        publishedAt: publishedAtFromPath(url.pathname),
        scrapedAt,
      };
    });

    return scrapedJobsSchema.parse(jobs);
  }
}
