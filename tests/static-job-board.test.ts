import test from "node:test";
import assert from "node:assert/strict";

// Regression guard: the board adapter must remain importable after source-specific
// hardening. Live HTTP behavior is exercised by the hunt:sa smoke run because the
// public boards change markup independently of this repository.
test("static job board adapter loads", async () => {
  const module = await import("../scrapers/job-boards/static-job-board");
  assert.equal(typeof module.StaticJobBoardScraper, "function");
});
