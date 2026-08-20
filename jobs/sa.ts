export type SAVerdict = "APPLY" | "MAYBE" | "SKIP";

export type SANormalizedJob = {
  country: "ZA" | "UNKNOWN";
  province?: string;
  city?: string;
  workMode: "REMOTE_SA" | "REMOTE_GLOBAL" | "HYBRID" | "ONSITE" | "UNKNOWN";
  careerLevel: "LEARNERSHIP" | "INTERNSHIP" | "GRADUATE" | "JUNIOR" | "INTERMEDIATE" | "SENIOR" | "UNKNOWN";
  qualification: "MATRIC" | "CERTIFICATE" | "DIPLOMA" | "DEGREE" | "EQUIVALENT_EXPERIENCE" | "UNSPECIFIED";
  salary?: {
    currency: "ZAR";
    minMonthly?: number;
    maxMonthly?: number;
    disclosure: "DISCLOSED" | "MARKET_RELATED" | "NEGOTIABLE" | "UNDISCLOSED";
  };
};

export type SAEligibility = {
  hardRequirements: string[];
  preferredRequirements: string[];
  learnableGaps: string[];
  verdict: SAVerdict;
  reason: string;
};

const PROVINCES: Array<{ name: string; aliases: string[] }> = [
  { name: "Gauteng", aliases: ["gauteng", "johannesburg", "joburg", "sandton", "midrand", "pretoria", "tshwane", "centurion", "randburg", "roodepoort"] },
  { name: "Western Cape", aliases: ["western cape", "cape town", "stellenbosch", "bellville", "somerset west"] },
  { name: "KwaZulu-Natal", aliases: ["kwazulu-natal", "kwazulu natal", "kzn", "durban", "umhlanga", "pietermaritzburg"] },
  { name: "Eastern Cape", aliases: ["eastern cape", "gqeberha", "port elizabeth", "east london"] },
  { name: "Free State", aliases: ["free state", "bloemfontein"] },
  { name: "Limpopo", aliases: ["limpopo", "polokwane"] },
  { name: "Mpumalanga", aliases: ["mpumalanga", "mbombela", "nelspruit"] },
  { name: "North West", aliases: ["north west", "rustenburg", "mahikeng", "potchefstroom"] },
  { name: "Northern Cape", aliases: ["northern cape", "kimberley"] },
];

const SA_MARKERS = [
  "south africa",
  "gauteng",
  "western cape",
  "kwazulu",
  "kzn",
  "johannesburg",
  "cape town",
  "pretoria",
  "durban",
  "centurion",
  "midrand",
  "sandton",
  "randburg",
  "stellenbosch",
];

function findProvince(text: string): string | undefined {
  return PROVINCES.find((province) => province.aliases.some((alias) => text.includes(alias)))?.name;
}

function findCity(text: string): string | undefined {
  const cities = [
    "Johannesburg", "Cape Town", "Pretoria", "Durban", "Centurion", "Midrand", "Sandton", "Randburg",
    "Stellenbosch", "Gqeberha", "East London", "Bloemfontein", "Polokwane", "Mbombela", "Rustenburg", "Kimberley",
  ];
  return cities.find((city) => text.includes(city.toLowerCase()));
}

function parseMoney(value: string): number {
  const compact = value.toLowerCase().replace(/\s|,/g, "");
  const number = Number.parseFloat(compact.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(number)) return 0;
  return compact.includes("k") ? number * 1000 : number;
}

function normalizeMonthlySalary(text: string): SANormalizedJob["salary"] {
  if (/market\s*related/i.test(text)) return { currency: "ZAR", disclosure: "MARKET_RELATED" };
  if (/negotiable/i.test(text)) return { currency: "ZAR", disclosure: "NEGOTIABLE" };

  const range = text.match(/R\s*([\d,.]+\s*k?)\s*(?:-|to|–)\s*R?\s*([\d,.]+\s*k?)\s*(?:per\s*month|pm|p\/m|monthly)/i);
  if (range) {
    return {
      currency: "ZAR",
      minMonthly: Math.round(parseMoney(range[1])),
      maxMonthly: Math.round(parseMoney(range[2])),
      disclosure: "DISCLOSED",
    };
  }

  const monthly = text.match(/R\s*([\d,.]+\s*k?)\s*(?:per\s*month|pm|p\/m|monthly)/i);
  if (monthly) {
    return { currency: "ZAR", minMonthly: Math.round(parseMoney(monthly[1])), disclosure: "DISCLOSED" };
  }

  const annual = text.match(/R\s*([\d,.]+\s*k?)\s*(?:per\s*annum|pa|p\/a|annual|annually)/i);
  if (annual) {
    return { currency: "ZAR", minMonthly: Math.round(parseMoney(annual[1]) / 12), disclosure: "DISCLOSED" };
  }

  return undefined;
}

