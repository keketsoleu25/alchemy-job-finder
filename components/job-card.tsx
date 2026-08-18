import Link from "next/link";
import { setJobStatus } from "@/app/actions";
import { sastCalendarDayDifference } from "@/lib/time";

type JobCardProps = {
  job: {
    id: string;
    title: string;
    location: string | null;
    remote: boolean;
    matchScore: number | null;
    matchedSkills: string[];
    missingSkills: string[];
    firstSeenAt: Date;
    company: { name: string };
  };
};

function ageLabel(date: Date): string {
  // Use the exact same SAST calendar boundary as the dashboard's
  // "Discovered today" metric so labels and counts cannot disagree.
  const days = sastCalendarDayDifference(date);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function JobCard({ job }: JobCardProps) {
  const score = job.matchScore ?? 0;
  const tone = score >= 80 ? "score-high" : score >= 65 ? "score-mid" : "score-low";

  return (
    <article className="job-card">
      <div className="job-card-top">
        <div>
          <span className="company-name">{job.company.name}</span>
          <h3>{job.title}</h3>
        </div>
        <div className={`score-ring ${tone}`} aria-label={`${score}% match`}>
          <strong>{score}</strong><span>%</span>
        </div>
      </div>

      <div className="job-meta">
        <span>{job.remote ? "Remote-friendly" : job.location || "Location not listed"}</span>
        <span>Found {ageLabel(job.firstSeenAt)}</span>
      </div>

      <div className="skill-row">
        {job.matchedSkills.slice(0, 4).map((skill) => (
          <span className="skill matched" key={skill}>✓ {skill}</span>
        ))}
        {job.missingSkills.slice(0, 2).map((skill) => (
          <span className="skill missing" key={skill}>△ {skill}</span>
        ))}
        {!job.matchedSkills.length && !job.missingSkills.length ? (
          <span className="skill neutral">Run scoring to analyse skills</span>
        ) : null}
      </div>

      <div className="job-actions">
        <Link className="button primary" href={`/jobs/${job.id}`}>Review job</Link>
        <form action={setJobStatus}>
          <input type="hidden" name="id" value={job.id} />
          <input type="hidden" name="status" value="SHORTLISTED" />
          <button className="button ghost" type="submit">Shortlist</button>
        </form>
      </div>
    </article>
  );
}
