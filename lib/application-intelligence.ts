// Application Intelligence converts passive application records into concrete actions.
// Keep this module deterministic: the UI, tests and future automation should receive the
// same answer for the same inputs without requiring an external AI service.
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

export type NextApplicationAction = {
  action: "PREPARE" | "APPLY_NOW" | "FOLLOW_UP" | "FOCUS_STAGE" | "WAIT" | "ARCHIVE";
  urgency: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
};

// Date arithmetic is intentionally clamped at zero so clock drift/future timestamps never
// produce confusing negative values in the application dashboard.
function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

// Readiness measures whether the candidate has enough context prepared to submit a deliberate,
// tailored application rather than simply clicking Apply.
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

// Follow-up windows are conservative defaults: seven days after a plain application and five
// days without movement once the candidate has entered an active recruitment stage.
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

// This is the human-readable decision layer. It deliberately sits above readiness/follow-up so
// those lower-level rules remain reusable by analytics, notifications and future integrations.
export function getNextApplicationAction(input: ApplicationReadinessInput, now = new Date()): NextApplicationAction {
  const readiness = getApplicationReadiness(input);
  const followUp = getFollowUpState(input, now);

  if (followUp.label === "CLOSED") {
    return { action: "ARCHIVE", urgency: "LOW", reason: "This application has reached a terminal stage." };
  }
  if (followUp.label === "FOLLOW_UP") {
    return { action: "FOLLOW_UP", urgency: "HIGH", reason: followUp.reason };
  }
  if (followUp.label === "ACTIVE_STAGE") {
    return { action: "FOCUS_STAGE", urgency: "HIGH", reason: `Prepare for the current ${input.status.toLowerCase()} stage.` };
  }
  if (input.status === "PLANNED" && readiness.label === "READY" && input.applyVerdict !== "SKIP") {
    return { action: "APPLY_NOW", urgency: "HIGH", reason: "Application materials are ready and the role passed the fit check." };
  }
  if (input.status === "PLANNED") {
    return { action: "PREPARE", urgency: readiness.score >= 50 ? "MEDIUM" : "LOW", reason: `${readiness.score}% of the application checklist is complete.` };
  }
  return { action: "WAIT", urgency: "LOW", reason: followUp.reason };
}

// Priority is a sortable operational score, not a probability of getting hired. Higher values
// mean the record deserves attention sooner; terminal records are pushed to the bottom.
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
