import { evaluateHardFilters } from "./filters";
import { extractExperienceRequirement } from "./experience";
import { normalizeSAJob, evaluateSAEligibility, type SANormalizedJob, type SAEligibility } from "./sa";
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
    sa: SANormalizedJob;
    eligibility: SAEligibility;
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
  const sa = normalizeSAJob(job);
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
        sa,
        eligibility: {
          hardRequirements: filter.reasons,
          preferredRequirements: [],
          learnableGaps: missingSkills.slice(0, 5).map((skill) => `Skill gap: ${skill}`),
          verdict: "SKIP",
          reason: filter.reasons[0] ?? "A hard filter rejected this role.",
        },
        ...experienceMeta,
      },
    };
  }

  components.technology = detectedSkills.length === 0
    ? 15
    : Math.round(30 * (matchedSkills.length / detectedSkills.length));
  if (matchedSkills.length) positives.push(`Matched skills: ${matchedSkills.slice(0, 5).join(", ")}`);
  if (missingSkills.length) cautions.push(`Skills to review: ${missingSkills.slice(0, 5).join(", ")}`);

  const targetMatch = [...profile.targetRoles, ...profile.preferredRoles]
    .filter(Boolean)
    .some((role) => includesPhrase(job.title, role));
  const preferredHits = profile.preferredKeywords.filter((keyword) => includesPhrase(fullText, keyword)).length;
  components.role = targetMatch ? 20 : Math.min(15, preferredHits * 3);
  if (targetMatch) positives.push("Role title matches a target role");

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
  } else if (sa.country === "ZA" && profile.preferredLocations.some((value) => /south africa|gauteng|western cape|kwazulu|kzn/i.test(value))) {
    components.location = 8;
    positives.push("Role is in the South African market");
  } else {
    components.location = 3;
    cautions.push("Location is outside current preferences");
  }

  const mandatoryDegree = /(?:degree|bachelor'?s|bsc).{0,30}(?:required|mandatory|essential)/i.test(job.description);
  components.education = mandatoryDegree && !profile.education ? 2 : 10;
  if (mandatoryDegree && !profile.education) cautions.push("Mandatory degree language detected");

  components.direct = 10;
  positives.push("Direct application source");

  let score = Object.values(components).reduce((sum, value) => sum + value, 0);

  if (experience.min != null && experience.min > profile.yearsExperience + 2) {
    score = Math.min(score, 64);
  } else if (experience.min != null && experience.min > profile.yearsExperience + 1) {
    score = Math.min(score, 79);
  }
  if (detectedSkills.length >= 3 && missingSkills.length > matchedSkills.length) {
    score = Math.min(score, 69);
  }
  if (!job.remote && !preferredLocation && sa.country !== "ZA") {
    score = Math.min(score, 74);
  }

  score = Math.max(0, Math.min(100, score));

  const eligibility = evaluateSAEligibility({
    description: job.description,
    score,
    matchedSkills,
    missingSkills,
    yearsExperience: profile.yearsExperience,
    requiredExperienceMin: experience.min,
    education: profile.education,
    normalized: sa,
  });

  if (sa.country === "ZA") positives.push("South African market signal detected");
  if (sa.careerLevel !== "UNKNOWN") positives.push(`Career level: ${sa.careerLevel.toLowerCase()}`);
  if (eligibility.preferredRequirements.length) cautions.push(...eligibility.preferredRequirements);

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
      sa,
      eligibility,
      ...experienceMeta,
    },
  };
}
