export const INDIA_BUSINESS_TYPES = Object.freeze([
  "Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited",
  "Trust/Society", "Individual/Freelancer", "Other",
]);

export const UAE_BUSINESS_TYPES = Object.freeze([
  "Sole Establishment / Sole Proprietorship", "Civil Company",
  "Limited Liability Company (LLC)", "Single Person LLC", "Partnership",
  "Branch of UAE Company", "Branch of Foreign Company", "Free Zone Company",
  "Free Zone Establishment", "Other",
]);

export const UAE_EMIRATES = Object.freeze([
  "Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain",
  "Ras Al Khaimah", "Fujairah",
]);

export const gstinValid = (value) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(value || "").toUpperCase());
export const trnValid = (value) => /^\d{15}$/.test(String(value || ""));

export function freezeCountryConfig(config) {
  return Object.freeze({
    ...config,
    businessTypes: Object.freeze([...config.businessTypes]),
    jurisdictions: Object.freeze([...config.jurisdictions]),
    tax: Object.freeze({ ...config.tax }),
    registration: Object.freeze({ ...config.registration }),
    defaults: Object.freeze({ ...config.defaults }),
  });
}
