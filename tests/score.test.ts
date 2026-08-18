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
  preferredLocations: ["Johannesburg", "South Africa", "Remote"],
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

test("rejects a remote role explicitly restricted to the United States", () => {
  const result = scoreJob(
    {
      title: "Software Engineer",
      description: "This full-time role can be held from our US hubs or remotely in the United States. Build React and TypeScript products.",
      location: "San Francisco, CA",
      remote: false,
      source: "GREENHOUSE",
    },
    profile
  );

  assert.equal(result.score, 0);
  assert.equal(result.data.filtered, true);
  assert.ok(result.data.filterReasons.some((reason) => reason.includes("United States")));
});

test("specialist technologies reduce an otherwise broad software-engineer match", () => {
  const result = scoreJob(
    {
      title: "Software Engineer - C++",
      description: "Build high-performance C++ and WebAssembly systems with TypeScript and React. 4+ years experience.",
      location: "Remote",
      remote: true,
      source: "GREENHOUSE",
    },
    profile
  );

  assert.ok(result.missingSkills.includes("C++"));
  assert.ok(result.missingSkills.includes("WebAssembly"));
  assert.ok(result.score < 80);
});

test("non-preferred onsite locations cannot rank as elite matches", () => {
  const result = scoreJob(
    {
      title: "Frontend Developer",
      description: "Build React and TypeScript applications. 2 years experience.",
      location: "London, England",
      remote: false,
      source: "LEVER",
    },
    profile
  );

  assert.ok(result.score <= 74);
  assert.ok(result.data.cautions.includes("Location is outside current preferences"));
});
