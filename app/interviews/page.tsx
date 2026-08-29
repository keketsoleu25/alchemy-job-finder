import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getInterviewPrep, type InterviewStage } from "@/lib/interview-intelligence";

export const dynamic = "force-dynamic";

type MatchData = {
  sa?: { careerLevel?: string };
};

export default async function InterviewsPage() {
  const applications = await prisma.jobApplication.findMany({
    where: { status: { in: ["SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER"] } },
    include: { job: { include: { company: { select: { name: true } } } } },
    orderBy: { updatedAt: "desc" },
  });

  const items = applications.map((application) => {
    const match = (application.job.matchData ?? {}) as unknown as MatchData;
    const prep = getInterviewPrep({
      title: application.job.title,
      company: application.job.company.name,
      stage: application.status as InterviewStage,
      matchScore: application.job.matchScore,
      matchedSkills: application.job.matchedSkills,
      missingSkills: application.job.missingSkills,
      notes: application.notes,
      resumeVersion: application.resumeVersion,
      careerLevel: match.sa?.careerLevel,
    });
    return { application, prep };
  }).sort((a, b) => {
    const stageWeight = (status: string) => status === "INTERVIEW" ? 30 : status === "ASSESSMENT" ? 20 : status === "SCREENING" ? 10 : 0;
    return stageWeight(b.application.status) + b.prep.readinessScore - (stageWeight(a.application.status) + a.prep.readinessScore);
  });

  const interviews = items.filter((item) => item.application.status === "INTERVIEW").length;
  const assessments = items.filter((item) => item.application.status === "ASSESSMENT").length;
  const ready = items.filter((item) => item.prep.label === "READY").length;
  const needsPrep = items.filter((item) => item.prep.label !== "READY").length;

  return (
    <div className="stack-xl">
      <section className="page-heading">
        <div>
          <span className="eyebrow accent">INTERVIEW INTELLIGENCE</span>
          <h1>Turn every interview stage into a preparation plan.</h1>
          <p>Alchemy converts your actual job match, strengths and gaps into a focused interview room instead of a generic question list.</p>
        </div>
        <Link href="/applications" className="button ghost">Back to applications</Link>
      </section>

      <section className="metric-grid" aria-label="Interview intelligence metrics">
        <Metric label="Interviews" value={interviews} hint="Current interview stage" />
        <Metric label="Assessments" value={assessments} hint="Technical / take-home stage" />
        <Metric label="Prep ready" value={ready} hint="80%+ readiness" />
        <Metric label="Needs prep" value={needsPrep} hint="Action before next stage" />
      </section>

      <section className="stack-lg">
        {items.map(({ application, prep }) => (
          <article className="panel stack-lg" key={application.id}>
            <div className="section-heading compact">
              <div>
                <span className="eyebrow accent">{application.status}</span>
                <h2>{application.job.title}</h2>
                <p>{application.job.company.name} · {application.job.matchScore ?? "—"}% match</p>
              </div>
              <div className="detail-score">
                <span>Prep readiness</span>
                <strong>{prep.readinessScore}%</strong>
                <small>{prep.label.replace("_", " ")}</small>
              </div>
            </div>

            <div className="reason-grid">
              <div>
                <h3>Preparation checklist</h3>
                <ul className="reason-list positive">
                  {prep.checklist.map((item) => <li key={item.label}>{item.done ? "✓" : "△"} {item.label}</li>)}
                </ul>
              </div>
              <div>
                <h3>Focus before the call</h3>
                <ul className="reason-list caution">
                  {prep.focusAreas.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>

            <div className="analytics-grid">
              <div>
                <h3>Technical rehearsal</h3>
                <ul className="reason-list positive">
                  {prep.technicalPrompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
                </ul>
              </div>
              <div>
                <h3>Behavioural rehearsal</h3>
                <ul className="reason-list positive">
                  {prep.behaviouralPrompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
                </ul>
              </div>
            </div>

            <div className="detail-actions">
              <Link href={`/jobs/${application.jobId}`} className="button primary">Open role intelligence</Link>
              {application.job.applyUrl ? <a href={application.job.applyUrl} target="_blank" rel="noreferrer" className="button ghost">Original vacancy ↗</a> : null}
            </div>
          </article>
        ))}

        {!items.length ? (
          <div className="empty-state">
            <strong>No active screening, assessment or interview stages yet.</strong>
            <p>When an application moves forward, Alchemy will build the preparation room here.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>;
}
