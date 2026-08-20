export function discoveredSinceDays(days: number): Date | undefined {
  if (!Number.isFinite(days) || days <= 0) {
    return undefined;
  }

  return new Date(Date.now() - days * 86_400_000);
}
