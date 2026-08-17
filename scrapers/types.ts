export type JobSource =
  | "GREENHOUSE"
  | "LEVER"
  | "COMPANY_SITE";

export interface ScrapedJob {
  externalId?: string;
  title: string;
  company: string;
  location?: string;
  remote?: boolean;
  employmentType?: string;
  description: string;
  applyUrl: string;
  sourceUrl: string;
  source: JobSource;
  publishedAt?: Date;
  scrapedAt: Date;
}

export interface ScraperCompanyConfig {
  id: string;
  name: string;
  careerUrl: string;
  atsIdentifier?: string | null;
}

export interface JobScraper {
  fetch(
    company: ScraperCompanyConfig
  ): Promise<ScrapedJob[]>;
}