export type SASourceTier = "DIRECT_ATS" | "DIRECT_COMPANY";

export type SAVerifiedSource = {
  name: string;
  slug: string;
  websiteUrl: string;
  careerUrl: string;
  scraperType: "GREENHOUSE" | "LEVER" | "CUSTOM";
  atsIdentifier?: string;
  tier: SASourceTier;
  priority: number;
  discoveryFocus: readonly string[];
};

/**
 * Curated South African employer sources. Keep this list focused on direct
 * employer application flows; aggregators can be useful for discovery later,
 * but they should not outrank the original employer vacancy.
 */
export const SA_VERIFIED_SOURCES: readonly SAVerifiedSource[] = [
  {
    name: "Takealot Group",
    slug: "takealot-group",
    websiteUrl: "https://takealotgroup.com",
    careerUrl: "https://job-boards.greenhouse.io/takealotgroup",
    scraperType: "GREENHOUSE",
    atsIdentifier: "takealotgroup",
    tier: "DIRECT_ATS",
    priority: 100,
    discoveryFocus: ["software engineer", "developer", "engineering", "data", "graduate", "junior"],
  },
  {
    name: "Ozow",
    slug: "ozow",
    websiteUrl: "https://ozow.com",
    careerUrl: "https://job-boards.greenhouse.io/ozow",
    scraperType: "GREENHOUSE",
    atsIdentifier: "ozow",
    tier: "DIRECT_ATS",
    priority: 95,
    discoveryFocus: ["software engineer", "developer", "technology", "support", "junior", "intern"],
  },
  {
    name: "BBD",
    slug: "bbd",
    websiteUrl: "https://bbdsoftware.com",
    careerUrl: "https://bbdsoftware.com/open-positions/",
    scraperType: "CUSTOM",
    tier: "DIRECT_COMPANY",
    priority: 90,
    discoveryFocus: ["graduate programme", "software development", "java", "platform", "bursary"],
  },
  {
    name: "Capitec",
    slug: "capitec",
    websiteUrl: "https://www.capitecbank.co.za",
    careerUrl: "https://careers.capitecbank.co.za/",
    scraperType: "CUSTOM",
    tier: "DIRECT_COMPANY",
    priority: 90,
    discoveryFocus: ["graduate", "software engineer", "data", "analytics", "information technology"],
  },
  {
    name: "Yoco",
    slug: "yoco",
    websiteUrl: "https://www.yoco.com/za",
    careerUrl: "https://www.yoco.com/za/careers/",
    scraperType: "CUSTOM",
    tier: "DIRECT_COMPANY",
    priority: 85,
    discoveryFocus: ["engineering", "software", "product", "data", "technology"],
  },
];

const EARLY_CAREER_PATTERNS = [
  /\bgraduate\b/i,
  /\bgraduate programme\b/i,
  /\bjunior\b/i,
  /\bintern(?:ship)?\b/i,
  /\blearnership\b/i,
  /\bentry[- ]level\b/i,
  /\bassociate\b/i,
  /\btrainee\b/i,
  /\bbursary\b/i,
];

const TECH_PATTERNS = [
  /software/i,
  /developer/i,
  /engineer/i,
  /frontend|front-end/i,
  /backend|back-end/i,
  /full[ -]?stack/i,
  /web/i,
  /data/i,
  /analytics/i,
  /application support/i,
  /technical support/i,
  /information technology|\bIT\b/i,
  /digital/i,
];

export function isEarlyCareerOpportunity(title: string, description = ""): boolean {
  const text = `${title} ${description}`;
  return EARLY_CAREER_PATTERNS.some((pattern) => pattern.test(text));
}

export function isTechOpportunity(title: string, description = ""): boolean {
  const text = `${title} ${description}`;
  return TECH_PATTERNS.some((pattern) => pattern.test(text));
}

export function sourceQualityScore(input: {
  source: "GREENHOUSE" | "LEVER" | "COMPANY_SITE";
  applyUrl: string;
  sourceUrl: string;
}): number {
  const direct = input.source === "GREENHOUSE" || input.source === "LEVER" || input.source === "COMPANY_SITE";
  const secure = /^https:\/\//i.test(input.applyUrl) && /^https:\/\//i.test(input.sourceUrl);
  let score = direct ? 80 : 40;
  if (secure) score += 10;
  if (input.applyUrl !== input.sourceUrl) score += 5;
  return Math.min(100, score);
}
