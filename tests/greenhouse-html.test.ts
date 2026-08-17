import assert from "node:assert/strict";
import test from "node:test";

import { htmlToPlainText } from "../scrapers/ats/greenhouse";

test("decodes escaped Greenhouse HTML into readable plain text", () => {
  const input =
    "&lt;div&gt;&lt;p&gt;Build C++ &amp;amp; TypeScript&lt;/p&gt;&lt;p&gt;4+ years&amp;nbsp;experience &amp;mdash; remote&lt;/p&gt;&lt;/div&gt;";

  assert.equal(
    htmlToPlainText(input),
    "Build C++ & TypeScript 4+ years experience — remote"
  );
});

test("strips ordinary HTML returned by Greenhouse", () => {
  assert.equal(
    htmlToPlainText("<p>Hello <strong>world</strong></p>"),
    "Hello world"
  );
});
