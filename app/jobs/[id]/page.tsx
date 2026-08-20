import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { saveApplicationDetails, setApplicationStatus, setJobStatus } from "@/app/actions";

export const dynamic = "force-dynamic";

type MatchData = {
  filtered?: boolean;
  filterReasons?: string[];
  positives?: string[];
  cautions?: string[];
  components?: Record<string, number>;
  experienceText?: string;
  sa?: {
    country?: "ZA" | "UNKNOWN";
    province?: string;
    city?: string;
    workMode?: string;
    careerLevel?: string;
    qualification?: string;
    salary?: {
      currency?: "ZAR";
      minMonthly?: number;
      maxMonthly?: number;
      disclosure?: string;
    };
  };
  eligibility?: {
    hardRequirements?: string[];
    preferredRequirements?: string[];
    learnableGaps?: string[];
    verdict?: "APPLY" | "MAYBE" | "SKIP";
    reason?: string;
  };
};

function money(value?: number): string {
  return value == null ? "" : `R${value.toLocaleString("en-ZA")}`;
}

function salaryLabel(match: MatchData): string {
  const salary = match.sa?.salary;
  if (!salary) return "Not disclosed";
  if (salary.disclosure === "MARKET_RELATED") return "Market related";
  if (salary.disclosure === "NEGOTIABLE") return "Negotiable";
  if (salary.minMonthly != null && salary.maxMonthly != null) {
    return `${money(salary.minMonthly)}–${money(salary.maxMonthly)} / month`;
  }
  if (salary.minMonthly != null) return `${money(salary.minMonthly)} / month`;
  return "Not disclosed";
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { company: true, application: true },
  });
  if (!job) notFound();

  const match = (job.matchData ?? {}) as unknown as MatchData;
  const verdict = match.eligibility?.verdict;

  return (
    <div className="stack-xl">
      <Link href="/jobs" className="back-link">← Back to jobs</Link>

      <section className="detail-hero">
        <div className="detail-title">
          <span className="eyebrow accent">{job.company.name}</span>
          <h1>{job.title}</h1>
          <div className="job-meta large">
            <span>{job.remote ? "Remote-friendly" : job.location || "Location not listed"}</span>
            <span>{job.employmentType || "Employment type not listed"}</span>
            <span>{job.source}</span>
          </div>
        </div>
        <div className="detail-score">
          <span>Match score</span>
          <strong>{job.matchScore ?? "—"}{job.matchScore != null ? "%" : ""}</strong>
          <small>{job.matchScore == null ? "Run scoring to analyse this role" : "Deterministic, explainable score"}</small>
        </div>
      </section>

      {verdict ? (
        <section className="panel focus-panel stack-sm">
          <span className="eyebrow accent">🇿🇦 SHOULD I APPLY?</span>
          <h2>{verdict}</h2>
          <p>{match.eligibility?.reason}</p>
          <div className="job-meta large">
            <span>{match.sa?.province || match.sa?.city || (match.sa?.country === "ZA" ? "South Africa" : "Market unclear")}</span>
            <span>{match.sa?.workMode?.replaceAll("_", " ") || "Work mode unclear"}</span>
            <span>{match.sa?.careerLevel?.toLowerCase() || "Career level unclear"}</span>
            <span>{salaryLabel(match)}</span>
          </div>
        </section>
      ) : null}

      <section className="detail-actions">
        <a className="button primary" href={job.applyUrl} target="_blank" rel="noreferrer">Open original job ↗</a>
        <form action={setJobStatus}>
          <input type="hidden" name="id" value={job.id} />
          <input type="hidden" name="status" value="SHORTLISTED" />
          <button className="button ghost" type="submit">Shortlist</button>
        </form>
        <form action={setApplicationStatus}>
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="status" value="APPLIED" />
          <button className="button ghost" type="submit">Mark applied</button>
        </form>
        <form action={setJobStatus}>
          <input type="hidden" name="id" value={job.id} />
          <input type="hidden" name="status" value="REJECTED" />
          <button className="button danger" type="submit">Reject</button>
        </form>
      </section>

      <section className="detail-grid">
        <div className="stack-lg">
          <article className="panel">
            <span className="eyebrow accent">MATCH BREAKDOWN</span>
            <h2>Why this score?</h2>
            {match.filtered ? (
              <div className="alert warning"><strong>Hard-filter flag</strong><p>{match.filterReasons?.join(" · ")}</p></div>
            ) : null}
            <div className="reason-grid">
              <div>
                <h3>Signals in your favour</h3>
                <ul className="reason-list positive">
                  {(match.positives ?? []).map((reason) => <li key={reason}>{reason}</li>)}
                  {!match.positives?.length ? <li>No scoring explanation stored yet.</li> : null}
                </ul>
              </div>
              <div>
                <h3>Things to review</h3>
                <ul className="reason-list caution">
                  {(match.cautions ?? []).map((reason) => <li key={reason}>{reason}</li>)}
                  {!match.cautions?.length ? <li>No major cautions detected.</li> : null}
                </ul>
              </div>
            </div>
            {match.components ? (
              <div className="component-bars">
                {Object.entries(match.components).map(([name, value]) => (
                  <div className="component-row" key={name}><span>{name}</span><strong>{value}</strong></div>
                ))}
              </div>
            ) : null}
          </article>

          {match.eligibility ? (
            <article className="panel">
              <span className="eyebrow accent">SA ELIGIBILITY</span>
              <h2>Hard requirements vs learnable gaps</h2>
              <div className="reason-grid">
                <div>
                  <h3>Hard / stated requirements</h3>
                  <ul className="reason-list caution">
                    {(match.eligibility.hardRequirements ?? []).map((item) => <li key={item}>{item}</li>)}
                    {!match.eligibility.hardRequirements?.length ? <li>No obvious hard blocker detected.</li> : null}
                  </ul>
                </div>
                <div>
                  <h3>Learnable gaps</h3>
                  <ul className="reason-list positive">
                    {(match.eligibility.learnableGaps ?? []).map((item) => <li key={item}>{item}</li>)}
                    {!match.eligibility.learnableGaps?.length ? <li>No major skill gap detected.</li> : null}
                  </ul>
                </div>
              </div>
            </article>
          ) : null}

          <article className="panel">
            <span className="eyebrow">JOB DESCRIPTION</span>
            <h2>Role details</h2>
            <p className="description-copy">{job.description || "No description was returned by the source."}</p>
          </article>
        </div>

        <aside className="stack-lg">
          <article className="panel">
            <span className="eyebrow">SKILLS</span>
            <h2>Your coverage</h2>
            <div className="skill-row vertical">
              {job.matchedSkills.map((skill) => <span className="skill matched" key={skill}>✓ {skill}</span>)}
              {job.missingSkills.map((skill) => <span className="skill missing" key={skill}>△ {skill}</span>)}
              {!job.matchedSkills.length && !job.missingSkills.length ? <span className="muted">No skills analysed yet.</span> : null}
            </div>
          </article>

          <article className="panel metadata-list">
            <span className="eyebrow accent">🇿🇦 SA NORMALIZATION</span>
            <div><span>Market</span><strong>{match.sa?.country === "ZA" ? "South Africa" : "Unknown"}</strong></div>
            <div><span>Province</span><strong>{match.sa?.province || "Not detected"}</strong></div>
            <div><span>City</span><strong>{match.sa?.city || "Not detected"}</strong></div>
            <div><span>Work mode</span><strong>{match.sa?.workMode?.replaceAll("_", " ") || "Not detected"}</strong></div>
            <div><span>Career level</span><strong>{match.sa?.careerLevel || "Not detected"}</strong></div>
            <div><span>Qualification</span><strong>{match.sa?.qualification || "Not detected"}</strong></div>
            <div><span>Salary</span><strong>{salaryLabel(match)}</strong></div>
          </article>

          <article className="panel">
            <span className="eyebrow">APPLICATION</span>
            <h2>{job.application?.status ?? "Not started"}</h2>
            <p className="muted">{job.application?.appliedAt ? `Applied ${job.application.appliedAt.toLocaleDateString("en-ZA")}` : "Move the role into your pipeline when you apply."}</p>
            <div className="stack-sm">
              {["SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED"].map((status) => (
                <form action={setApplicationStatus} key={status}>
                  <input type="hidden" name="jobId" value={job.id} />
                  <input type="hidden" name="status" value={status} />
                  <button className="button small ghost full" type="submit">Mark {status.toLowerCase()}</button>
                </form>
              ))}
            </div>
          </article>

          <article className="panel">
            <span className="eyebrow">APPLICATION NOTES</span>
            <h2>Keep the context</h2>
            <form action={saveApplicationDetails} className="stack-sm">
              <input type="hidden" name="jobId" value={job.id} />
              <label className="form-label"><span>Resume version</span><input className="field" name="resumeVersion" defaultValue={job.application?.resumeVersion ?? ""} placeholder="e.g. frontend-v3" /></label>
              <label className="form-label"><span>Cover letter version</span><input className="field" name="coverLetterVersion" defaultValue={job.application?.coverLetterVersion ?? ""} placeholder="e.g. figma-tailored" /></label>
              <label className="form-label"><span>Notes</span><textarea className="field textarea" name="notes" defaultValue={job.application?.notes ?? ""} placeholder="Recruiter, follow-up, assessment notes..." /></label>
              <button className="button ghost full" type="submit">Save application notes</button>
            </form>
          </article>

          <article className="panel metadata-list">
            <span className="eyebrow">SOURCE DATA</span>
            <div><span>First found</span><strong>{job.firstSeenAt.toLocaleDateString("en-ZA")}</strong></div>
            <div><span>Last seen</span><strong>{job.lastSeenAt.toLocaleDateString("en-ZA")}</strong></div>
            <div><span>Experience</span><strong>{match.experienceText || "Not detected"}</strong></div>
            <div><span>Job status</span><strong>{job.status}</strong></div>
          </article>
        </aside>
      </section>
    </div>
  );
}
