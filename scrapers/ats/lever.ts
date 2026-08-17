import {
  scrapedJobsSchema,
} from "@/lib/validation/scraped-job";

import type {
  JobScraper,
  ScrapedJob,
  ScraperCompanyConfig,
} from "@/scrapers/types";

type LeverJob = {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl: string;
  categories?: {
    location?: string;
  };
  descriptionPlain?: string;
  createdAt?: number;
};

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
          `Lever request failed: ${response.status} ${response.statusText}`
        );
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        console.warn(
          `Lever request attempt ${attempt} failed. Retrying...`
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
    "Lever request failed after all retry attempts"
  );
}

export class LeverScraper implements JobScraper {
  async fetch(
    company: ScraperCompanyConfig
  ): Promise<ScrapedJob[]> {
    if (!company.atsIdentifier) {
      throw new Error(
        `Missing Lever atsIdentifier for ${company.name}`
      );
    }

    const endpoint =
      `https://api.lever.co/v0/postings/` +
      `${encodeURIComponent(company.atsIdentifier)}?mode=json`;

    const response =
      await fetchWithRetry(endpoint);

    const payload =
      (await response.json()) as LeverJob[];

    const scrapedAt = new Date();

    const jobs: ScrapedJob[] =
      payload.map((job) => {
        const location =
          job.categories?.location?.trim() || undefined;

        return {
          externalId: job.id,
          title: job.text.trim(),
          company: company.name,
          location,
          remote:
            location?.toLowerCase().includes("remote") ?? false,
          description:
            job.descriptionPlain?.trim() ?? "",
          applyUrl:
            job.applyUrl || job.hostedUrl,
          sourceUrl:
            job.hostedUrl || endpoint,
          source: "LEVER",
          publishedAt:
            typeof job.createdAt === "number"
              ? new Date(job.createdAt)
              : undefined,
          scrapedAt,
        };
      });

    return scrapedJobsSchema.parse(jobs);
  }
}