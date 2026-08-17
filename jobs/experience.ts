export type ExperienceRequirement = {
  min?: number;
  max?: number;
  raw?: string;
};

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function toNumber(value: string): number | undefined {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return WORD_NUMBERS[value.toLowerCase()];
}

export function extractExperienceRequirement(text: string): ExperienceRequirement {
  const normalized = text.replace(/\s+/g, " ");

  const range = normalized.match(/\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*\+?\s*years?\b/i);
  if (range) {
    return { min: Number(range[1]), max: Number(range[2]), raw: range[0] };
  }

  const numeric = normalized.match(/\b(?:minimum\s+|at\s+least\s+)?(\d{1,2})\s*\+?\s*years?(?:\s+of)?\s+(?:relevant\s+)?experience\b/i)
    ?? normalized.match(/\b(\d{1,2})\s*\+?\s*years?\b/i);
  if (numeric) {
    const years = Number(numeric[1]);
    return { min: years, raw: numeric[0] };
  }

  const words = normalized.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+years?(?:\s+of)?\s+(?:relevant\s+)?experience\b/i);
  if (words) {
    const years = toNumber(words[1]);
    return { min: years, raw: words[0] };
  }

  return {};
}
