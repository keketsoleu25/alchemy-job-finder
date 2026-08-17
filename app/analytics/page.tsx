import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [jobs, applications] = await Promise.all([
    prisma.job.findMany({
      where: { status: { not: "CLOSED" } },
      select: { matchedSkills: true, missingSkills: true, remote: true, matchScore: true, company: { select: { name: true } } },
    }),
    prisma.jobApplication.findMany({ select: { status: true } }),
  ]);

  const skillCounts = new Map<string, number>();
  const gapCounts = new Map<string, number>();
  const companyCounts = new Map<string, number>();

  for (const job of jobs) {
    for (const skill of [...job.matchedSkills, ...job.missingSkills]) skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
    for (const skill of job.missingSkills) gapCounts.set(skill, (gapCounts.get(skill) ?? 0) + 1);
    companyCounts.set(job.company.name, (companyCounts.get(job.company.name) ?? 0) + 1);
  }

  const top = (map: Map<string, number>, limit = 8) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const topSkills = top(skillCounts);
  const skillGaps = top(gapCounts);
  const activeCompanies = top(companyCounts, 6);
  const remoteCount = jobs.filter((job) => job.remote).length;
  const strongCount = jobs.filter((job) => (job.matchScore ?? 0) >= 65).length;
  const funnel = ["APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER"].map((status) => [status, applications.filter((item) => item.status === status).length] as const);
  const maxSkill = Math.max(1, ...topSkills.map(([, count]) => count));
  const maxGap = Math.max(1, ...skillGaps.map(([, count]) => count));

  return (
    <div className="stack-xl">
      <section className="page-heading">
        <div>
          <span className="eyebrow accent">MARKET INTELLIGENCE</span>
          <h1>Let the vacancies tell you what matters.</h1>
          <p>See demand, skill gaps and your application conversion from the data Alchemy already collected.</p>
        </div>
      </section>

      <section className="metric-grid">
        <Metric label="Open jobs" value={jobs.length} suffix="" />
        <Metric label="Strong matches" value={strongCount} suffix="" />
        <Metric label="Remote-friendly" value={jobs.length ? Math.round((remoteCount / jobs.length) * 100) : 0} suffix="%" />
        <Metric label="Applications tracked" value={applications.length} suffix="" />
      </section>

      <section className="analytics-grid">
        <article className="panel">
          <span className="eyebrow accent">MARKET DEMAND</span>
          <h2>Most requested technologies</h2>
          <p className="muted">Detected across current vacancies.</p>
          <div className="bar-list">
            {topSkills.map(([skill, count]) => <Bar key={skill} label={skill} count={count} max={maxSkill} />)}
            {!topSkills.length ? <p className="muted">Run scoring to populate technology demand.</p> : null}
          </div>
        </article>

        <article className="panel">
          <span className="eyebrow">SKILL GAP</span>
          <h2>What appears outside your profile</h2>
          <p className="muted">Use this to decide what is worth learning next.</p>
          <div className="bar-list">
            {skillGaps.map(([skill, count]) => <Bar key={skill} label={skill} count={count} max={maxGap} />)}
            {!skillGaps.length ? <p className="muted">No gap data yet.</p> : null}
          </div>
        </article>
      </section>

      <section className="split-grid">
        <article className="panel">
          <span className="eyebrow">APPLICATION FUNNEL</span>
          <h2>From apply to offer</h2>
          <div className="funnel-list">
            {funnel.map(([stage, count], index) => (
              <div className="funnel-row" key={stage}>
                <span>{String(index + 1).padStart(2, "0")}</span><strong>{stage}</strong><b>{count}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <span className="eyebrow">EMPLOYERS</span>
          <h2>Most active sources</h2>
          <div className="source-list">
            {activeCompanies.map(([company, count]) => (
              <div className="source-row" key={company}><div><strong>{company}</strong><span>Open vacancies</span></div><b>{count}</b></div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function Metric({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}{suffix}</strong><small>Current dataset</small></article>;
}

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <div className="bar-row">
      <div><span>{label}</span><strong>{count}</strong></div>
      <div className="bar-track"><span style={{ width: `${Math.max(6, Math.round((count / max) * 100))}%` }} /></div>
    </div>
  );
}
