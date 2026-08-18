import { evaluateHardFilters } from "./filters";
import { extractExperienceRequirement } from "./experience";
import { extractSkills, normalizeSkillName } from "./skills";

export type MatchProfile = {
  targetRoles: string[];
  preferredRoles: string[];
  skills: string[];
  strongSkills: string[];
  secondarySkills: string[];
  yearsExperience: number;
  preferredLocations: string[];
  remotePreference: "REMOTE" | "HYBRID" | "ONSITE" | "FLEXIBLE";
  education?: string | null;
  excludedKeywords: string[];
  preferredKeywords: string[];
};

export type MatchJob = {
  title: string;
  description: string;
  location?: string | null;
  remote: boolean;
  source: "GREENHOUSE" | "LEVER" | "COMPANY_SITE";
};

export type MatchScore = {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  requiredExperienceMin?: number;
  requiredExperienceMax?: number;
  data: {
    filtered: boolean;
    filterReasons: string[];
    components: Record<string, number>;
    positives: string[];
    cautions: string[];
    detectedSkills: string[];
    experienceText?: string;
  };
};

function includesPhrase(text: string, phrase: string): boolean {
  const normalized = phrase.trim().toLowerCase();
  return Boolean(normalized) && text.toLowerCase().includes(normalized);
}

export function scoreJob(job: MatchJob, profile: MatchProfile): MatchScore {
  const fullText = `${job.title} ${job.description}`;
  const detectedSkills = extractSkills(fullText);
  const candidateSkills = new Set(
    [...profile.skills, ...profile.strongSkills, ...profile.secondarySkills].map(normalizeSkillName)
  );
  const matchedSkills = detectedSkills.filter((skill) => candidateSkills.has(skill));
  const missingSkills = detectedSkills.filter((skill) => !candidateSkills.has(skill));
  const experience = extractExperienceRequirement(job.description);
  const filter = evaluateHardFilters(job, profile);
  const components: Record<string, number> = {};
  const positives: string[] = [];
  const cautions: string[] = [];
  const experienceMeta = experience.raw ? { experienceText: experience.raw } : {};

  if (filter.rejected) {
    return {
      score: 0,
      matchedSkills,
      missingSkills,
      requiredExperienceMin: experience.min,
      requiredExperienceMax: experience.max,
      data: {
        filtered: true,
        filterReasons: filter.reasons,
        components: {},
        positives: [],
        cautions: filter.reasons,
        detectedSkills,
        ...experienceMeta,
      },
    };
  }

  // Technology match (30): missing technologies must visibly reduce the score.
  // Earlier V1 data under-detected C++/Rust/Go/WebAssembly, which made specialised
  // roles look artificially perfect. The expanded skill dictionary fixes that at source.
  components.technology = detectedSkills.length === 0
    ? 15
    : Math.round(30 * (matchedSkills.length / detectedSkills.length));
  if (matchedSkills.length) positives.push(`Matched skills: ${matchedSkills.slice(0, 5).join(", ")}`);
  if (missingSkills.length) cautions.push(`Skills to review: ${missingSkills.slice(0, 5).join(", ")}`);

  // Role/title match (20): title alignment matters, but it cannot compensate for
  // geography, experience or a weak technology fit on its own.
  const targetMatch = [...profile.targetRoles, ...profile.preferredRoles]
    .filter(Boolean)
    .some((role) => includesPhrase(job.title, role));
  const preferredHits = profile.preferredKeywords.filter((keyword) => includesPhrase(fullText, keyword)).length;
  components.role = targetMatch ? 20 : Math.min(15, preferredHits * 3);
  if (targetMatch) positives.push("Role title matches a target role");

  // Experience match (15): one year above profile is a reasonable stretch; two
  // years is a material gap; anything larger should not remain a top-ranked role.
  if (experience.min == null) {
    components.experience = 10;
  } else if (experience.min <= profile.yearsExperience + 1) {
    components.experience = 15;
    positives.push("Experience requirement is within range");
  } else if (experience.min <= profile.yearsExperience + 2) {
    components.experience = 6;
    cautions.push(`Stretch role: asks for about ${experience.min} years`);
  } else {
    components.experience = 0;
    cautions.push(`Experience gap: asks for about ${experience.min} years`);
  }

  // Location/remote match (15). FLEXIBLE means flexible about work mode, not
  // willing/eligible to work in every country. A non-preferred location therefore
  // gets only small credit instead of the old near-neutral 9/15.
  const location = job.location?.toLowerCase() ?? "";
  const preferredLocation = profile.preferredLocations.some((value) => {
    const preference = value.trim().toLowerCase();
    return Boolean(preference) && location.includes(preference);
  });
  const remotePreferred = profile.remotePreference === "REMOTE" || profile.remotePreference === "FLEXIBLE";
  if (job.remote && remotePreferred) {
    components.location = 15;
    positives.push("Remote option matches preference");
  } else if (preferredLocation) {
    components.location = 15;
    positives.push("Location matches preference");
  } else {
    components.location = 3;
    cautions.push("Location is outside current preferences");
  }

  // Education compatibility (10): only penalize when the copy explicitly frames a degree as mandatory.
  const mandatoryDegree = /(?:degree|bachelor'?s|bsc).{0,30}(?:required|mandatory|essential)/i.test(job.description);
  components.education = mandatoryDegree && !profile.education ? 2 : 10;
  if (mandatoryDegree && !profile.education) cautions.push("Mandatory degree language detected");

  // Direct source (10): current adapters point to employer/ATS application flows.
  components.direct = 10;
  positives.push("Direct application source");

  let score = Object.values(components).reduce((sum, value) => sum + value, 0);

  // Confidence caps prevent one strong dimension from masking a material gap.
  // These are deterministic guardrails, not hard rejections; users can still inspect
  // the role, but it will not crowd out more actionable opportunities in Apply Today.
  if (experience.min != null && experience.min > profile.yearsExperience + 2) {
    score = Math.min(score, 64);
  } else if (experience.min != null && experience.min > profile.yearsExperience + 1) {
    score = Math.min(score, 79);
  }
  if (detectedSkills.length >= 3 && missingSkills.length > matchedSkills.length) {
    score = Math.min(score, 69);
  }
  if (!job.remote && !preferredLocation) {
    score = Math.min(score, 74);
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    matchedSkills,
    missingSkills,
    requiredExperienceMin: experience.min,
    requiredExperienceMax: experience.max,
    data: {
      filtered: false,
      filterReasons: [],
      components,
      positives,
      cautions,
      detectedSkills,
      ...experienceMeta,
    },
  };
}
