# Alchemy Job Finder 🇿🇦⚗️

**Smarter jobs. Better decisions. South Africa.**

Alchemy Job Finder is a South Africa-aware job-intelligence platform built to reduce wasted applications. It collects direct employer vacancies, normalizes and deduplicates them, evaluates fit against a configurable candidate profile, explains whether a role deserves attention, and turns application tracking into a next-action workflow.

## Product pipeline

```text
Candidate profile
  → South African + direct employer sources
  → validation / normalization / deduplication
  → eligibility analysis
  → deterministic SA-aware matching
  → Should-I-Apply reasoning
  → Application Intelligence
  → application tracking
  → market + conversion analytics
```

## Current capabilities

### Job discovery and source health
- Direct Greenhouse Job Board collection
- Direct Lever Postings collection
- Dependency-free schema.org `JobPosting` career-page fallback
- South African source seeding and verification commands
- Zod validation at scraper boundaries
- Stable fingerprint-based deduplication
- Controlled database write concurrency
- Per-company failure isolation and source health tracking
- 72-hour grace period before stale vacancies are marked closed

### Matching and decision intelligence
- Configurable candidate profile
- Deterministic, explainable job scoring
- Skill and experience extraction
- Conservative hard filters
- Eligibility verdicts: **APPLY / MAYBE / SKIP**
- Ranked **Apply Today** dashboard
- Filterable job explorer and job-detail review view
- Stored match explanations for auditability

### Application Intelligence
- Application readiness score and preparation checklist
- Tailored CV / cover-letter version references
- Next-best action engine: **PREPARE / APPLY NOW / FOLLOW UP / FOCUS STAGE / WAIT / ARCHIVE**
- Follow-up radar using deterministic stage-aware windows
- Priority-ranked application action queue
- Recruitment pipeline from planned application through offer
- Closed-application archive
- Application notes and stage history timestamps
- Deterministic tests for readiness, follow-up and next-action decisions

### Analytics and operations
- Market and skill-gap analytics
- Application-funnel and conversion analytics
- Company/source management with enable/disable controls
- Scheduled refresh workflow
- TypeScript, ESLint and deterministic test commands

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma 7 · Neon PostgreSQL · Zod

## Setup

1. Install dependencies.

```bash
npm install
```

2. Create `.env` with a Neon PostgreSQL connection string.

```env
DATABASE_URL="postgresql://..."
```

3. Apply the Prisma migrations and generate the client.

```bash
npx prisma migrate deploy
npx prisma generate
```

4. Seed the candidate profile and sources.

```bash
npm run seed:profile
npm run seed:sa
```

5. Verify sources, collect vacancies and score them.

```bash
npm run verify:sa-sources
npm run refresh
```

Or run the South Africa discovery pipeline in one command:

```bash
npm run hunt:sa
```

6. Start the application.

```bash
npm run dev
```

Open `http://localhost:3000`.

## Quality commands

```bash
npm run typecheck       # TypeScript validation
npm run lint            # ESLint
npm test                # deterministic intelligence/matcher tests
npm run build           # Prisma generation + production Next.js build
```

## Data flow

```text
Company registry
  → scraper registry
  → Greenhouse / Lever / structured HTML
  → Zod validation
  → normalization + fingerprint
  → Neon PostgreSQL
  → eligibility + deterministic scoring
  → Apply Today / jobs
  → Application Intelligence
  → applications / analytics
```

## Matching model

The matching layer deliberately does **not** require an LLM. Its score is explainable and based on:

- technology overlap — 30 points
- role/title relevance — 20 points
- experience compatibility — 15 points
- location/remote compatibility — 15 points
- education compatibility — 10 points
- direct application source — 10 points

Hard filters remain separate and intentionally conservative. Match data is stored with each job so the UI can explain why a vacancy ranked where it did.

## Application Intelligence model

Application Intelligence is an operational decision layer, not a prediction that an employer will hire the candidate. It combines:

- job-fit verdict and match score
- tailored CV readiness
- cover-letter / motivation readiness
- saved application context
- current recruitment stage
- time since submission or stage movement

The resulting next action is deterministic and testable. A prepared planned application can become **APPLY NOW**; an unchanged submitted application can become **FOLLOW UP**; an active interview becomes **FOCUS STAGE**; terminal records become **ARCHIVE**.

## Responsible scraping

Alchemy prefers public ATS endpoints over HTML scraping. The structured HTML fallback only reads public schema.org `JobPosting` JSON-LD from a supplied career page; it does not execute JavaScript or bypass access controls. External-source failures are isolated so one employer cannot terminate a full collection run.

Playwright remains a last-resort adapter for career sites that genuinely require JavaScript execution. No CAPTCHA bypass, proxy rotation, fingerprint spoofing or mass-application automation is part of the project.

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

## Product boundary

Alchemy Job Finder is designed to improve decision quality and application discipline. It does not auto-submit job applications, fabricate candidate information, bypass employer protections, or promise employment outcomes.

## Version direction

- **v0.1** — direct employer collection, normalization and deterministic matching
- **v0.2** — South Africa Intelligence + Apply Today + Application Intelligence
- **v0.3** — next-best application actions, stronger tests and operational hardening

Built as a Tech Alchemy Lab portfolio product and practical job-search operating system.
