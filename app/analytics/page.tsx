import { prisma } from "@/lib/db/prisma";
import { countBy, formatZAR, median, readSAInsight } from "@/jobs/market";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [jobs, applications, profile] = await Promise.all([
    prisma.job.findMany({
      where: { status: { not: "CLOSED" } },
      select: {
        matchedSkills: true,
        missingSkills: true,
        remote: true,
        matchScore: true,
        matchData: true,
        company: { select: { name: true } },
      },
    }),
    prisma.jobApplication.findMany({ select: { status: true } }),
    prisma.candidateProfile.findFirst({ orderBy: { createdAt: "asc" }, select: { minimumScore: true } }),
  ]);

  const threshold = profile?.minimumScore ?? 65;
  const gapFloor = Math.max(40, threshold - 10);
  const skillCounts = new Map<string, number>();
  const gapCounts = new Map<string, number>();
  const companyCounts = new Map<string, number>();

  for (const job of jobs) {
    for (const skill of [...job.matchedSkills, ...job.missingSkills]) {
      skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
    }

    if ((job.matchScore ?? 0) >= gapFloor) {
      for (const skill of job.missingSkills) {
        gapCounts.set(skill, (gapCounts.get(skill) ?? 0) + 1);
      }
    }

    companyCounts.set(job.company.name, (companyCounts.get(job.company.name) ?? 0) + 1);
  }

  const top = (map: Map<string, number>, limit = 8) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const topSkills = top(skillCounts);
  const skillGaps = top(gapCounts);
  const activeCompanies = top(companyCounts, 6);
  const remoteCount = jobs.filter((job) => job.remote).length;
  const strongCount = jobs.filter((job) => (job.matchScore ?? 0) >= threshold).length;
  const funnel = ["APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER"].map((status) => [status, applications.filter((item) => item.status === status).length] as const);
  const maxSkill = Math.max(1, ...topSkills.map(([, count]) => count));
  const maxGap = Math.max(1, ...skillGaps.map(([, count]) => count));

  const submitted = applications.filter((item) => !["PLANNED", "WITHDRAWN"].includes(item.status)).length;
  const progressed = applications.filter((item) => ["SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER"].includes(item.status)).length;
  const interviewed = applications.filter((item) => ["INTERVIEW", "OFFER"].includes(item.status)).length;
  const offers = applications.filter((item) => item.status === "OFFER").length;
  const progressionRate = submitted ? Math.round((progressed / submitted) * 100) : 0;
  const interviewRate = submitted ? Math.round((interviewed / submitted) * 100) : 0;
  const offerRate = submitted ? Math.round((offers / submitted) * 100) : 0;

  const insights = jobs.map((job) => readSAInsight(job.matchData));
  const saInsights = insights.filter((insight) => insight.sa?.country === "ZA");
  const applyCount = insights.filter((insight) => insight.eligibility?.verdict === "APPLY").length;
  const maybeCount = insights.filter((insight) => insight.eligibility?.verdict === "MAYBE").length;
  const skipCount = insights.filter((insight) => insight.eligibility?.verdict === "SKIP").length;
  const provinceCounts = countBy(saInsights.map((insight) => insight.sa?.province)).slice(0, 6);
  const careerCounts = countBy(saInsights.map((insight) => insight.sa?.careerLevel).filter((value) => value && value !== "UNKNOWN")).slice(0, 6);
  const salaryValues = saInsights.flatMap((insight) => {
    const salary = insight.sa?.salary;
    if (!salary) return [];
    if (salary.minMonthly != null && salary.maxMonthly != null) return [Math.round((salary.minMonthly + salary.maxMonthly) / 2)];
    if (salary.minMonthly != null) return [salary.minMonthly];
    if (salary.maxMonthly != null) return [salary.maxMonthly];
    return [];
  });
  const medianMonthlySalary = median(salaryValues);
  const maxProvince = Math.max(1, ...provinceCounts.map(([, count]) => count));
  const maxCareer = Math.max(1, ...careerCounts.map(([, count]) => count));

  return (
    <div className="stack-xl">
      <section className="page-heading">
        <div>
          <span className="eyebrow accent">🇿🇦 SA MARKET + APPLICATION INTELLIGENCE</span>
          <h1>Measure the market and your conversion through it.</h1>
          <p>Demand, fit, salary signals and application conversion from the vacancies Alchemy already collected.</p>
        </div>
      </section>

      <section className="metric-grid">
        <Metric label="SA vacancies" value={saInsights.length} suffix="" hint="Detected South African market" />
        <Metric label="Apply now" value={applyCount} suffix="" hint="Alchemy verdict: APPLY" />
        <Metric label="Strong matches" value={strongCount} suffix="" hint={`Score ≥ ${threshold}%`} />
        <Metric label="Median salary" value={medianMonthlySalary == null ? "—" : formatZAR(medianMonthlySalary)} suffix={medianMonthlySalary == null ? "" : "/mo"} hint={`${salaryValues.length} disclosed salary signals`} />
      </section>

      <section className="metric-grid">
        <Metric label="Submitted" value={submitted} suffix="" hint="Entered the application funnel" />
        <Metric label="Progression rate" value={progressionRate} suffix="%" hint="Reached screening or better" />
        <Metric label="Interview rate" value={interviewRate} suffix="%" hint="Reached interview or offer" />
        <Metric label="Offer rate" value={offerRate} suffix="%" hint="Offers / submitted" />
      </section>

      <section className="analytics-grid">
        <article className="panel">
          <span className="eyebrow accent">SA OPPORTUNITY MAP</span>
          <h2>Where the vacancies are</h2>
          <p className="muted">Province signals detected from current South African roles.</p>
          <div className="bar-list">
            {provinceCounts.map(([province, count]) => <Bar key={province} label={province} count={count} max={maxProvince} />)}
            {!provinceCounts.length ? <p className="muted">Run scoring to populate South African province intelligence.</p> : null}
          </div>
        </article>

        <article className="panel">
          <span className="eyebrow">CAREER LEVEL</span>
          <h2>Where the market is hiring</h2>
          <p className="muted">Graduate, junior, intermediate and senior signals from SA job copy.</p>
          <div className="bar-list">
            {careerCounts.map(([level, count]) => <Bar key={level} label={level} count={count} max={maxCareer} />)}
            {!careerCounts.length ? <p className="muted">No career-level signals yet.</p> : null}
          </div>
        </article>
      </section>

      <section className="split-grid">
        <article className="panel">
          <span className="eyebrow accent">SHOULD I APPLY?</span>
          <h2>Actionable verdicts</h2>
          <div className="funnel-list">
            <div className="funnel-row"><span>01</span><strong>APPLY</strong><b>{applyCount}</b></div>
            <div className="funnel-row"><span>02</span><strong>MAYBE</strong><b>{maybeCount}</b></div>
            <div className="funnel-row"><span>03</span><strong>SKIP</strong><b>{skipCount}</b></div>
          </div>
        </article>

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
          <p className="muted">Based on roles scoring at least {gapFloor}%, so the learning signal stays relevant.</p>
          <div className="bar-list">
            {skillGaps.map(([skill, count]) => <Bar key={skill} label={skill} count={count} max={maxGap} />)}
            {!skillGaps.length ? <p className="muted">No relevant gap data yet.</p> : null}
          </div>
        </article>
      </section>

      <section className="split-grid">
        <article className="panel">
          <span className="eyebrow">EMPLOYERS</span>
          <h2>Most active sources</h2>
          <div className="source-list">
            {activeCompanies.map(([company, count]) => (
              <div className="source-row" key={company}><div><strong>{company}</strong><span>Open vacancies</span></div><b>{count}</b></div>
            ))}
          </div>
        </article>

        <article className="panel">
          <span className="eyebrow">WORK MODE</span>
          <h2>Remote signal</h2>
          <p className="muted">{jobs.length ? Math.round((remoteCount / jobs.length) * 100) : 0}% of the current dataset is remote-friendly.</p>
          <div className="source-list">
            <div className="source-row"><div><strong>Remote-friendly</strong><span>Current vacancies</span></div><b>{remoteCount}</b></div>
            <div className="source-row"><div><strong>On-site / unspecified</strong><span>Current vacancies</span></div><b>{Math.max(0, jobs.length - remoteCount)}</b></div>
            <div className="source-row"><div><strong>Applications tracked</strong><span>Current pipeline</span></div><b>{applications.length}</b></div>
          </div>
        </article>
      </section>
    </div>
  );
}

function Metric({ label, value, suffix, hint = "Current dataset" }: { label: string; value: number | string; suffix: string; hint?: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}{suffix}</strong><small>{hint}</small></article>;
}

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <div className="bar-row">
      <div><span>{label}</span><strong>{count}</strong></div>
      <div className="bar-track"><span style={{ width: `${Math.max(6, Math.round((count / max) * 100))}%` }} /></div>
    </div>
  );
}
