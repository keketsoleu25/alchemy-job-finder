import { createHash } from "node:crypto";

import type { ScrapedJob } from "@/scrapers/types";
import {
  normalizeLocation,
  normalizeTitle,
} from "./normalize";

export function createJobFingerprint(
  companyId: string,
  job: ScrapedJob
): string {
  const title = normalizeTitle(job.title);
  const location =
    normalizeLocation(job.location)?.toLowerCase() ?? "";

  const identity = job.externalId
    ? `${job.source}:${companyId}:${job.externalId}`
    : `${job.source}:${companyId}:${title}:${location}:${job.applyUrl}`;

  return createHash("sha256")
    .update(identity)
    .digest("hex");
}