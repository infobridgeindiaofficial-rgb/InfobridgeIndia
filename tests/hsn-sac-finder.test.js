import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { hsnSacFinderPageHtml } from "../src/pages/marketing/hsn-sac-finder.js";
import { seoForRoute } from "../src/data/seo.js";

test("HSN/SAC directory contains the uploaded official classifications", () => {
  const data = JSON.parse(gunzipSync(readFileSync(new URL("../src/hsn-sac-finder/directory.json.gz", import.meta.url))).toString("utf8"));
  assert.equal(data.length, 22615);
  assert.ok(data.filter((row) => row[0] === "HSN").length > 21900);
  assert.ok(data.filter((row) => row[0] === "SAC").length > 650);
  assert.ok(data.every((row) => row.length === 3 && row[1] && row[2]));
});

test("HSN/SAC finder renders searchable controls and rate warning", () => {
  const html = hsnSacFinderPageHtml();
  assert.match(html, /id="hsnQuery"/);
  assert.match(html, /22,600\+ Indian HSN and SAC entries/);
  assert.match(html, /does not include GST rates/);
});

test("HSN/SAC finder has indexable SEO metadata", () => {
  const seo = seoForRoute("/hsn-sac-code-finder.html");
  assert.ok(seo);
  assert.match(seo.canonical, /hsn-sac-code-finder\.html$/);
  assert.equal(seo.structuredData["@type"], "WebApplication");
});
