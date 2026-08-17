import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { setApplicationStatus } from "@/app/actions";

export const dynamic = "force-dynamic";

const stages = ["PLANNED", "APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER"] as const;

export default async function ApplicationsPage() {
  const applications = await prisma.jobApplication.findMany({
    include: { job: { include: { company: { select: { name: true } } } } },
    orderBy: { updatedAt: "desc" },
  });

  const grouped = new Map(stages.map((stage) => [stage, applications.filter((item) => item.status === stage)]));

  return (
    <div className="stack-xl">
      <section className="page-heading">
        <div>
          <span className="eyebrow accent">APPLICATION TRACKER</span>
          <h1>Know exactly where every application stands.</h1>
          <p>Move opportunities from plan to offer without losing follow-ups in tabs, inboxes or memory.</p>
        </div>
        <span className="count-chip">{applications.length} tracked</span>
      </section>

      <section className="pipeline-grid">
        {stages.map((stage) => (
          <div className="pipeline-column" key={stage}>
            <div className="pipeline-heading"><strong>{stage}</strong><span>{grouped.get(stage)?.length ?? 0}</span></div>
            <div className="pipeline-stack">
              {(grouped.get(stage) ?? []).map((application) => (
                <article className="pipeline-card" key={application.id}>
                  <span className="company-name">{application.job.company.name}</span>
                  <Link href={`/jobs/${application.jobId}`}><h3>{application.job.title}</h3></Link>
                  <div className="pipeline-meta">
                    <span>{application.job.matchScore == null ? "Unscored" : `${application.job.matchScore}% match`}</span>
                    <span>{application.appliedAt ? application.appliedAt.toLocaleDateString("en-ZA") : "Not applied"}</span>
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
          <span className="eyebrow">ARCHIVE</span>
          <h2>Closed applications</h2>
          <div className="archive-list">
            {applications.filter((item) => item.status === "REJECTED" || item.status === "WITHDRAWN").map((item) => (
              <Link key={item.id} href={`/jobs/${item.jobId}`} className="source-row">
                <div><strong>{item.job.title}</strong><span>{item.job.company.name}</span></div>
                <span className="status-badge">{item.status}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
