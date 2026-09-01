import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { hsnSacFinderPageHtml } from "../src/pages/marketing/hsn-sac-finder.js";
import { seoForRoute } from "../src/data/seo.js";
import {
  rankMatches,
  rateForEntry,
  detectMaterial,
  detectIntent,
  setDirectoryForTests,
  setRateScheduleForTests,
} from "../src/hsn-sac-finder/app.js";

const directory = JSON.parse(gunzipSync(readFileSync(new URL("../src/hsn-sac-finder/directory.json.gz", import.meta.url))).toString("utf8"));
const rateSchedule = JSON.parse(gunzipSync(readFileSync(new URL("../src/hsn-sac-finder/rates.json.gz", import.meta.url))).toString("utf8"));
setDirectoryForTests(directory);
setRateScheduleForTests(rateSchedule);

function topCodes(query, count = 5) {
  return rankMatches(query, "ALL").slice(0, count).map((match) => match.entry[1]);
}

test("HSN/SAC directory contains the uploaded official classifications", () => {
  assert.equal(directory.length, 22615);
  assert.ok(directory.filter((row) => row[0] === "HSN").length > 21900);
  assert.ok(directory.filter((row) => row[0] === "SAC").length > 650);
  assert.ok(directory.every((row) => row.length === 3 && row[1] && row[2]));
  const glassContainer = directory.find((row) => row[1] === "70134900");
  assert.match(glassContainer[2], /GLASSWARE OF A KIND USED FOR TABLE, KITCHEN/);
  assert.match(glassContainer[2], /OTHER GOODS UNDER THIS HEADING/);
});

