import { scrapedJobsSchema } from "@/lib/validation/scraped-job";
import type { JobScraper, ScrapedJob, ScraperCompanyConfig } from "@/scrapers/types";

type JsonRecord = Record<string, unknown>;

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function flattenJsonLd(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  const record = asRecord(value);
  if (!record) return [];

  const graph = record["@graph"];
  return graph ? [record, ...flattenJsonLd(graph)] : [record];
}

function typeIncludesJobPosting(value: unknown): boolean {
  if (typeof value === "string") return value.toLowerCase() === "jobposting";
  if (Array.isArray(value)) return value.some(typeIncludesJobPosting);
  return false;
}

function locationLabel(job: JsonRecord): string | undefined {
  const locations = Array.isArray(job.jobLocation) ? job.jobLocation : [job.jobLocation];

  for (const location of locations) {
    const locationRecord = asRecord(location);
    const address = asRecord(locationRecord?.address);
    if (!address) continue;

    const parts = [address.addressLocality, address.addressRegion, address.addressCountry]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .map((part) => part.trim());
    if (parts.length) return parts.join(", ");
  }

  const jobLocationType = job.jobLocationType;
  if (typeof jobLocationType === "string" && /telecommute|remote/i.test(jobLocationType)) return "Remote";
  return undefined;
}

function identifierValue(job: JsonRecord): string | undefined {
  const identifier = asRecord(job.identifier);
  const candidate = identifier?.value ?? identifier?.propertyValue ?? job.identifier;
  return typeof candidate === "string" || typeof candidate === "number" ? String(candidate) : undefined;
}

function employmentType(job: JsonRecord): string | undefined {
  if (typeof job.employmentType === "string") return job.employmentType;
  if (Array.isArray(job.employmentType)) return job.employmentType.filter((value): value is string => typeof value === "string").join(", ") || undefined;
  return undefined;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Dependency-free static career-page fallback.
 *
 * Many employer sites publish schema.org JobPosting JSON-LD for search engines even
 * when their visible markup is custom. This adapter intentionally reads only that
 * structured data; it does not execute JavaScript or attempt anti-bot bypasses.
 */
export class StructuredHtmlScraper implements JobScraper {
  async fetch(company: ScraperCompanyConfig): Promise<ScrapedJob[]> {
    const response = await fetch(company.careerUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "AlchemyJobFinder/1.0 (+direct-job-discovery)",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Company-site request failed: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    if (html.length > 8_000_000) throw new Error("Company-site response exceeds 8 MB safety limit");

    const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    const records: JsonRecord[] = [];

    for (const block of blocks) {
      try {
        records.push(...flattenJsonLd(JSON.parse(block[1].trim())));
      } catch {
        // Malformed JSON-LD from one script block should not poison other valid blocks.
      }
    }

    const scrapedAt = new Date();
    const jobs: ScrapedJob[] = records
      .filter((record) => typeIncludesJobPosting(record["@type"]))
      .flatMap((record) => {
        const title = typeof record.title === "string" ? record.title.trim() : "";
        const url = typeof record.url === "string" ? record.url : company.careerUrl;
        if (!title || !/^https?:\/\//i.test(url)) return [];

        const location = locationLabel(record);
        const remote = /remote|telecommute/i.test(`${location ?? ""} ${String(record.jobLocationType ?? "")}`);
        const description = typeof record.description === "string" ? stripHtml(record.description) : "";

        return [{
          externalId: identifierValue(record),
          title,
          company: company.name,
          location,
          remote,
          employmentType: employmentType(record),
          description,
          applyUrl: url,
          sourceUrl: company.careerUrl,
          source: "COMPANY_SITE" as const,
          publishedAt: parseDate(record.datePosted),
          scrapedAt,
        }];
      });

    if (!jobs.length) {
      throw new Error("No schema.org JobPosting records found on the static career page");
    }

    return scrapedJobsSchema.parse(jobs);
  }
}
