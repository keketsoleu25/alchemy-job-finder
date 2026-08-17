"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";

const JOB_STATUSES = ["NEW", "REVIEW", "SHORTLISTED", "REJECTED", "CLOSED"] as const;
const APPLICATION_STATUSES = ["PLANNED", "APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"] as const;

export async function setJobStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !JOB_STATUSES.includes(status as (typeof JOB_STATUSES)[number])) return;

  await prisma.job.update({ where: { id }, data: { status: status as (typeof JOB_STATUSES)[number] } });
  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
}

export async function setApplicationStatus(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!jobId || !APPLICATION_STATUSES.includes(status as (typeof APPLICATION_STATUSES)[number])) return;

  const typedStatus = status as (typeof APPLICATION_STATUSES)[number];
  await prisma.jobApplication.upsert({
    where: { jobId },
    create: {
      jobId,
      status: typedStatus,
      appliedAt: typedStatus === "APPLIED" ? new Date() : null,
    },
    update: {
      status: typedStatus,
      ...(typedStatus === "APPLIED" ? { appliedAt: new Date() } : {}),
    },
  });

  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath(`/jobs/${jobId}`);
}

export async function addCompany(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const careerUrl = String(formData.get("careerUrl") ?? "").trim();
  const websiteUrl = String(formData.get("websiteUrl") ?? "").trim();
  const scraperType = String(formData.get("scraperType") ?? "GREENHOUSE");
  const atsIdentifier = String(formData.get("atsIdentifier") ?? "").trim();

  if (!name || !slug || !careerUrl || !atsIdentifier || !["GREENHOUSE", "LEVER"].includes(scraperType)) return;

  await prisma.company.upsert({
    where: { slug },
    create: {
      name,
      slug,
      careerUrl,
      websiteUrl: websiteUrl || null,
      scraperType: scraperType as "GREENHOUSE" | "LEVER",
      atsIdentifier,
      enabled: true,
    },
    update: {
      name,
      careerUrl,
      websiteUrl: websiteUrl || null,
      scraperType: scraperType as "GREENHOUSE" | "LEVER",
      atsIdentifier,
      enabled: true,
    },
  });

  revalidatePath("/companies");
}

export async function updateProfile(formData: FormData) {
  const profile = await prisma.candidateProfile.findFirst({ orderBy: { createdAt: "asc" } });
  if (!profile) return;

  const lines = (name: string) =>
    String(formData.get(name) ?? "")
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean);

  const years = Number(formData.get("yearsExperience") ?? profile.yearsExperience);
  const minimumScore = Number(formData.get("minimumScore") ?? profile.minimumScore);
  const remotePreference = String(formData.get("remotePreference") ?? profile.remotePreference);

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: {
      targetRoles: lines("targetRoles"),
      preferredRoles: lines("preferredRoles"),
      skills: lines("skills"),
      strongSkills: lines("strongSkills"),
      secondarySkills: lines("secondarySkills"),
      preferredLocations: lines("preferredLocations"),
      preferredKeywords: lines("preferredKeywords"),
      excludedKeywords: lines("excludedKeywords"),
      yearsExperience: Number.isFinite(years) ? years : profile.yearsExperience,
      minimumScore: Number.isFinite(minimumScore) ? Math.max(0, Math.min(100, minimumScore)) : profile.minimumScore,
      education: String(formData.get("education") ?? "").trim() || null,
      remotePreference: ["REMOTE", "HYBRID", "ONSITE", "FLEXIBLE"].includes(remotePreference)
        ? (remotePreference as "REMOTE" | "HYBRID" | "ONSITE" | "FLEXIBLE")
        : profile.remotePreference,
    },
  });

  revalidatePath("/settings");
}
