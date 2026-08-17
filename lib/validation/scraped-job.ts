import { z } from "zod";

export const scrapedJobSchema = z.object({
  externalId: z.string().optional(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  employmentType: z.string().optional(),
  description: z.string(),
  applyUrl: z.url(),
  sourceUrl: z.url(),
  source: z.enum([
    "GREENHOUSE",
    "LEVER",
    "COMPANY_SITE",
  ]),
  publishedAt: z.date().optional(),
  scrapedAt: z.date(),
});

export const scrapedJobsSchema =
  z.array(scrapedJobSchema);