export type ApplicationStatus =
  | "PLANNED"
  | "APPLIED"
  | "SCREENING"
  | "ASSESSMENT"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN";

export type ApplicationReadinessInput = {
  status: ApplicationStatus;
  resumeVersion?: string | null;
  coverLetterVersion?: string | null;
  notes?: string | null;
  appliedAt?: Date | null;
  updatedAt: Date;
  applyVerdict?: "APPLY" | "MAYBE" | "SKIP";
  matchScore?: number | null;
};

export type ApplicationReadiness = {
  score: number;
  label: "READY" | "NEEDS_WORK" | "INCOMPLETE";
  checklist: Array<{ key: string; label: string; done: boolean }>;
};

export type FollowUpState = {
  label: "FOLLOW_UP" | "WAIT" | "ACTIVE_STAGE" | "CLOSED" | "NOT_APPLIED";
  daysSinceUpdate: number;
  reason: string;
};

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

export function getApplicationReadiness(input: ApplicationReadinessInput): ApplicationReadiness {
  const checklist = [
    { key: "fit", label: "Role fit checked", done: input.applyVerdict === "APPLY" || (input.matchScore ?? 0) >= 65 },
    { key: "resume", label: "Tailored CV selected", done: Boolean(input.resumeVersion?.trim()) },
    { key: "cover", label: "Cover letter / motivation prepared", done: Boolean(input.coverLetterVersion?.trim()) },
    { key: "notes", label: "Application context saved", done: Boolean(input.notes?.trim()) },
  ];

  const complete = checklist.filter((item) => item.done).length;
  const score = Math.round((complete / checklist.length) * 100);
  const label = score === 100 ? "READY" : score >= 50 ? "NEEDS_WORK" : "INCOMPLETE";
  return { score, label, checklist };
}

export function getFollowUpState(input: ApplicationReadinessInput, now = new Date()): FollowUpState {
  if (input.status === "REJECTED" || input.status === "WITHDRAWN" || input.status === "OFFER") {
    return { label: "CLOSED", daysSinceUpdate: daysBetween(input.updatedAt, now), reason: "Application is in a terminal stage." };
  }

  if (input.status === "PLANNED") {
    return { label: "NOT_APPLIED", daysSinceUpdate: daysBetween(input.updatedAt, now), reason: "Application has not entered the submitted funnel yet." };
  }

  const anchor = input.appliedAt ?? input.updatedAt;
  const days = daysBetween(anchor, now);
  if (input.status === "APPLIED" && days >= 7) {
    return { label: "FOLLOW_UP", daysSinceUpdate: days, reason: `No stage movement recorded for ${days} days.` };
  }

  if (["SCREENING", "ASSESSMENT", "INTERVIEW"].includes(input.status) && daysBetween(input.updatedAt, now) >= 5) {
    const stagnant = daysBetween(input.updatedAt, now);
    return { label: "FOLLOW_UP", daysSinceUpdate: stagnant, reason: `${input.status.toLowerCase()} has been unchanged for ${stagnant} days.` };
  }

  if (["SCREENING", "ASSESSMENT", "INTERVIEW"].includes(input.status)) {
    return { label: "ACTIVE_STAGE", daysSinceUpdate: daysBetween(input.updatedAt, now), reason: "Application is actively progressing." };
  }

  return { label: "WAIT", daysSinceUpdate: days, reason: "Still inside the normal follow-up window." };
}

export function applicationPriority(input: ApplicationReadinessInput): number {
  const readiness = getApplicationReadiness(input);
  const followUp = getFollowUpState(input);
  let score = readiness.score;
  if (input.applyVerdict === "APPLY") score += 20;
  if ((input.matchScore ?? 0) >= 80) score += 15;
  if (followUp.label === "FOLLOW_UP") score += 30;
  if (followUp.label === "ACTIVE_STAGE") score += 20;
  if (input.status === "PLANNED") score += 10;
  if (followUp.label === "CLOSED") score -= 100;
  return score;
}
