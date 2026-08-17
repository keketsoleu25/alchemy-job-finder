-- CreateEnum
CREATE TYPE "ScraperType" AS ENUM ('GREENHOUSE', 'LEVER', 'CHEERIO', 'PLAYWRIGHT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('GREENHOUSE', 'LEVER', 'COMPANY_SITE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('NEW', 'REVIEW', 'SHORTLISTED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PLANNED', 'APPLIED', 'SCREENING', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RemotePreference" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE', 'FLEXIBLE');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "careerUrl" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "scraperType" "ScraperType" NOT NULL,
    "atsIdentifier" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "lastScrapedAt" TIMESTAMP(3),
    "lastSuccessfulScrapeAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "location" TEXT,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "employmentType" TEXT,
    "description" TEXT NOT NULL,
    "applyUrl" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "source" "JobSource" NOT NULL,
    "requiredExperienceMin" DOUBLE PRECISION,
    "requiredExperienceMax" DOUBLE PRECISION,
    "matchedSkills" TEXT[],
    "missingSkills" TEXT[],
    "matchScore" INTEGER,
    "matchData" JSONB,
    "publishedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "JobStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PLANNED',
    "appliedAt" TIMESTAMP(3),
    "resumeVersion" TEXT,
    "coverLetterVersion" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetRoles" TEXT[],
    "preferredRoles" TEXT[],
    "skills" TEXT[],
    "strongSkills" TEXT[],
    "secondarySkills" TEXT[],
    "yearsExperience" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "preferredLocations" TEXT[],
    "remotePreference" "RemotePreference" NOT NULL DEFAULT 'FLEXIBLE',
    "education" TEXT,
    "excludedKeywords" TEXT[],
    "preferredKeywords" TEXT[],
    "minimumScore" INTEGER NOT NULL DEFAULT 65,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_enabled_priority_idx" ON "Company"("enabled", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "Job_fingerprint_key" ON "Job"("fingerprint");

-- CreateIndex
CREATE INDEX "Job_companyId_idx" ON "Job"("companyId");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_matchScore_idx" ON "Job"("matchScore");

-- CreateIndex
CREATE INDEX "Job_publishedAt_idx" ON "Job"("publishedAt");

-- CreateIndex
CREATE INDEX "Job_lastSeenAt_idx" ON "Job"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Job_source_externalId_idx" ON "Job"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_jobId_key" ON "JobApplication"("jobId");

-- CreateIndex
CREATE INDEX "JobApplication_status_idx" ON "JobApplication"("status");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
