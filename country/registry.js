import indiaCountryConfig from "./in.js";
import uaeCountryConfig from "./ae.js";

export const DEFAULT_COUNTRY_CODE = "IN";
export const countryRegistry = Object.freeze({ IN: indiaCountryConfig, AE: uaeCountryConfig });

export function supportedCountryOptions() {
  return Object.freeze(Object.values(countryRegistry).map(config => Object.freeze({ code: config.country, name: config.countryName })));
}

const aliases = Object.freeze({
  IN: "IN", IND: "IN", INDIA: "IN", BHARAT: "IN",
  AE: "AE", ARE: "AE", UAE: "AE", "UNITED ARAB EMIRATES": "AE", "UNITED ARAB EMIRATES (UAE)": "AE",
});

export function normalizeCountryCode(value, fallback = DEFAULT_COUNTRY_CODE) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
  const fallbackCode = aliases[String(fallback || "").trim().toUpperCase()] || DEFAULT_COUNTRY_CODE;
  return aliases[normalized] || fallbackCode;
}

export function currentCompanyCountry(company = globalThis.InfoBridgeCompany) {
  return normalizeCountryCode(company?.country ?? company?.countryCode ?? company?.country_code);
}

export function resolveCountryConfig(countryOrCompany) {
  const code = countryOrCompany && typeof countryOrCompany === "object"
    ? currentCompanyCountry(countryOrCompany)
    : normalizeCountryCode(countryOrCompany);
  return countryRegistry[code] || countryRegistry[DEFAULT_COUNTRY_CODE];
}

export const resolveCompanyCountryConfig = company => resolveCountryConfig(company);
export const countryCurrency = companyOrCountry => resolveCountryConfig(companyOrCountry).currency;
export const countryLocale = companyOrCountry => resolveCountryConfig(companyOrCountry).defaults.locale;
export const countryTaxSystem = companyOrCountry => resolveCountryConfig(companyOrCountry).tax.system;
export const countryTaxLabels = companyOrCountry => resolveCountryConfig(companyOrCountry).tax.labels;
export const countryTaxRegistrationLabel = companyOrCountry => resolveCountryConfig(companyOrCountry).tax.identifier;
export const countryRegionLabel = companyOrCountry => resolveCountryConfig(companyOrCountry).jurisdictionLabel;

export function formatCountryMoney(value, companyOrCountry, options = {}) {
  const config = resolveCountryConfig(companyOrCountry);
  const amount = Number(value);
  return new Intl.NumberFormat(config.defaults.locale, {
    style: "currency",
    currency: config.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(Number.isFinite(amount) ? amount : 0);
}

const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const finiteNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;

const taxStrategies = Object.freeze({
  "india-gst": ({ amount, rate, originRegion, destinationRegion }, config) => {
    const taxableAmount = finiteNumber(amount), taxRate = finiteNumber(rate), totalTax = roundMoney(taxableAmount * taxRate / 100);
    const sameRegion = Boolean(originRegion && destinationRegion && String(originRegion).trim().toUpperCase() === String(destinationRegion).trim().toUpperCase());
    const centralTax = sameRegion ? roundMoney(totalTax / 2) : 0;
    const components = sameRegion
      ? { cgst: centralTax, sgst: roundMoney(totalTax - centralTax), igst: 0 }
      : { cgst: 0, sgst: 0, igst: totalTax };
    return { system: config.tax.system, taxableAmount, rate: taxRate, totalTax, total: roundMoney(taxableAmount + totalTax), components };
  },
  "uae-vat": ({ amount, rate }, config) => {
    const taxableAmount = finiteNumber(amount), taxRate = finiteNumber(rate), totalTax = roundMoney(taxableAmount * taxRate / 100);
    return { system: config.tax.system, taxableAmount, rate: taxRate, totalTax, total: roundMoney(taxableAmount + totalTax), components: { vat: totalTax } };
  },
});

export function calculateCountryTax(input = {}, companyOrCountry) {
  const config = resolveCountryConfig(companyOrCountry);
  const strategy = taxStrategies[config.tax.strategy];
  if (!strategy) throw new Error(`Tax strategy is not configured for ${config.country}`);
  return Object.freeze({ country: config.country, currency: config.currency, ...strategy(input, config) });
}

export function createCountryContext(company = globalThis.InfoBridgeCompany) {
  const config = resolveCompanyCountryConfig(company);
  return Object.freeze({
    country: config.country,
    currency: config.currency,
    locale: config.defaults.locale,
    taxSystem: config.tax.system,
    taxLabels: config.tax.labels,
    taxRegistrationLabel: config.tax.identifier,
    regionLabel: config.jurisdictionLabel,
    config,
    formatMoney: (value, options) => formatCountryMoney(value, config.country, options),
    calculateTax: input => calculateCountryTax(input, config.country),
  });
}

export default resolveCountryConfig;
