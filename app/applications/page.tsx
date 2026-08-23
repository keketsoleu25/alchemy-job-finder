import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { setApplicationStatus } from "@/app/actions";
import {
  applicationPriority,
  getApplicationReadiness,
  getFollowUpState,
  getNextApplicationAction,
  type ApplicationStatus,
} from "@/lib/application-intelligence";

// Application data changes outside the request lifecycle when scraper/scoring jobs run, so this
// page is intentionally dynamic rather than serving a stale build-time snapshot.
export const dynamic = "force-dynamic";

const stages = ["PLANNED", "APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER"] as const;

type MatchData = {
  eligibility?: { verdict?: "APPLY" | "MAYBE" | "SKIP" };
};

export default async function ApplicationsPage() {
  // Load the job and company in one query so every intelligence card can explain its context.
  const applications = await prisma.jobApplication.findMany({
    include: { job: { include: { company: { select: { name: true } } } } },
    orderBy: { updatedAt: "desc" },
  });

  // Enrich database records in memory. The intelligence engine is pure TypeScript and therefore
  // stays easy to test independently of Prisma and the React rendering layer.
  const enriched = applications.map((application) => {
    const match = (application.job.matchData ?? {}) as unknown as MatchData;
    const input = {
      status: application.status as ApplicationStatus,
      resumeVersion: application.resumeVersion,
      coverLetterVersion: application.coverLetterVersion,
      notes: application.notes,
      appliedAt: application.appliedAt,
      updatedAt: application.updatedAt,
      applyVerdict: match.eligibility?.verdict,
      matchScore: application.job.matchScore,
    };

    return {
      application,
      readiness: getApplicationReadiness(input),
      followUp: getFollowUpState(input),
      nextAction: getNextApplicationAction(input),
      priority: applicationPriority(input),
      verdict: match.eligibility?.verdict,
    };
  });

  // Preserve the familiar recruitment funnel while sorting each column by operational priority.
  const grouped = new Map(
    stages.map((stage) => [
      stage,
      enriched.filter((item) => item.application.status === stage).sort((a, b) => b.priority - a.priority),
    ])
  );

  const actionQueue = enriched
    .filter((item) => item.nextAction.urgency === "HIGH" && item.nextAction.action !== "ARCHIVE")
    .sort((a, b) => b.priority - a.priority);
  const followUps = enriched.filter((item) => item.followUp.label === "FOLLOW_UP").sort((a, b) => b.priority - a.priority);
  const readyToSend = enriched.filter((item) => item.nextAction.action === "APPLY_NOW").length;
  const activeStages = enriched.filter((item) => item.followUp.label === "ACTIVE_STAGE").length;
  const closed = enriched.filter((item) => item.followUp.label === "CLOSED").length;

  return (
    <div className="stack-xl">
      <section className="page-heading">
        <div>
          <span className="eyebrow accent">APPLICATION INTELLIGENCE</span>
          <h1>Know what to prepare, send and follow up.</h1>
          <p>Alchemy turns your application tracker into an action system: readiness, next-best actions, follow-ups and pipeline movement in one place.</p>
        </div>
        <span className="count-chip">{applications.length} tracked</span>
      </section>

      <section className="metric-grid" aria-label="Application intelligence metrics">
        <Metric label="Ready to send" value={readyToSend} hint="Prepared + fit checked" />
        <Metric label="Action queue" value={actionQueue.length} hint="High-priority next moves" />
        <Metric label="Active stages" value={activeStages} hint="Screening to interview" />
        <Metric label="Closed" value={closed} hint="Offer / rejected / withdrawn" />
      </section>

      {actionQueue.length ? (
        <section className="panel stack-lg">
          <div className="section-heading compact">
            <div><span className="eyebrow accent">NEXT-BEST ACTIONS</span><h2>Do these first.</h2></div>
            <span className="count-chip">{actionQueue.length} priority</span>
          </div>
          <div className="source-list">
            {actionQueue.slice(0, 8).map(({ application, nextAction }) => (
              <Link key={application.id} href={`/jobs/${application.jobId}`} className="source-row">
                <div><strong>{application.job.title}</strong><span>{application.job.company.name} · {nextAction.reason}</span></div>
                <span className="status-badge">{nextAction.action.replace("_", " ")}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {followUps.length ? (
        <section className="panel stack-lg">
          <div className="section-heading compact">
            <div><span className="eyebrow accent">FOLLOW-UP RADAR</span><h2>Applications that need movement.</h2></div>
            <span className="count-chip">{followUps.length} due</span>
          </div>
          <div className="source-list">
            {followUps.slice(0, 6).map(({ application, followUp }) => (
              <Link key={application.id} href={`/jobs/${application.jobId}`} className="source-row">
                <div><strong>{application.job.title}</strong><span>{application.job.company.name} · {followUp.reason}</span></div>
                <span className="status-badge">FOLLOW UP</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="pipeline-grid">
        {stages.map((stage) => (
          <div className="pipeline-column" key={stage}>
            <div className="pipeline-heading"><strong>{stage}</strong><span>{grouped.get(stage)?.length ?? 0}</span></div>
            <div className="pipeline-stack">
              {(grouped.get(stage) ?? []).map(({ application, readiness, followUp, nextAction, verdict }) => (
                <article className="pipeline-card" key={application.id}>
                  <span className="company-name">{application.job.company.name}</span>
                  <Link href={`/jobs/${application.jobId}`}><h3>{application.job.title}</h3></Link>
                  <div className="pipeline-meta">
                    <span>{application.job.matchScore == null ? "Unscored" : `${application.job.matchScore}% match`}</span>
                    <span>{verdict ?? "NO VERDICT"}</span>
                  </div>
                  <div className="stack-sm">
                    <div className="source-row">
                      <div><strong>{readiness.score}% ready</strong><span>{readiness.label.replace("_", " ")}</span></div>
                      <span className="status-badge">{nextAction.action.replace("_", " ")}</span>
                    </div>
                    {stage === "PLANNED" ? <div className="reason-list positive">{readiness.checklist.map((item) => <div key={item.key}>{item.done ? "✓" : "△"} {item.label}</div>)}</div> : null}
                    {stage !== "PLANNED" ? <small>{followUp.reason}</small> : null}
                  </div>
                  <div className="pipeline-meta">
                    <span>{application.appliedAt ? `Applied ${application.appliedAt.toLocaleDateString("en-ZA")}` : "Not applied"}</span>
                    <span>Updated {application.updatedAt.toLocaleDateString("en-ZA")}</span>
                  </div>
                  <form action={setApplicationStatus}>
                    <input type="hidden" name="jobId" value={application.jobId} />
                    <select className="field compact-field" name="status" defaultValue={application.status}>
                      {[...stages, "REJECTED", "WITHDRAWN"].map((status) => <option key={status}>{status}</option>)}
                    </select>
                    <button className="button small ghost full" type="submit">Update stage</button>
                  </form>
                </article>
              ))}
              {!grouped.get(stage)?.length ? <div className="pipeline-empty">Nothing here yet</div> : null}
            </div>
          </div>
        ))}
      </section>

      {applications.some((application) => application.status === "REJECTED" || application.status === "WITHDRAWN") ? (
        <section className="panel">
          <span className="eyebrow">ARCHIVE</span><h2>Closed applications</h2>
          <div className="archive-list">
            {applications.filter((item) => item.status === "REJECTED" || item.status === "WITHDRAWN").map((item) => (
              <Link key={item.id} href={`/jobs/${item.jobId}`} className="source-row">
                <div><strong>{item.job.title}</strong><span>{item.job.company.name}</span></div><span className="status-badge">{item.status}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// Small local component keeps metric markup consistent without introducing client-side JavaScript.
function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>;
}
