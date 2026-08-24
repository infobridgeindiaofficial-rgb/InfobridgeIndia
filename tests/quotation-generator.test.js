import test from "node:test";
import assert from "node:assert/strict";
import { safeNumber, safeNonNegative, toMinor, fromMinor, computeLine, computeTotals, formatMoney, formatPlain, CURRENCIES } from "../src/quotation-generator/calc.js";

// ---------------------------------------------------------------------------
// safeNumber / safeNonNegative - invalid numeric input must never produce NaN
// ---------------------------------------------------------------------------

test("safeNumber never produces NaN for invalid/empty input", () => {
  assert.equal(safeNumber(""), 0);
  assert.equal(safeNumber(undefined), 0);
  assert.equal(safeNumber(null), 0);
  assert.equal(safeNumber("abc"), 0);
  assert.equal(safeNumber("12.5abc"), 12.5); // parseFloat behaviour: leading numeric prefix
  assert.equal(safeNumber("-4"), -4);
  assert.equal(safeNumber(NaN), 0);
  assert.equal(safeNumber(Infinity), 0);
  assert.equal(safeNumber("  42  "), 42);
});

test("safeNonNegative clamps negatives to zero but never produces NaN", () => {
  assert.equal(safeNonNegative("-10"), 0);
  assert.equal(safeNonNegative("abc"), 0);
  assert.equal(safeNonNegative("5"), 5);
});

// ---------------------------------------------------------------------------
// TEST 3: Quantity x Rate calculation
// ---------------------------------------------------------------------------

test("TEST 3: base amount = quantity x rate", () => {
  const line = computeLine({ qty: 3, rate: 250, taxPct: 0 });
  assert.equal(fromMinor(line.baseMinor), 750);
});

// ---------------------------------------------------------------------------
// TEST 4 / TEST 7: tax calculation, including zero-tax items
// ---------------------------------------------------------------------------

test("TEST 4: tax amount = base amount x tax%, line total = base + tax", () => {
  const line = computeLine({ qty: 2, rate: 500, taxPct: 18 });
  assert.equal(fromMinor(line.baseMinor), 1000);
  assert.equal(fromMinor(line.taxMinor), 180);
  assert.equal(fromMinor(line.totalMinor), 1180);
});

test("TEST 7: a zero-tax item contributes zero tax and its base amount unchanged", () => {
  const line = computeLine({ qty: 4, rate: 99.5, taxPct: 0 });
  assert.equal(fromMinor(line.baseMinor), 398);
  assert.equal(fromMinor(line.taxMinor), 0);
  assert.equal(fromMinor(line.totalMinor), 398);
});

// ---------------------------------------------------------------------------
// TEST 1 / TEST 2: single vs. multiple item quotations
// ---------------------------------------------------------------------------

test("TEST 1: a single-item quotation totals correctly with no discount", () => {
  const totals = computeTotals([{ qty: 1, rate: 1000, taxPct: 18 }], { discountType: "percentage", discountValue: 0 });
  assert.equal(fromMinor(totals.subtotalMinor), 1000);
  assert.equal(fromMinor(totals.taxMinor), 180);
  assert.equal(fromMinor(totals.discountMinor), 0);
  assert.equal(fromMinor(totals.grandTotalMinor), 1180);
});

test("TEST 2: a multiple-item quotation sums every line's base and tax independently", () => {
  const totals = computeTotals(
    [
      { qty: 2, rate: 100, taxPct: 5 }, // base 200, tax 10
      { qty: 1, rate: 349.5, taxPct: 12 }, // base 349.50, tax 41.94
      { qty: 3, rate: 20, taxPct: 0 }, // base 60, tax 0
    ],
    { discountType: "percentage", discountValue: 0 }
  );
  assert.equal(fromMinor(totals.subtotalMinor), 609.5);
  assert.equal(fromMinor(totals.taxMinor), 51.94);
  assert.equal(fromMinor(totals.grandTotalMinor), 661.44);
});

// ---------------------------------------------------------------------------
// TEST 5 / TEST 6: percentage and fixed discount
// ---------------------------------------------------------------------------

test("TEST 5: percentage discount is applied to the subtotal, not the tax", () => {
  const totals = computeTotals([{ qty: 1, rate: 1000, taxPct: 18 }], { discountType: "percentage", discountValue: 10 });
  assert.equal(fromMinor(totals.subtotalMinor), 1000);
  assert.equal(fromMinor(totals.discountMinor), 100); // 10% of 1000
  assert.equal(fromMinor(totals.taxMinor), 180); // tax computed on the un-discounted base per line
  assert.equal(fromMinor(totals.grandTotalMinor), 1000 - 100 + 180);
  assert.equal(totals.discountClamped, false);
});

test("TEST 6: fixed-amount discount is subtracted directly", () => {
  const totals = computeTotals([{ qty: 1, rate: 1000, taxPct: 18 }], { discountType: "fixed", discountValue: 150 });
  assert.equal(fromMinor(totals.discountMinor), 150);
  assert.equal(fromMinor(totals.grandTotalMinor), 1000 - 150 + 180);
});

test("a fixed discount larger than the subtotal is clamped so the grand total never goes negative, and is reported", () => {
  const totals = computeTotals([{ qty: 1, rate: 100, taxPct: 0 }], { discountType: "fixed", discountValue: 500 });
  assert.equal(fromMinor(totals.discountMinor), 100); // clamped to subtotal
  assert.equal(fromMinor(totals.grandTotalMinor), 0);
  assert.equal(totals.discountClamped, true);
});