export function normalizeSAJob(job: { title: string; description: string; location?: string | null; remote: boolean }): SANormalizedJob {
  const text = `${job.title} ${job.description} ${job.location ?? ""}`.toLowerCase();
  const country = SA_MARKERS.some((marker) => text.includes(marker)) || /(?:,|\(|\s)za(?:\)|,|\s|$)/i.test(text) ? "ZA" : "UNKNOWN";
  const province = findProvince(text);
  const city = findCity(text);

  let workMode: SANormalizedJob["workMode"] = "UNKNOWN";
  if (/remote\s+(?:within\s+)?south africa|remote\s+sa|south africa\s+remote/i.test(text)) workMode = "REMOTE_SA";
  else if (/remote\s+(?:worldwide|globally|anywhere)|work from anywhere/i.test(text)) workMode = "REMOTE_GLOBAL";
  else if (/hybrid/i.test(text)) workMode = "HYBRID";
  else if (/on[- ]?site|office[- ]based/i.test(text)) workMode = "ONSITE";
  else if (job.remote) workMode = country === "ZA" ? "REMOTE_SA" : "REMOTE_GLOBAL";

  let careerLevel: SANormalizedJob["careerLevel"] = "UNKNOWN";
  if (/learnership/i.test(text)) careerLevel = "LEARNERSHIP";
  else if (/intern(ship)?|trainee/i.test(text)) careerLevel = "INTERNSHIP";
  else if (/graduate|grad programme|graduate programme/i.test(text)) careerLevel = "GRADUATE";
  else if (/junior|entry[- ]level|associate/i.test(text)) careerLevel = "JUNIOR";
  else if (/senior|lead|principal|staff engineer/i.test(text)) careerLevel = "SENIOR";
  else if (/intermediate|mid[- ]level|midweight/i.test(text)) careerLevel = "INTERMEDIATE";

  let qualification: SANormalizedJob["qualification"] = "UNSPECIFIED";
  if (/matric|grade\s*12|national senior certificate/i.test(text)) qualification = "MATRIC";
  if (/certificate|higher certificate/i.test(text)) qualification = "CERTIFICATE";
  if (/diploma|national diploma/i.test(text)) qualification = "DIPLOMA";
  if (/degree|bachelor'?s|bsc|b\.sc/i.test(text)) qualification = "DEGREE";
  if (/degree\s+or\s+(?:equivalent|relevant)\s+experience|equivalent\s+experience/i.test(text)) qualification = "EQUIVALENT_EXPERIENCE";

  return {
    country,
    province,
    city,
    workMode,
    careerLevel,
    qualification,
    salary: normalizeMonthlySalary(`${job.title} ${job.description}`),
  };
}

export function evaluateSAEligibility(input: {
  description: string;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  yearsExperience: number;
  requiredExperienceMin?: number;
  education?: string | null;
  normalized: SANormalizedJob;
}): SAEligibility {
  const text = input.description.toLowerCase();
  const hardRequirements: string[] = [];
  const preferredRequirements: string[] = [];
  const learnableGaps: string[] = [];

  if (/(south african citizen|sa citizen|south african citizenship|valid south african id)/i.test(text)) {
    hardRequirements.push("South African citizenship / ID requirement stated");
  }
  if (/(must have|required).{0,35}(degree|bachelor|bsc)/i.test(input.description)) {
    hardRequirements.push("Degree is presented as mandatory");
  } else if (/(degree|bachelor|bsc).{0,35}(preferred|advantage|beneficial)/i.test(input.description)) {
    preferredRequirements.push("Degree is preferred rather than mandatory");
  }
  if (input.requiredExperienceMin != null && input.requiredExperienceMin > input.yearsExperience + 2) {
    hardRequirements.push(`Experience requirement is about ${input.requiredExperienceMin} years`);
  } else if (input.requiredExperienceMin != null && input.requiredExperienceMin > input.yearsExperience) {
    preferredRequirements.push(`Experience is a stretch at about ${input.requiredExperienceMin} years`);
  }

  if (input.missingSkills.length) {
    learnableGaps.push(...input.missingSkills.slice(0, 5).map((skill) => `Skill gap: ${skill}`));
  }

  let verdict: SAVerdict = "MAYBE";
  let reason = "Reasonable overlap, but review the gaps before applying.";

  if (hardRequirements.length >= 2 || input.score < 45) {
    verdict = "SKIP";
    reason = hardRequirements[0] ?? "The match is currently too weak to prioritise.";
  } else if (input.score >= 70 && hardRequirements.length === 0) {
    verdict = "APPLY";
    reason = input.missingSkills.length
      ? "Strong overall fit; the remaining gaps look learnable rather than disqualifying."
      : "Strong fit across the main signals with no obvious hard blocker detected.";
  }

  return { hardRequirements, preferredRequirements, learnableGaps, verdict, reason };
}
