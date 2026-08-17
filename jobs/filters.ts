export type FilterProfile = {
  education?: string | null;
  excludedKeywords: string[];
};

export type FilterJob = {
  title: string;
  description: string;
};

export type HardFilterResult = {
  rejected: boolean;
  reasons: string[];
};

export function evaluateHardFilters(
  job: FilterJob,
  profile: FilterProfile
): HardFilterResult {
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  const title = job.title.toLowerCase();
  const education = profile.education?.toLowerCase() ?? "";
  const reasons: string[] = [];

  for (const keyword of profile.excludedKeywords) {
    const normalized = keyword.trim().toLowerCase();
    if (normalized && title.includes(normalized)) {
      reasons.push(`Excluded role keyword: ${keyword}`);
    }
  }

  const currentStudentOnly = /(?:currently|must be)\s+(?:enrolled|studying)|current\s+(?:student|university student)/i.test(haystack);
  if (currentStudentOnly) {
    reasons.push("Role appears to require current student enrolment");
  }

  const requiresPostgrad = /(?:master'?s|masters|phd|doctorate)\s+(?:degree\s+)?(?:is\s+)?(?:required|mandatory|essential)/i.test(haystack);
  const hasPostgrad = /master|phd|doctorate/.test(education);
  if (requiresPostgrad && !hasPostgrad) {
    reasons.push("Mandatory postgraduate qualification not matched");
  }

  return { rejected: reasons.length > 0, reasons };
}
