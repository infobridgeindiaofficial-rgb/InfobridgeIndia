// Quotation Generator - pure calculation + formatting logic.
// Deliberately framework/DOM-free so it can be unit tested directly and
// reused unchanged by app.js. All money math is done in integer "minor
// units" (paise/cents) - i.e. rounded to the nearest 0.01 once per line and
// then only ever added/subtracted as integers - so summed totals can never
// drift from what's displayed the way raw floating-point addition can
// (e.g. 0.1 + 0.2 !== 0.3).

export const CURRENCIES = {
  INR: { code: "INR", label: "INR ₹ - Indian Rupee", locale: "en-IN" },
  USD: { code: "USD", label: "USD $ - US Dollar", locale: "en-US" },
  EUR: { code: "EUR", label: "EUR € - Euro", locale: "en-US" },
  GBP: { code: "GBP", label: "GBP £ - British Pound", locale: "en-US" },
  AED: { code: "AED", label: "AED - UAE Dirham", locale: "en-US" },
};
export const DEFAULT_CURRENCY = "INR";

/** Parses any raw input (string, empty, undefined, "abc") into a finite number, never NaN. */
export function safeNumber(raw) {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** A safe number that additionally can never be negative. */
export function safeNonNegative(raw) {
  return Math.max(0, safeNumber(raw));
}

/** Rounds a decimal currency amount to the nearest integer minor unit (paise/cents). */
export function toMinor(value) {
  const n = safeNumber(value);
  return Math.round(n * 100);
}

export function fromMinor(minor) {
  return (Number(minor) || 0) / 100;
}

/**
 * One line item's amounts, per the spec:
 *   Base Amount = Quantity x Rate
 *   Tax Amount  = Base Amount x Tax%
 *   Line Total  = Base Amount + Tax Amount
 * qty/rate/taxPct are defensively clamped to non-negative here too, so a
 * line can never corrupt the running totals even if it bypasses UI validation.
 */
export function computeLine({ qty, rate, taxPct }) {
  const q = safeNonNegative(qty);
  const r = safeNonNegative(rate);
  const t = safeNonNegative(taxPct);

  const baseMinor = Math.round(q * r * 100);
  const taxMinor = Math.round((baseMinor * t) / 100);
  const totalMinor = baseMinor + taxMinor;

  return { qty: q, rate: r, taxPct: t, baseMinor, taxMinor, totalMinor };
}

/**
 * Aggregates every line plus an optional discount into a quotation summary.
 * Discount is applied to the subtotal (base amounts), not to tax - each
 * line's tax is computed independently per the spec. Grand Total =
 * Subtotal - Discount + Tax. Discount is clamped so the grand total can
 * never go negative; `discountClamped` reports whether that happened so
 * the UI can surface a validation message.
 */
export function computeTotals(lines, { discountType = "percentage", discountValue = 0 } = {}) {
  const computed = (lines || []).map(computeLine);

  const subtotalMinor = computed.reduce((sum, l) => sum + l.baseMinor, 0);
  const taxMinor = computed.reduce((sum, l) => sum + l.taxMinor, 0);

  let rawDiscountMinor;
  if (discountType === "fixed") {
    rawDiscountMinor = toMinor(discountValue);
  } else {
    const pct = Math.min(100, safeNonNegative(discountValue));
    rawDiscountMinor = Math.round((subtotalMinor * pct) / 100);
  }
  rawDiscountMinor = Math.max(0, rawDiscountMinor);

  const discountMinor = Math.min(rawDiscountMinor, subtotalMinor);
  const discountClamped = rawDiscountMinor > subtotalMinor;

  const grandTotalMinor = Math.max(0, subtotalMinor - discountMinor + taxMinor);

  return { lines: computed, subtotalMinor, taxMinor, discountMinor, discountClamped, grandTotalMinor };
}

/** Formats an amount (in minor units, unless fromMinorUnits:false) as currency text. */
export function formatMoney(amount, currencyCode = DEFAULT_CURRENCY, { fromMinorUnits = true } = {}) {
  const currency = CURRENCIES[currencyCode] || CURRENCIES[DEFAULT_CURRENCY];
  const value = fromMinorUnits ? fromMinor(amount) : safeNumber(amount);
  return new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Plain (non-currency-symbol) 2-decimal formatting, e.g. for quantities/rates in the item table. */
export function formatPlain(value) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeNumber(value));
}
