const DAY_MS = 86_400_000;
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

/**
 * Return the UTC instant corresponding to midnight in South African Standard Time.
 * Alchemy is currently a personal South Africa-focused tool, and SAST has no DST,
 * so this keeps dashboard/card definitions stable on local Windows and UTC hosts.
 */
export function startOfSastDayUtc(date = new Date()): Date {
  const shifted = new Date(date.getTime() + SAST_OFFSET_MS);
  const shiftedMidnightUtc = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  );

  return new Date(shiftedMidnightUtc - SAST_OFFSET_MS);
}

export function sastCalendarDayDifference(earlier: Date, now = new Date()): number {
  const todayStart = startOfSastDayUtc(now).getTime();
  const earlierStart = startOfSastDayUtc(earlier).getTime();

  return Math.max(0, Math.round((todayStart - earlierStart) / DAY_MS));
}
