import { formatCountryMoney } from "../country/registry.js";

export const MAX_FRACTION_DIGITS = 20;

function fractionDigits(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(MAX_FRACTION_DIGITS, Math.max(0, Math.trunc(number)));
}

export function normalizeFractionDigits(options = {}, defaultPrecision = 2) {
  const fallback = fractionDigits(defaultPrecision, 2);
  const precision = fractionDigits(options.precision, fallback);
  const minimumFractionDigits = fractionDigits(options.minimumFractionDigits, precision);
  const requestedMaximum = fractionDigits(options.maximumFractionDigits, precision);
  const maximumFractionDigits = Math.max(minimumFractionDigits, requestedMaximum);
  return { minimumFractionDigits, maximumFractionDigits };
}

export function formatReportMoney(value, company, options = {}) {
  const digits = normalizeFractionDigits(options, 2);
  const { precision: _precision, minimumFractionDigits: _minimum, maximumFractionDigits: _maximum, ...intlOptions } = options;
  return formatCountryMoney(value, company, { ...intlOptions, ...digits });
}

export function formatReportPercentage(value, options = {}) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Not comparable";
  const digits = normalizeFractionDigits(options, 2);
  const number = Number(value);
  const sign = number > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("en-IN", digits).format(number)}%`;
}
