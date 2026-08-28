# Alchemy Job Finder

Alchemy Job Finder is a personal job-intelligence platform that turns direct employer vacancies into an actionable shortlist.

It collects jobs from supported ATS sources and public structured career pages, normalizes and deduplicates them, scores each role against a configurable candidate profile, and tracks applications from planning through interview and offer.

## V1 capabilities

- Direct Greenhouse Job Board collection
- Direct Lever Postings collection
- Dependency-free schema.org `JobPosting` career-page fallback
- Zod validation at scraper boundaries
- Stable fingerprint-based deduplication
- Controlled database write concurrency
- Per-company failure isolation and source health tracking
- 72-hour grace period before stale vacancies are marked closed
- Deterministic, explainable job scoring
- Skill and experience extraction
- Conservative hard filters
- Ranked **Apply Today** dashboard
- Filterable job explorer and job-detail review view
- Shortlist and application-stage tracking
- Application notes + resume/cover-letter version references
- Company/source management with enable/disable controls
- Candidate profile settings
- Market, skill-gap and application-funnel analytics
- Scheduled refresh workflow

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma 7 · Neon PostgreSQL · Zod

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` with a Neon PostgreSQL connection string:

```env
DATABASE_URL="postgresql://..."
```

3. Apply the existing Prisma migration:

```bash
npx prisma migrate deploy
npx prisma generate
```

4. Seed the starter employer registry and candidate profile:

```bash
npm run seed:companies
npm run seed:profile
```

5. Collect and score jobs:

```bash
npm run refresh
```

6. Start the product:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful commands

```bash
npm run scrape          # collect jobs from every enabled company
npm run score           # score stored open jobs against CandidateProfile
npm run refresh         # scrape, then score
npm run seed:companies  # seed Figma + Mama Money examples
npm run seed:profile    # create/update the starter matching profile
npm run typecheck       # TypeScript validation
npm run lint            # ESLint
npm test                # deterministic matcher tests
```

## Data flow

```text
Company registry
  → scraper registry
  → Greenhouse / Lever / structured HTML
  → Zod validation
  → normalization + fingerprint
  → Neon PostgreSQL
  → deterministic scoring
  → dashboard / jobs / applications / analytics
```

## Matching model

V1 deliberately does **not** require an LLM. The score is explainable and based on:

- technology overlap — 30 points
- role/title relevance — 20 points
- experience compatibility — 15 points
- location/remote compatibility — 15 points
- education compatibility — 10 points
- direct application source — 10 points

Hard filters are separate and intentionally conservative. Scoring data is stored with each job so the UI can explain why a vacancy ranked where it did.

## Responsible scraping

Alchemy prefers public ATS endpoints over HTML scraping. The structured HTML fallback only reads public schema.org `JobPosting` JSON-LD from a supplied career page; it does not execute JavaScript or bypass access controls. External-source failures are isolated so one employer cannot terminate a full collection run.

## Adding an employer

Use **Companies** in the UI:

- **Greenhouse** — supply the real board token.
- **Lever** — supply the real postings token.
- **Structured HTML** — no token required; the page must expose schema.org `JobPosting` JSON-LD.

Then run `npm run refresh`.

## Job lifecycle

Every successful sighting refreshes `lastSeenAt`. A vacancy is only marked `CLOSED` after a successful source scrape and a 72-hour grace period. If a closed vacancy reappears, it returns to `NEW`; user decisions such as `SHORTLISTED` and `REJECTED` are never reset by an ordinary refresh.

## Deployment and scheduling

Set `DATABASE_URL` in the deployment environment. The scheduled GitHub Actions workflow runs at 04:00, 10:00 and 16:00 UTC (06:00, 12:00 and 18:00 South Africa time) and requires a repository secret named `DATABASE_URL`. If the secret is absent, the workflow exits safely without scraping.

## Intentional V1 boundary

Playwright remains a last-resort adapter for career sites that require JavaScript execution. It is intentionally not activated until a real target employer proves the lighter API/structured-data paths are insufficient. No CAPTCHA bypass, proxy rotation, fingerprint spoofing or mass-application automation is part of this project.

<!-- Vercel CI/CD verification -->
