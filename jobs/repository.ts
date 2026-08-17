import { prisma } from "@/lib/db/prisma";
import type { ScrapedJob } from "@/scrapers/types";

import { createJobFingerprint } from "./fingerprint";
import { normalizeLocation, normalizeTitle } from "./normalize";

export type PersistJobsResult = {
  created: number;
  updated: number;
  total: number;
};

type PersistSingleJobResult = "created" | "updated";
const CONCURRENCY_LIMIT = 10;

async function persistSingleJob(
  companyId: string,
  job: ScrapedJob
): Promise<PersistSingleJobResult> {
  const fingerprint = createJobFingerprint(companyId, job);
  const existing = await prisma.job.findUnique({
    where: { fingerprint },
    select: { id: true, status: true },
  });

  const data = {
    externalId: job.externalId,
    title: job.title,
    normalizedTitle: normalizeTitle(job.title),
    location: normalizeLocation(job.location) ?? null,
    remote: job.remote ?? false,
    employmentType: job.employmentType ?? null,
    description: job.description,
    applyUrl: job.applyUrl,
    sourceUrl: job.sourceUrl,
    source: job.source,
    publishedAt: job.publishedAt ?? null,
    lastSeenAt: new Date(),
  };

  if (existing) {
    await prisma.job.update({
      where: { fingerprint },
      data: {
        ...data,
        // A previously closed vacancy that reappears is genuinely new information.
        // Do not reset REVIEW/SHORTLISTED/REJECTED because those are user decisions.
        ...(existing.status === "CLOSED" ? { status: "NEW" as const } : {}),
      },
    });
    return "updated";
  }

  await prisma.job.create({
    data: {
      ...data,
      fingerprint,
      company: { connect: { id: companyId } },
      matchedSkills: [],
      missingSkills: [],
    },
  });

  return "created";
}

export async function persistJobs(
  companyId: string,
  jobs: ScrapedJob[]
): Promise<PersistJobsResult> {
  let created = 0;
  let updated = 0;

  for (let index = 0; index < jobs.length; index += CONCURRENCY_LIMIT) {
    const batch = jobs.slice(index, index + CONCURRENCY_LIMIT);
    const results = await Promise.all(
      batch.map((job) => persistSingleJob(companyId, job))
    );

    for (const result of results) {
      if (result === "created") created++;
      if (result === "updated") updated++;
    }

    console.log(`Persisted ${Math.min(index + batch.length, jobs.length)}/${jobs.length}`);
  }

  return { created, updated, total: jobs.length };
}
