import assert from "node:assert/strict";
import test from "node:test";
import {
  applicationPriority,
  getApplicationReadiness,
  getFollowUpState,
  getNextApplicationAction,
} from "../lib/application-intelligence";

// Fixed timestamps keep the suite deterministic regardless of the machine or timezone running CI.
const now = new Date("2026-08-23T12:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

// A planned application is only READY when fit, CV, motivation and context have all been captured.
test("marks a fully prepared planned application as ready to apply", () => {
  const input = {
    status: "PLANNED" as const,
    resumeVersion: "cv-full-stack-v3.pdf",
    coverLetterVersion: "motivation-v2",
    notes: "Emphasise Next.js and PostgreSQL portfolio work.",
    updatedAt: daysAgo(0),
    applyVerdict: "APPLY" as const,
    matchScore: 84,
  };

  assert.equal(getApplicationReadiness(input).score, 100);
  assert.deepEqual(getNextApplicationAction(input, now), {
    action: "APPLY_NOW",
    urgency: "HIGH",
    reason: "Application materials are ready and the role passed the fit check.",
  });
});

// A submitted application that has not moved for a week should return to the candidate's action queue.
test("flags a stale submitted application for follow-up", () => {
  const input = {
    status: "APPLIED" as const,
    appliedAt: daysAgo(8),
    updatedAt: daysAgo(8),
    matchScore: 78,
  };

  assert.equal(getFollowUpState(input, now).label, "FOLLOW_UP");
  assert.equal(getNextApplicationAction(input, now).action, "FOLLOW_UP");
});

// Active recruitment stages are intentionally treated as higher-value work than passive waiting.
test("prioritises an active interview stage above a closed application", () => {
  const active = {
    status: "INTERVIEW" as const,
    updatedAt: daysAgo(1),
    resumeVersion: "cv.pdf",
    coverLetterVersion: "letter",
    notes: "Prepare STAR examples.",
    applyVerdict: "APPLY" as const,
    matchScore: 90,
  };
  const closed = { ...active, status: "REJECTED" as const };

  assert.ok(applicationPriority(active) > applicationPriority(closed));
  assert.equal(getNextApplicationAction(active, now).action, "FOCUS_STAGE");
  assert.equal(getNextApplicationAction(closed, now).action, "ARCHIVE");
});
