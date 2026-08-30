import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_FRACTION_DIGITS,
  formatReportMoney,
  formatReportPercentage,
  normalizeFractionDigits,
} from "../src/analytics/formatters.js";

test("Reports currency formatter prevents the invalid maximumFractionDigits crash", () => {
  assert.doesNotThrow(() => formatReportMoney(1234.5, { country: "AE" }, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 0,
  }));
  assert.equal(formatReportMoney(1234.5, { country: "AE" }, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 0,
  }), "AED\u00a01,234.50");
});

test("Reports precision defaults and clamps to browser-safe fraction digits", () => {
  assert.deepEqual(normalizeFractionDigits(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  assert.deepEqual(normalizeFractionDigits({ precision: null }), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  assert.deepEqual(normalizeFractionDigits({ precision: -4 }), { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  assert.deepEqual(normalizeFractionDigits({ precision: 100 }), {
    minimumFractionDigits: MAX_FRACTION_DIGITS,
    maximumFractionDigits: MAX_FRACTION_DIGITS,
  });
  assert.deepEqual(normalizeFractionDigits({ minimumFractionDigits: 8, maximumFractionDigits: 3 }), {
    minimumFractionDigits: 8,
    maximumFractionDigits: 8,
  });
});

test("Reports percentage formatter handles missing and invalid precision safely", () => {
  assert.equal(formatReportPercentage(undefined), "Not comparable");
  assert.equal(formatReportPercentage(12.5, { precision: -1 }), "+13%");
  assert.doesNotThrow(() => formatReportPercentage(12.5, { maximumFractionDigits: 999 }));
});
