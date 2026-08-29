export type InterviewStage = "SCREENING" | "ASSESSMENT" | "INTERVIEW" | "OFFER" | "OTHER";

export type InterviewPrepInput = {
  title: string;
  company: string;
  stage: InterviewStage;
  matchScore?: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  notes?: string | null;
  resumeVersion?: string | null;
  careerLevel?: string;
};

export type InterviewPrep = {
  readinessScore: number;
  label: "READY" | "PREP_NEEDED" | "HIGH_RISK";
  focusAreas: string[];
  technicalPrompts: string[];
  behaviouralPrompts: string[];
  checklist: Array<{ label: string; done: boolean }>;
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function getInterviewPrep(input: InterviewPrepInput): InterviewPrep {
  const matched = unique(input.matchedSkills).slice(0, 5);
  const gaps = unique(input.missingSkills).slice(0, 4);
  const hasNotes = Boolean(input.notes?.trim());
  const hasResume = Boolean(input.resumeVersion?.trim());
  const strongMatch = (input.matchScore ?? 0) >= 75;

  const checklist = [
    { label: "Role and company context saved", done: hasNotes },
    { label: "Tailored CV version selected", done: hasResume },
    { label: "Core strengths identified", done: matched.length > 0 },
    { label: "Skill gaps identified for revision", done: gaps.length > 0 || strongMatch },
    { label: "Interview-stage preparation active", done: ["SCREENING", "ASSESSMENT", "INTERVIEW"].includes(input.stage) },
  ];

  const completed = checklist.filter((item) => item.done).length;
  let readinessScore = Math.round((completed / checklist.length) * 70);
  if (strongMatch) readinessScore += 15;
  if (matched.length >= 3) readinessScore += 10;
  if (hasNotes && hasResume) readinessScore += 5;
  readinessScore = Math.min(100, readinessScore);

  const focusAreas = unique([
    ...matched.map((skill) => `Show evidence of ${skill} in a real project.`),
    ...gaps.map((skill) => `Revise ${skill} enough to explain fundamentals and your learning plan.`),
    `Prepare a concise reason for wanting the ${input.title} role at ${input.company}.`,
    input.careerLevel ? `Pitch yourself at ${input.careerLevel.toLowerCase()} level without overselling.` : "Explain your current career level with evidence.",
  ]).slice(0, 8);

  const technicalPrompts = unique([
    ...matched.slice(0, 3).map((skill) => `Walk me through a project where you used ${skill}. What trade-offs did you make?`),
    ...gaps.slice(0, 2).map((skill) => `You have less experience with ${skill}. How would you get productive with it quickly?`),
    `How would you debug a production issue in a ${input.title} role?`,
    "How do you test your work before calling it done?",
  ]).slice(0, 7);

  const behaviouralPrompts = [
    "Tell me about a difficult bug or blocker and how you worked through it.",
    "Describe a time you had to learn something quickly to deliver.",
    "Tell me about a disagreement or unclear requirement and how you handled it.",
    "What project are you most proud of, and what was your specific contribution?",
    `Why ${input.company}, and why this role now?`,
  ];

  const label = readinessScore >= 80 ? "READY" : readinessScore >= 55 ? "PREP_NEEDED" : "HIGH_RISK";
  return { readinessScore, label, focusAreas, technicalPrompts, behaviouralPrompts, checklist };
}
