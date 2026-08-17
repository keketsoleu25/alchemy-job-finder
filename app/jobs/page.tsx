import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function getParam(search: Search, key: string): string {
  const value = search[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const q = getParam(search, "q").trim();
  const status = getParam(search, "status");
  const source = getParam(search, "source");
  const remote = getParam(search, "remote");
  const minScore = Number(getParam(search, "minScore") || 0);
  const sort = getParam(search, "sort") || "match";

  const jobs = await prisma.job.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { company: { name: { contains: q, mode: "insensitive" } } },
              { location: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(status ? { status: status as "NEW" | "REVIEW" | "SHORTLISTED" | "REJECTED" | "CLOSED" } : {}),
      ...(source ? { source: source as "GREENHOUSE" | "LEVER" | "COMPANY_SITE" } : {}),
      ...(remote === "yes" ? { remote: true } : {}),
      ...(Number.isFinite(minScore) && minScore > 0 ? { matchScore: { gte: minScore } } : {}),
    },
    include: { company: { select: { name: true } }, application: { select: { status: true } } },
    orderBy:
      sort === "newest"
        ? [{ firstSeenAt: "desc" }]
        : sort === "company"
          ? [{ company: { name: "asc" } }, { matchScore: "desc" }]
          : [{ matchScore: { sort: "desc", nulls: "last" } }, { firstSeenAt: "desc" }],
    take: 250,
  });

  return (
    <div className="stack-xl">
      <section className="page-heading">
        <div>
          <span className="eyebrow accent">JOB EXPLORER</span>
          <h1>Every opportunity, under control.</h1>
          <p>Search, filter and move only the right vacancies into your application pipeline.</p>
        </div>
        <span className="count-chip">{jobs.length} results</span>
      </section>

      <form className="filter-bar" action="/jobs">
        <input className="field grow" name="q" defaultValue={q} placeholder="Search role, company or location" />
        <select className="field" name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="NEW">New</option>
          <option value="REVIEW">Review</option>
          <option value="SHORTLISTED">Shortlisted</option>
          <option value="REJECTED">Rejected</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select className="field" name="source" defaultValue={source}>
          <option value="">All sources</option>
          <option value="GREENHOUSE">Greenhouse</option>
          <option value="LEVER">Lever</option>
          <option value="COMPANY_SITE">Company site</option>
        </select>
        <select className="field" name="remote" defaultValue={remote}>
          <option value="">Any workplace</option>
          <option value="yes">Remote-friendly</option>
        </select>
        <select className="field" name="minScore" defaultValue={String(minScore || "")}>
          <option value="">Any score</option>
          <option value="65">65%+</option>
          <option value="80">80%+</option>
          <option value="90">90%+</option>
        </select>
        <select className="field" name="sort" defaultValue={sort}>
          <option value="match">Best match</option>
          <option value="newest">Newest</option>
          <option value="company">Company</option>
        </select>
        <button className="button primary" type="submit">Filter</button>
      </form>

      <div className="table-shell">
        <div className="job-table header-row">
          <span>Opportunity</span><span>Match</span><span>Location</span><span>Status</span><span>Source</span><span />
        </div>
        {jobs.map((job) => (
          <div className="job-table" key={job.id}>
            <div className="table-title">
              <strong>{job.title}</strong>
              <span>{job.company.name}</span>
            </div>
            <span className={`match-badge ${(job.matchScore ?? 0) >= 80 ? "high" : (job.matchScore ?? 0) >= 65 ? "mid" : "low"}`}>
              {job.matchScore == null ? "—" : `${job.matchScore}%`}
            </span>
            <span className="muted">{job.remote ? "Remote-friendly" : job.location || "Not listed"}</span>
            <span className="status-badge">{job.application?.status ?? job.status}</span>
            <span className="muted">{job.source}</span>
            <Link className="text-link" href={`/jobs/${job.id}`}>Open →</Link>
          </div>
        ))}
        {!jobs.length ? <div className="empty-state"><strong>No jobs match those filters.</strong><p>Clear a filter or run a fresh scrape.</p></div> : null}
      </div>
    </div>
  );
}
