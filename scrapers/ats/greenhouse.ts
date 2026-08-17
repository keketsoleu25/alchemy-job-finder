import {
  scrapedJobsSchema,
} from "@/lib/validation/scraped-job";

import type {
  JobScraper,
  ScrapedJob,
  ScraperCompanyConfig,
} from "@/scrapers/types";

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  location?: {
    name?: string | null;
  } | null;
  updated_at?: string | null;
  content?: string | null;
};

type GreenhouseResponse = {
  jobs: GreenhouseJob[];
};

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  mdash: "—",
  ndash: "–",
  nbsp: " ",
  quot: '"',
};

function decodeHtmlEntitiesOnce(value: string): string {
  return value.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (entity, token: string) => {
      if (token.startsWith("#x") || token.startsWith("#X")) {
        const codePoint = Number.parseInt(token.slice(2), 16);
        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : entity;
      }

      if (token.startsWith("#")) {
        const codePoint = Number.parseInt(token.slice(1), 10);
        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : entity;
      }

      return HTML_ENTITIES[token.toLowerCase()] ?? entity;
    }
  );
}

export function htmlToPlainText(value: string): string {
  // Greenhouse content can arrive as normal HTML or as HTML that has itself
  // been entity-escaped. Decode twice so values such as `&amp;nbsp;` become a
  // real space before tags are removed. The result stays plain text, so the UI
  // never needs to render scraped markup with dangerouslySetInnerHTML.
  const decoded = decodeHtmlEntitiesOnce(
    decodeHtmlEntitiesOnce(value)
  );

  return decoded
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithRetry(
  url: string,
  attempts = 2
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "AlchemyJobFinder/1.0",
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(
          `Greenhouse request failed: ${response.status} ${response.statusText}`
        );
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        console.warn(
          `Greenhouse request attempt ${attempt} failed. Retrying...`
        );

        await new Promise((resolve) =>
          setTimeout(resolve, 1500)
        );
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(
    "Greenhouse request failed after all retry attempts"
  );
}

export class GreenhouseScraper
  implements JobScraper
{
  async fetch(
    company: ScraperCompanyConfig
  ): Promise<ScrapedJob[]> {
    if (!company.atsIdentifier) {
      throw new Error(
        `Missing Greenhouse atsIdentifier for ${company.name}`
      );
    }

    const endpoint =
      `https://boards-api.greenhouse.io/v1/boards/` +
      `${encodeURIComponent(company.atsIdentifier)}/jobs?content=true`;

    const response =
      await fetchWithRetry(endpoint);

    const payload =
      (await response.json()) as GreenhouseResponse;

    const scrapedAt = new Date();

    const jobs: ScrapedJob[] =
      payload.jobs.map((job) => {
        const location =
          job.location?.name?.trim() || undefined;

        return {
          externalId: String(job.id),
          title: job.title.trim(),
          company: company.name,
          location,
          remote:
            location
              ?.toLowerCase()
              .includes("remote") ?? false,
          description: htmlToPlainText(
            job.content ?? ""
          ),
          applyUrl: job.absolute_url,
          sourceUrl: endpoint,
          source: "GREENHOUSE",
          publishedAt: job.updated_at
            ? new Date(job.updated_at)
            : undefined,
          scrapedAt,
        };
      });

    return scrapedJobsSchema.parse(jobs);
  }
}