import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { startOfSastDayUtc } from "@/lib/time";
import { JobCard } from "@/components/job-card";
import { daysUntilClosing, getApplicationUrgency, rankApplyToday, readClosingDate } from "@/jobs/sa-urgency";

export const dynamic = "force-dynamic";

export default async function Home() {
  const now = new Date();
  const startOfToday = startOfSastDayUtc();
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const profile = await prisma.candidateProfile.findFirst({ orderBy: { createdAt: "asc" } });
  const threshold = profile?.minimumScore ?? 65;

  const [todayCount, strongCount, applicationsWeek, interviews, applyCandidates, latestCompanies] = await Promise.all([
    prisma.job.count({ where: { firstSeenAt: { gte: startOfToday }, status: { not: "CLOSED" } } }),
    prisma.job.count({ where: { matchScore: { gte: threshold }, status: { not: "CLOSED" } } }),
    prisma.jobApplication.count({ where: { appliedAt: { gte: startOfWeek } } }),
    prisma.jobApplication.count({ where: { status: "INTERVIEW" } }),
    prisma.job.findMany({
      where: { status: { notIn: ["CLOSED", "REJECTED"] }, matchScore: { gte: Math.max(45, threshold - 20) } },
      include: { company: { select: { name: true } } },
      orderBy: [{ firstSeenAt: "desc" }],
      take: 50,
    }),
    prisma.company.findMany({
      where: { enabled: true },
      orderBy: [{ lastSuccessfulScrapeAt: "desc" }, { priority: "desc" }],
      take: 4,
    }),
  ]);

  const rankedCandidates = rankApplyToday(applyCandidates, now);
  const applyToday = rankedCandidates.slice(0, 6);
  const closingSoonCount = rankedCandidates.filter((job) => {
    const urgency = getApplicationUrgency(readClosingDate(job.matchData), now);
    return urgency === "TODAY" || urgency === "URGENT" || urgency === "SOON";
  }).length;

  return (
    <div className="stack-xl">
      <section className="hero-panel">
        <div>
          <span className="eyebrow accent">SA OPPORTUNITY RADAR</span>
          <h1>Know what deserves an application today.</h1>
          <p>Alchemy now weighs fit, SA eligibility, freshness and closing-date urgency before it asks for your energy.</p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href="/jobs">Explore all jobs</Link>
          <Link className="button ghost" href="/settings">Tune matching</Link>
        </div>
      </section>

      <section className="metric-grid" aria-label="Job search metrics">
        <Metric label="Discovered today" value={todayCount} hint="Fresh opportunities" />
        <Metric label="Strong matches" value={strongCount} hint={`Score ≥ ${threshold}%`} />
        <Metric label="Closing soon" value={closingSoonCount} hint="Within 7 days" />
        <Metric label="Applications / 7d" value={applicationsWeek} hint={`${interviews} active interview${interviews === 1 ? "" : "s"}`} />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow accent">APPLY TODAY</span>
            <h2>Action priority, not just match score</h2>
            <p>APPLY verdicts, South African relevance, graduate/junior fit, freshness and closing dates now influence the queue.</p>
          </div>
          <Link className="text-link" href="/jobs?verdict=APPLY">View APPLY opportunities →</Link>
        </div>

        {applyToday.length ? (
          <div className="job-grid">
            {applyToday.map((job) => (
              <div className="stack-sm" key={job.id}>
                <RadarSignal matchData={job.matchData} now={now} />
                <JobCard job={job} />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No actionable matches yet.</strong>
            <p>Run the SA hunt and scoring pipeline so Alchemy can build the priority queue.</p>
            <code>npm run hunt:sa</code>
          </div>
        )}
      </section>

      <section className="split-grid">
        <div className="panel">
          <div className="section-heading compact">
            <div><span className="eyebrow">COLLECTION</span><h2>Source health</h2></div>
            <Link className="text-link" href="/companies">Manage →</Link>
          </div>
          <div className="source-list">
            {latestCompanies.map((company) => (
              <div className="source-row" key={company.id}>
                <div><strong>{company.name}</strong><span>{company.scraperType}</span></div>
                <span className={company.lastError ? "health bad" : "health good"}>
                  {company.lastError ? "Needs attention" : "Healthy"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel focus-panel">
          <span className="eyebrow accent">NEXT MOVE</span>
          <h2>Move before the closing date does.</h2>
          <p>Use the radar as a decision queue: review the urgent APPLY roles first, tailor the application, then track the result.</p>
          <Link className="button primary" href="/applications">Open application pipeline</Link>
        </div>
      </section>
    </div>
  );
}

function RadarSignal({ matchData, now }: { matchData: unknown; now: Date }) {
  const closingDate = readClosingDate(matchData);
  const urgency = getApplicationUrgency(closingDate, now);
  const days = daysUntilClosing(closingDate, now);
  if (urgency === "UNKNOWN" || urgency === "OPEN") return null;

  const label = urgency === "TODAY"
    ? "Closes today"
    : urgency === "URGENT"
      ? `Urgent · ${days} day${days === 1 ? "" : "s"} left`
      : urgency === "SOON"
        ? `Closing soon · ${days} days left`
        : "Closing date passed";

  return <span className={`status-badge ${urgency === "CLOSED" ? "danger" : ""}`}>{label}</span>;
}

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}
