import assert from "node:assert/strict";
import test from "node:test";
import { extractExperienceRequirement } from "../jobs/experience";

test("extracts numeric minimum experience", () => {
  assert.equal(extractExperienceRequirement("Minimum 3 years experience building web apps").min, 3);
});

test("extracts experience ranges", () => {
  const result = extractExperienceRequirement("You have 3-5 years experience in software engineering");
  assert.equal(result.min, 3);
  assert.equal(result.max, 5);
});

test("extracts word-form years", () => {
  assert.equal(extractExperienceRequirement("Five years of relevant experience is preferred").min, 5);
});

test("returns an empty requirement when no years are stated", () => {
  assert.deepEqual(extractExperienceRequirement("Experience with React is useful"), {});
});
