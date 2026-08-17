import assert from "node:assert/strict";
import test from "node:test";
import { scoreJob } from "../jobs/score";

const profile = {
  targetRoles: ["Frontend Developer"],
  preferredRoles: ["Software Engineer"],
  skills: ["JavaScript", "TypeScript", "React", "Next.js", "Git"],
  strongSkills: ["React", "TypeScript"],
  secondarySkills: ["PostgreSQL"],
  yearsExperience: 2,
  preferredLocations: ["Johannesburg", "Remote"],
  remotePreference: "FLEXIBLE" as const,
  education: "Computer Science studies",
  excludedKeywords: ["VP Engineering"],
  preferredKeywords: ["frontend", "react", "typescript"],
};

test("scores a strong frontend role above threshold", () => {
  const result = scoreJob(
    {
      title: "Frontend Developer",
      description: "Build React and TypeScript applications. 2+ years experience. Git required.",
      location: "Remote",
      remote: true,
      source: "GREENHOUSE",
    },
    profile
  );

  assert.ok(result.score >= 65);
  assert.ok(result.matchedSkills.includes("React"));
  assert.equal(result.data.filtered, false);
});

test("hard filters excluded leadership titles", () => {
  const result = scoreJob(
    {
      title: "VP Engineering",
      description: "Lead the engineering organisation.",
      location: "Johannesburg",
      remote: false,
      source: "LEVER",
    },
    profile
  );

  assert.equal(result.score, 0);
  assert.equal(result.data.filtered, true);
});
