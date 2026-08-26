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

export const INDIA_STATES = Object.freeze([
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
]);

export const gstinValid = (value) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(value || "").toUpperCase());
export const trnValid = (value) => /^\d{15}$/.test(String(value || ""));

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function freezeCountryConfig(config) {
  return deepFreeze({
    ...config,
    businessTypes: [...config.businessTypes],
    jurisdictions: [...config.jurisdictions],
  });
}
