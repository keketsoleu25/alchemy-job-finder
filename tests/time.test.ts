import assert from "node:assert/strict";
import test from "node:test";
import { sastCalendarDayDifference, startOfSastDayUtc } from "../lib/time";

test("SAST day starts at 22:00 UTC on the previous date", () => {
  const instant = new Date("2026-08-18T08:30:00.000Z");
  assert.equal(startOfSastDayUtc(instant).toISOString(), "2026-08-17T22:00:00.000Z");
});

test("calendar-day difference changes at SAST midnight, not after 24 elapsed hours", () => {
  const now = new Date("2026-08-18T06:30:00.000Z"); // 08:30 SAST
  const yesterdayLate = new Date("2026-08-17T20:45:00.000Z"); // 22:45 SAST previous day
  const todayEarly = new Date("2026-08-17T22:15:00.000Z"); // 00:15 SAST today

  assert.equal(sastCalendarDayDifference(yesterdayLate, now), 1);
  assert.equal(sastCalendarDayDifference(todayEarly, now), 0);
});
