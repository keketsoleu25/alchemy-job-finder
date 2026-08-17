import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { JobCard } from "@/components/job-card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const profile = await prisma.candidateProfile.findFirst({ orderBy: { createdAt: "asc" } });
  const threshold = profile?.minimumScore ?? 65;

  const [todayCount, strongCount, applicationsWeek, interviews, applyToday, latestCompanies] = await Promise.all([
    prisma.job.count({ where: { firstSeenAt: { gte: startOfToday }, status: { not: "CLOSED" } } }),
    prisma.job.count({ where: { matchScore: { gte: threshold }, status: { not: "CLOSED" } } }),
    prisma.jobApplication.count({ where: { appliedAt: { gte: startOfWeek } } }),
    prisma.jobApplication.count({ where: { status: "INTERVIEW" } }),
    prisma.job.findMany({
      where: { status: { notIn: ["CLOSED", "REJECTED"] }, matchScore: { gte: threshold } },
      include: { company: { select: { name: true } } },
      orderBy: [{ matchScore: "desc" }, { firstSeenAt: "desc" }],
      take: 6,
    }),
    prisma.company.findMany({
      where: { enabled: true },
      orderBy: [{ lastSuccessfulScrapeAt: "desc" }, { priority: "desc" }],
      take: 4,
    }),
  ]);

  return (
    <div className="stack-xl">
      <section className="hero-panel">
        <div>
          <span className="eyebrow accent">TODAY'S SEARCH</span>
          <h1>Find the jobs worth your energy.</h1>
          <p>Alchemy turns noisy vacancy feeds into a ranked shortlist you can act on.</p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href="/jobs">Explore all jobs</Link>
          <Link className="button ghost" href="/settings">Tune matching</Link>
        </div>
      </section>

      <section className="metric-grid" aria-label="Job search metrics">
        <Metric label="Discovered today" value={todayCount} hint="Fresh opportunities" />
        <Metric label="Strong matches" value={strongCount} hint={`Score ≥ ${threshold}%`} />
        <Metric label="Applications / 7d" value={applicationsWeek} hint="Your active output" />
        <Metric label="Interviews" value={interviews} hint="Current pipeline" />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow accent">APPLY TODAY</span>
            <h2>Best opportunities first</h2>
            <p>Ranked by role, skills, experience, location and direct-application quality.</p>
          </div>
          <Link className="text-link" href="/jobs?sort=match">View every match →</Link>
        </div>

        {applyToday.length ? (
          <div className="job-grid">
            {applyToday.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No scored strong matches yet.</strong>
            <p>Run the profile seed and scoring pipeline, then your ranked shortlist will appear here.</p>
            <code>npm run seed:profile && npm run score</code>
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
          <h2>Work the shortlist, not the whole internet.</h2>
          <p>Review high matches, shortlist the good ones, then track each application through screening and interview.</p>
          <Link className="button primary" href="/applications">Open application pipeline</Link>
        </div>
      </section>
    </div>
  );
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