test("a percentage discount above 100 is clamped to 100%", () => {
  const totals = computeTotals([{ qty: 1, rate: 100, taxPct: 0 }], { discountType: "percentage", discountValue: 250 });
  assert.equal(fromMinor(totals.discountMinor), 100);
  assert.equal(fromMinor(totals.grandTotalMinor), 0);
});

// ---------------------------------------------------------------------------
// Empty / invalid rows must not corrupt totals
// ---------------------------------------------------------------------------

test("an empty item list totals to zero, not NaN", () => {
  const totals = computeTotals([], { discountType: "percentage", discountValue: 0 });
  assert.equal(totals.subtotalMinor, 0);
  assert.equal(totals.taxMinor, 0);
  assert.equal(totals.grandTotalMinor, 0);
});

test("rows with blank/garbage numeric fields contribute zero instead of corrupting totals with NaN", () => {
  const totals = computeTotals(
    [
      { qty: "", rate: "", taxPct: "" },
      { qty: "abc", rate: "xyz", taxPct: "n/a" },
      { qty: 2, rate: 50, taxPct: 10 },
    ],
    { discountType: "percentage", discountValue: 0 }
  );
  assert.equal(fromMinor(totals.subtotalMinor), 100);
  assert.equal(fromMinor(totals.taxMinor), 10);
  assert.equal(fromMinor(totals.grandTotalMinor), 110);
  assert.ok(Number.isFinite(totals.grandTotalMinor));
});

test("negative quantity, rate or tax are clamped to zero rather than reducing totals", () => {
  const line = computeLine({ qty: -5, rate: -100, taxPct: -18 });
  assert.equal(line.qty, 0);
  assert.equal(line.rate, 0);
  assert.equal(line.taxPct, 0);
  assert.equal(line.baseMinor, 0);
  assert.equal(line.taxMinor, 0);
});

// ---------------------------------------------------------------------------
// Floating point safety: classic float-noise inputs must sum cleanly
// ---------------------------------------------------------------------------

test("no floating-point display drift across many fractional-price lines", () => {
  // Raw float addition of 0.1 + 0.2 (x10) famously does not equal 3 exactly.
  const lines = Array.from({ length: 10 }, () => ({ qty: 1, rate: 0.1, taxPct: 0 }));
  lines.push(...Array.from({ length: 10 }, () => ({ qty: 1, rate: 0.2, taxPct: 0 })));
  const totals = computeTotals(lines, { discountType: "percentage", discountValue: 0 });
  assert.equal(fromMinor(totals.subtotalMinor), 3);
  assert.equal(formatMoney(totals.subtotalMinor, "USD"), "$3.00");
});

test("three-decimal-noise rate x quantity rounds to the nearest paisa, not a repeating float", () => {
  const line = computeLine({ qty: 3, rate: 19.99, taxPct: 18 });
  // 3 * 19.99 = 59.97 exactly in decimal, but floats can render 59.970000000000006.
  assert.equal(fromMinor(line.baseMinor), 59.97);
  assert.equal(fromMinor(line.taxMinor), 10.79); // round(59.97 * 0.18 * 100)/100 = round(1079.46)/100
});

// ---------------------------------------------------------------------------
// TEST 10: multiple currencies
// ---------------------------------------------------------------------------

test("TEST 10: money formats correctly for every supported currency", () => {
  assert.equal(formatMoney(toMinor(1234.5), "INR"), "₹1,234.50");
  assert.equal(formatMoney(toMinor(1234.5), "USD"), "$1,234.50");
  assert.equal(formatMoney(toMinor(1234.5), "EUR"), "€1,234.50");
  assert.equal(formatMoney(toMinor(1234.5), "GBP"), "£1,234.50");
  assert.ok(formatMoney(toMinor(1234.5), "AED").includes("1,234.50"));
  assert.ok(formatMoney(toMinor(1234.5), "AED").includes("AED"));
});

test("unknown currency codes fall back to the default currency instead of throwing", () => {
  assert.doesNotThrow(() => formatMoney(toMinor(10), "XYZ"));
});

test("every advertised currency is actually usable by formatMoney", () => {
  for (const code of Object.keys(CURRENCIES)) {
    const text = formatMoney(toMinor(99.99), code);
    assert.ok(text.includes("99.99"), `currency ${code} formatted as "${text}"`);
  }
});

// ---------------------------------------------------------------------------
// formatPlain (quantities/rates display, always 2 decimals, no NaN)
// ---------------------------------------------------------------------------

test("formatPlain always shows two decimals and never NaN", () => {
  assert.equal(formatPlain(5), "5.00");
  assert.equal(formatPlain("abc"), "0.00");
  assert.equal(formatPlain(2.5), "2.50");
});

// ---------------------------------------------------------------------------
// TEST 9 / long description & address content is not this module's concern
// (pure text, handled verbatim by the DOM layer) - but line math must still
// be unaffected by an unrelated long description string.
// ---------------------------------------------------------------------------

test("a very long description does not affect the numeric calculation for that line", () => {
  const longDescription = "Premium Widget ".repeat(50);
  const line = computeLine({ description: longDescription, qty: 2, rate: 75, taxPct: 12 });
  assert.equal(fromMinor(line.baseMinor), 150);
  assert.equal(fromMinor(line.taxMinor), 18);
});
