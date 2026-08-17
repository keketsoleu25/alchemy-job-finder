export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeTitle(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

export function normalizeLocation(
  value?: string
): string | undefined {
  if (!value) return undefined;

  const normalized = normalizeWhitespace(value);

  return normalized || undefined;
}