export type FilterProfile = {
  education?: string | null;
  excludedKeywords: string[];
  preferredLocations: string[];
};

export type FilterJob = {
  title: string;
  description: string;
  location?: string | null;
  remote?: boolean;
};

export type HardFilterResult = {
  rejected: boolean;
  reasons: string[];
};

type GeoRestriction = {
  label: string;
  patterns: RegExp[];
  acceptedLocationTerms: string[];
};

const GEO_RESTRICTIONS: GeoRestriction[] = [
  {
    label: "United States",
    acceptedLocationTerms: ["united states", "usa", "u.s.", "us"],
    patterns: [
      /remote(?:ly)?\s+(?:only\s+)?(?:in|within|from)\s+(?:the\s+)?united states/i,
      /must\s+be\s+(?:located|based)\s+in\s+(?:the\s+)?united states/i,
      /(?:u\.s\.|us|united states)[- ]based\s+(?:candidates|applicants)\s+only/i,
    ],
  },
  {
    label: "United Kingdom",
    acceptedLocationTerms: ["united kingdom", "uk", "u.k.", "england", "scotland", "wales"],
    patterns: [
      /remote(?:ly)?\s+(?:only\s+)?(?:in|within|from)\s+(?:the\s+)?united kingdom/i,
      /must\s+be\s+(?:located|based)\s+in\s+(?:the\s+)?united kingdom/i,
      /(?:u\.k\.|uk|united kingdom)[- ]based\s+(?:candidates|applicants)\s+only/i,
    ],
  },
  {
    label: "Canada",
    acceptedLocationTerms: ["canada"],
    patterns: [
      /remote(?:ly)?\s+(?:only\s+)?(?:in|within|from)\s+canada/i,
      /must\s+be\s+(?:located|based)\s+in\s+canada/i,
      /canada[- ]based\s+(?:candidates|applicants)\s+only/i,
    ],
  },
  {
    label: "Australia",
    acceptedLocationTerms: ["australia"],
    patterns: [
      /remote(?:ly)?\s+(?:only\s+)?(?:in|within|from)\s+australia/i,
      /must\s+be\s+(?:located|based)\s+in\s+australia/i,
      /australia[- ]based\s+(?:candidates|applicants)\s+only/i,
    ],
  },
];

function profileAllowsLocation(profile: FilterProfile, restriction: GeoRestriction): boolean {
  const preferences = profile.preferredLocations.map((value) => value.trim().toLowerCase());

  return restriction.acceptedLocationTerms.some((term) =>
    preferences.some((preference) => {
      // Short country aliases such as `US` and `UK` must match a full preference,
      // otherwise `us` could accidentally match an unrelated place name.
      if (term.length < 4) return preference === term;
      return preference === term || preference.includes(term);
    })
  );
}

export function evaluateHardFilters(
  job: FilterJob,
  profile: FilterProfile
): HardFilterResult {
  const haystack = `${job.title} ${job.location ?? ""} ${job.description}`.toLowerCase();
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

  // Remote does not always mean globally remote. Reject only when the vacancy
  // explicitly restricts candidates to a country absent from the profile. This
  // prevents US-only/UK-only remote roles from ranking above locally actionable jobs.
  for (const restriction of GEO_RESTRICTIONS) {
    const explicitlyRestricted = restriction.patterns.some((pattern) => pattern.test(haystack));
    if (explicitlyRestricted && !profileAllowsLocation(profile, restriction)) {
      reasons.push(`Role is explicitly restricted to ${restriction.label}`);
    }
  }

  return { rejected: reasons.length > 0, reasons };
}
