import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { discoveredSinceDays } from "@/lib/discovered-since";
import { readSAInsight } from "@/jobs/market";

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
  const skill = getParam(search, "skill").trim();
  const companyId = getParam(search, "companyId");
  const verdict = getParam(search, "verdict");
  const province = getParam(search, "province");
  const careerLevel = getParam(search, "careerLevel");
  const days = Number(getParam(search, "days") || 0);
  const minScore = Number(getParam(search, "minScore") || 0);
  const sort = getParam(search, "sort") || "match";
  const discoveredAfter = discoveredSinceDays(days);

  const [companies, rawJobs] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.job.findMany({
      where: {
        ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { company: { name: { contains: q, mode: "insensitive" } } }, { location: { contains: q, mode: "insensitive" } }] } : {}),
        ...(status ? { status: status as "NEW" | "REVIEW" | "SHORTLISTED" | "REJECTED" | "CLOSED" } : {}),
        ...(source ? { source: source as "GREENHOUSE" | "LEVER" | "COMPANY_SITE" } : {}),
        ...(remote === "yes" ? { remote: true } : {}),
        ...(companyId ? { companyId } : {}),
        ...(skill ? { matchedSkills: { has: skill } } : {}),
        ...(discoveredAfter ? { firstSeenAt: { gte: discoveredAfter } } : {}),
        ...(Number.isFinite(minScore) && minScore > 0 ? { matchScore: { gte: minScore } } : {}),
      },
      include: { company: { select: { name: true } }, application: { select: { status: true } } },
      orderBy: sort === "newest" ? [{ firstSeenAt: "desc" }] : sort === "company" ? [{ company: { name: "asc" } }, { matchScore: "desc" }] : [{ matchScore: { sort: "desc", nulls: "last" } }, { firstSeenAt: "desc" }],
      take: 500,
    }),
  ]);

  const jobs = rawJobs.filter((job) => {
    const insight = readSAInsight(job.matchData);
    if (verdict && insight.eligibility?.verdict !== verdict) return false;
    if (province && insight.sa?.province !== province) return false;
    if (careerLevel && insight.sa?.careerLevel !== careerLevel) return false;
    return true;
  }).slice(0, 250);

  const provinceOptions = [...new Set(rawJobs.map((job) => readSAInsight(job.matchData).sa?.province).filter((value): value is string => Boolean(value)))].sort();
  const careerOptions = [...new Set(rawJobs.map((job) => readSAInsight(job.matchData).sa?.careerLevel).filter((value): value is string => Boolean(value) && value !== "UNKNOWN"))].sort();

  return (
    <div className="stack-xl">
      <section className="page-heading"><div><span className="eyebrow accent">🇿🇦 SA JOB EXPLORER</span><h1>Every opportunity, under control.</h1><p>Filter by fit, province, career level and Alchemy's apply verdict — not just keywords.</p></div><span className="count-chip">{jobs.length} results</span></section>
      <form className="filter-bar" action="/jobs">
        <input className="field grow" name="q" defaultValue={q} placeholder="Search role, company or location" />
        <select className="field" name="verdict" defaultValue={verdict}><option value="">Any verdict</option><option value="APPLY">Apply</option><option value="MAYBE">Maybe</option><option value="SKIP">Skip</option></select>
        <select className="field" name="province" defaultValue={province}><option value="">All provinces</option>{provinceOptions.map((item) => <option value={item} key={item}>{item}</option>)}</select>
        <select className="field" name="careerLevel" defaultValue={careerLevel}><option value="">Any career level</option>{careerOptions.map((item) => <option value={item} key={item}>{item.toLowerCase().replaceAll("_", " ")}</option>)}</select>
        <input className="field" name="skill" defaultValue={skill} placeholder="Matched skill" />
        <select className="field" name="companyId" defaultValue={companyId}><option value="">All companies</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select>
        <select className="field" name="status" defaultValue={status}><option value="">All statuses</option><option value="NEW">New</option><option value="REVIEW">Review</option><option value="SHORTLISTED">Shortlisted</option><option value="REJECTED">Rejected</option><option value="CLOSED">Closed</option></select>
        <select className="field" name="source" defaultValue={source}><option value="">All sources</option><option value="GREENHOUSE">Greenhouse</option><option value="LEVER">Lever</option><option value="COMPANY_SITE">Company site</option></select>
        <select className="field" name="remote" defaultValue={remote}><option value="">Any workplace</option><option value="yes">Remote-friendly</option></select>
        <select className="field" name="days" defaultValue={String(days || "")}><option value="">Any discovery date</option><option value="1">Found today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>
        <select className="field" name="minScore" defaultValue={String(minScore || "")}><option value="">Any score</option><option value="65">65%+</option><option value="80">80%+</option><option value="90">90%+</option></select>
        <select className="field" name="sort" defaultValue={sort}><option value="match">Best match</option><option value="newest">Newest</option><option value="company">Company</option></select>
        <button className="button primary" type="submit">Filter</button><Link className="button ghost" href="/jobs">Clear</Link>
      </form>
      <div className="table-shell"><div className="job-table header-row"><span>Opportunity</span><span>Match</span><span>Location</span><span>Verdict</span><span>Status</span><span /></div>
        {jobs.map((job) => {
          const insight = readSAInsight(job.matchData);
          return <div className="job-table" key={job.id}><div className="table-title"><strong>{job.title}</strong><span>{job.company.name}{insight.sa?.careerLevel && insight.sa.careerLevel !== "UNKNOWN" ? ` · ${insight.sa.careerLevel.toLowerCase()}` : ""}</span></div><span className={`match-badge ${(job.matchScore ?? 0) >= 80 ? "high" : (job.matchScore ?? 0) >= 65 ? "mid" : "low"}`}>{job.matchScore == null ? "—" : `${job.matchScore}%`}</span><span className="muted">{job.remote ? "Remote-friendly" : insight.sa?.city || job.location || "Not listed"}</span><span className="status-badge">{insight.eligibility?.verdict ?? "—"}</span><span className="status-badge">{job.application?.status ?? job.status}</span><Link className="text-link" href={`/jobs/${job.id}`}>Open →</Link></div>;
        })}
        {!jobs.length ? <div className="empty-state"><strong>No jobs match those filters.</strong><p>Clear a filter or run a fresh scrape and score.</p></div> : null}
      </div>
    </div>
  );
}
