import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/analytics/app.js", import.meta.url), "utf8");

test("Reports uses a country-neutral Tax & Statutory navigation label", () => {
  assert.match(source, /const nav=\[[^\n]+"Tax & Statutory"/);
  assert.match(source, /view==="Tax & Statutory"\?gst\(\)/);
});

test("Reports retains country-specific statutory page headings", () => {
  assert.match(source, /head\("VAT & Statutory"/);
  assert.match(source, /return head\("GST & Statutory"/);
});
