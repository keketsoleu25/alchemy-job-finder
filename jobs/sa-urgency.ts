const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export type ApplicationUrgency = "CLOSED" | "TODAY" | "URGENT" | "SOON" | "OPEN" | "UNKNOWN";

function validDate(year: number, month: number, day: number): Date | undefined {
  const date = new Date(Date.UTC(year, month, day, 21, 59, 59));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return undefined;
  return date;
}

function toIso(date?: Date): string | undefined {
  return date?.toISOString();
}

export function extractClosingDate(text: string): string | undefined {
  if (!text) return undefined;

  const labelledNumeric = text.match(/(?:closing date|applications? close|apply by|deadline)\s*[:\-]?\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})/i);
  if (labelledNumeric) {
    return toIso(validDate(Number(labelledNumeric[3]), Number(labelledNumeric[2]) - 1, Number(labelledNumeric[1])));
  }

  const labelledWords = text.match(/(?:closing date|applications? close|apply by|deadline)\s*[:\-]?\s*(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})/i);
  if (labelledWords) {
    const month = MONTHS[labelledWords[2].toLowerCase()];
    if (month != null) return toIso(validDate(Number(labelledWords[3]), month, Number(labelledWords[1])));
  }

  const window = text.match(/(?:application dates?|applications? open).*?\bto\s+(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})/i);
  if (window) {
    const month = MONTHS[window[2].toLowerCase()];
    if (month != null) return toIso(validDate(Number(window[3]), month, Number(window[1])));
  }

  return undefined;
}

export function daysUntilClosing(closingDate?: string, now = new Date()): number | undefined {
  if (!closingDate) return undefined;
  const deadline = new Date(closingDate);
  if (Number.isNaN(deadline.getTime())) return undefined;
  return Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);
}

export function getApplicationUrgency(closingDate?: string, now = new Date()): ApplicationUrgency {
  const days = daysUntilClosing(closingDate, now);
  if (days == null) return "UNKNOWN";
  if (days < 0) return "CLOSED";
  if (days === 0) return "TODAY";
  if (days <= 3) return "URGENT";
  if (days <= 7) return "SOON";
  return "OPEN";
}

export type RadarJob = {
  matchScore: number | null;
  firstSeenAt: Date;
  matchData: unknown;
};

type RadarMatchData = {
  closingDate?: string;
  eligibility?: { verdict?: "APPLY" | "MAYBE" | "SKIP" };
  sa?: { country?: string; careerLevel?: string };
};

function readMatchData(value: unknown): RadarMatchData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as RadarMatchData;
}

export function radarPriority(job: RadarJob, now = new Date()): number {
  const data = readMatchData(job.matchData);
  const verdict = data.eligibility?.verdict;
  if (verdict === "SKIP") return -1000;

  let priority = job.matchScore ?? 0;
  if (verdict === "APPLY") priority += 35;
  else if (verdict === "MAYBE") priority += 10;

  if (data.sa?.country === "ZA") priority += 12;
  if (["GRADUATE", "JUNIOR", "INTERNSHIP", "LEARNERSHIP"].includes(data.sa?.careerLevel ?? "")) priority += 10;

  const urgency = getApplicationUrgency(data.closingDate, now);
  if (urgency === "TODAY") priority += 45;
  else if (urgency === "URGENT") priority += 30;
  else if (urgency === "SOON") priority += 15;
  else if (urgency === "CLOSED") return -1000;

  const ageDays = Math.max(0, (now.getTime() - job.firstSeenAt.getTime()) / 86_400_000);
  priority += Math.max(0, 12 - Math.floor(ageDays));

  return priority;
}

export function rankApplyToday<T extends RadarJob>(jobs: T[], now = new Date()): T[] {
  return [...jobs]
    .filter((job) => radarPriority(job, now) > -1000)
    .sort((a, b) => radarPriority(b, now) - radarPriority(a, now));
}

export function readClosingDate(matchData: unknown): string | undefined {
  return readMatchData(matchData).closingDate;
}
