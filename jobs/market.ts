export type SAVerdict = "APPLY" | "MAYBE" | "SKIP";

export type SAStoredInsight = {
  sa?: {
    country?: "ZA" | "UNKNOWN";
    province?: string;
    city?: string;
    workMode?: string;
    careerLevel?: string;
    qualification?: string;
    salary?: {
      currency?: "ZAR";
      minMonthly?: number;
      maxMonthly?: number;
      disclosure?: string;
    };
  };
  eligibility?: {
    verdict?: SAVerdict;
    reason?: string;
    hardRequirements?: string[];
    preferredRequirements?: string[];
    learnableGaps?: string[];
  };
};

export function readSAInsight(value: unknown): SAStoredInsight {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as SAStoredInsight;
}

export function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}

export function formatZAR(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function countBy(values: Array<string | null | undefined>): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