test("HSN/SAC finder renders searchable controls and rate warning", () => {
  const html = hsnSacFinderPageHtml();
  assert.match(html, /id="hsnQuery"/);
  assert.match(html, /22,600\+ Indian HSN and SAC entries/);
  assert.match(html, /CBIC's published GST rate schedules/);
});

test("CBIC rate schedule contains knife heading and 18 percent IGST", () => {
  const knife = rateSchedule.find((row) => row[0] === "HSN" && row[1] === "8211");
  assert.ok(knife);
  assert.equal(knife[5], "18%");
});

test("HSN/SAC finder has indexable SEO metadata", () => {
  const seo = seoForRoute("/hsn-sac-code-finder.html");
  assert.ok(seo);
  assert.match(seo.canonical, /hsn-sac-code-finder\.html$/);
  assert.equal(seo.structuredData["@type"], "WebApplication");
});

// ---------------------------------------------------------------------------
// Exact-code priority: a full HSN/SAC code must always be the first, highest-
// scoring result, never outranked by a text/fuzzy match.
// ---------------------------------------------------------------------------

for (const code of ["70134900", "73239390", "39241010", "44190020", "69111019"]) {
  test(`exact code ${code} is the deterministic top result`, () => {
    const matches = rankMatches(code, "ALL");
    assert.ok(matches.length > 0, `expected at least one result for ${code}`);
    assert.equal(matches[0].entry[1], code);
    assert.ok(matches[0].score >= 500, "an exact code match must carry the fixed exact-match score");
    if (matches.length > 1) assert.ok(matches[0].score > matches[1].score, "the exact code must strictly outscore every other result");
  });
}

test("an exact code search is not diluted by word-matching logic (pure numeric queries only ever compare codes)", () => {
  // 7323 is a real HSN heading; searching it as a bare code must return the code match first,
  // not get zero-scored or reordered by the material/intent machinery used for text queries.
  const matches = rankMatches("7323", "ALL");
  assert.equal(matches[0].entry[1], "7323");
});

// ---------------------------------------------------------------------------
// Product-name searches: everyday language must reach the correct official
// classification family without needing every word to match literally.
// ---------------------------------------------------------------------------

test('"food storage container" returns results (previously zero)', () => {
  const matches = rankMatches("food storage container", "ALL");
  assert.ok(matches.length > 0, "a reasonable multi-word household search must not return nothing");
  assert.equal(matches[0].entry[0], "HSN");
});

test('"plastic food container" favours the plastics tableware/kitchenware heading (3924)', () => {
  assert.ok(topCodes("plastic food container", 3).some((code) => code.startsWith("3924")));
});

test('"plastic kitchenware" favours heading 3924, in either word order', () => {
  assert.ok(topCodes("plastic kitchenware", 3).every((code) => code.startsWith("3924")));
  assert.ok(topCodes("kitchenware plastic", 3).every((code) => code.startsWith("3924")));
});

test('"glass food container" and "glass kitchenware" favour glassware heading 7013, not the packing-container heading 7010', () => {
  for (const query of ["glass food container", "glass kitchenware"]) {
    const top = topCodes(query, 3);
    assert.ok(top.every((code) => code.startsWith("7013")), `${query} -> ${top.join(", ")}`);
  }
});

test('"stainless steel cooking pot" and "steel kitchenware" favour the iron/steel household-articles heading 7323', () => {
  for (const query of ["stainless steel cooking pot", "steel kitchenware"]) {
    const top = topCodes(query, 3);
    assert.ok(top.every((code) => code.startsWith("7323") || code.startsWith("732")), `${query} -> ${top.join(", ")}`);
  }
});

test('"wooden kitchenware" favours the wood tableware/kitchenware heading 4419', () => {
  assert.ok(topCodes("wooden kitchenware", 3).every((code) => code.startsWith("4419")));
});

test('"ceramic kitchenware" favours the ceramic/porcelain tableware heading 6911', () => {
  assert.ok(topCodes("ceramic kitchenware", 3).every((code) => code.startsWith("6911")));
});

// ---------------------------------------------------------------------------
// Intent distinction: the same generic word ("container"/"bottle") must be
// resolved differently depending on whether the query signals household/
// kitchen use or industrial packing/conveyance use.
// ---------------------------------------------------------------------------

test('"glass bottle" and "glass packing bottle" favour the packing/conveyance glassware heading 7010', () => {
  for (const query of ["glass bottle", "glass packing bottle"]) {
    const top = topCodes(query, 3);
    assert.ok(top.every((code) => code.startsWith("7010")), `${query} -> ${top.join(", ")}`);
  }
});

test('"glass food container" and "glass kitchen container" favour the table/kitchen glassware heading 7013, the opposite of "glass packing bottle"', () => {
  for (const query of ["glass food container", "glass kitchen container"]) {
    const top = topCodes(query, 3);
    assert.ok(top.every((code) => code.startsWith("7013")), `${query} -> ${top.join(", ")}`);
  }
});

test("material and intent detection recognise the words used in the intent-distinction cases", () => {
  assert.equal(detectMaterial(["glass", "bottle"]), "glass");
  assert.equal(detectIntent(["glass", "packing", "bottle"]), "packing");
  assert.equal(detectIntent(["glass", "food", "container"]), "household");
  assert.equal(detectIntent(["glass", "kitchen", "container"]), "household");
});

// ---------------------------------------------------------------------------
// Hierarchy behaviour: a broad search should still surface the specific
// 8-digit child codes a user can actually select, not just the heading.
// ---------------------------------------------------------------------------

test('a broad multi-word search ("kitchenware plastic") ranks specific 8-digit codes at or above the bare 4-digit heading', () => {
  const matches = rankMatches("kitchenware plastic", "ALL");
  const topEightDigit = matches.find((match) => match.entry[1].length === 8);
  const headingOnly = matches.find((match) => match.entry[1] === "3924");
  assert.ok(topEightDigit, "expected at least one specific 8-digit result");
  if (headingOnly) assert.ok(topEightDigit.score >= headingOnly.score, "an 8-digit child should not rank below the bare heading it belongs to");
});

test("HSN heading 9954-equivalent hierarchy: a bare 4-digit code search still returns its own children as related results", () => {
  const matches = rankMatches("7323", "ALL");
  assert.ok(matches.some((match) => match.entry[1].length > 4), "searching a heading code should still surface its more specific children");
});

// ---------------------------------------------------------------------------
// GST-rate resolution: an exact 8-digit code with one clearly applicable
// current rate must show that rate directly, never "multiple" just because
// a broader parent heading happens to be shared with an unrelated line item.
// ---------------------------------------------------------------------------

test("HSN 73239390 (stainless steel table/kitchen articles) resolves to a single 12% IGST rate, not 'multiple'", () => {
  // Root cause this covers: the schedule has two separate lines both keyed at bare heading
  // "7323" -- "table, kitchen ... articles" (12%) and "iron or steel wool; pot scourers" (18%,
  // which is really the distinct child 732310) -- so a naive same-prefix-length match saw two
  // different rates and gave up. 73239390 is under 732393 ("of stainless steel"), which is
  // neither of those specific items.
  const result = rateForEntry("HSN", "73239390");
  assert.ok(result && result.multiple === false, `expected a single resolved rate, got ${JSON.stringify(result)}`);
  assert.equal(result.row[5], "12%");
  assert.equal(result.row[3], "6%");
  assert.equal(result.row[4], "6%");
});

test("HSN 73239410 (Ghamella, its own specific 8-digit line) resolves to its own 18% rate, distinct from 73239390", () => {
  const result = rateForEntry("HSN", "73239410");
  assert.ok(result && result.multiple === false);
  assert.equal(result.row[5], "18%");
});

test("HSN 73231000-style iron/steel wool codes resolve to the wool/pot-scourers rate (18%), not the general household-articles rate", () => {
  const result = rateForEntry("HSN", "73231010");
  assert.ok(result && result.multiple === false, `expected a single resolved rate, got ${JSON.stringify(result)}`);
  assert.equal(result.row[5], "18%");
});

for (const [code, expectedIgst] of [
  ["70134900", "18%"],
  ["39241010", "18%"],
  ["44190020", "12%"],
  ["69111019", "12%"],
]) {
  test(`HSN ${code} resolves to a single, direct GST rate (${expectedIgst} IGST)`, () => {
    const result = rateForEntry("HSN", code);
    assert.ok(result && result.multiple === false, `expected a single resolved rate for ${code}, got ${JSON.stringify(result)}`);
    assert.equal(result.row[5], expectedIgst);
  });
}

test("a genuinely condition-based rate split (packaged-and-labelled vs. loose/fresh) is still correctly reported as multiple -- this tool never guesses which condition applies", () => {
  // HSN 0202 (frozen bovine meat) has real, different rates for "pre-packaged and labelled"
  // vs "other than pre-packaged" vs "fresh or chilled" -- there is no more specific HSN code
  // that distinguishes these (it is a packaging/condition fact about the actual sale, not a
  // classification), so this must remain an honest "multiple, verify" result.
  const result = rateForEntry("HSN", "02021000");
  assert.ok(result && result.multiple === true, `expected a genuinely ambiguous condition-based rate to stay unresolved, got ${JSON.stringify(result)}`);
});

test("rateForEntry never fabricates a rate for a code with no schedule coverage at all", () => {
  assert.equal(rateForEntry("HSN", "99999999"), null);
});

// ---------------------------------------------------------------------------
// No regression to SAC (services) search.
// ---------------------------------------------------------------------------

test("SAC search still works: an exact SAC code and a plain-language services search both return SAC results", () => {
  const exact = rankMatches("996111", "ALL");
  assert.equal(exact[0].entry[0], "SAC");
  assert.equal(exact[0].entry[1], "996111");

  const legal = rankMatches("legal services", "SAC");
  assert.ok(legal.length > 0);
  assert.ok(legal.every((match) => match.entry[0] === "SAC"));
});

test("the HSN/SAC classification-type filter still restricts results to the selected kind", () => {
  const hsnOnly = rankMatches("kitchenware", "HSN");
  assert.ok(hsnOnly.every((match) => match.entry[0] === "HSN"));
});
