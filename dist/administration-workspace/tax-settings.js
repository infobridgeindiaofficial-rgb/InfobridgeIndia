import { resolveCountryConfig } from "../country/registry.js";

const clone = value => structuredClone(value);
const id = () => `TAX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export function taxSettingCountry(record, company) {
  const explicit = record?.countryCode || record?.country_code;
  if (explicit) return resolveCountryConfig(explicit).country;
  if (record?.taxSystem === "VAT" || record?.trn) return "AE";
  if (record?.taxSystem === "GST" || record?.gstin) return "IN";
  return resolveCountryConfig(company).country;
}

export function findTaxSetting(source, countryCode, companyId = source.currentCompanyId, includeCompanyDefaults = true) {
  const company = source.companies.find(item => item.id === companyId);
  const country = resolveCountryConfig(countryCode).country;
  const saved = source.gstSettings.find(item => item.companyId === companyId && taxSettingCountry(item, company) === country);
  if (saved || !includeCompanyDefaults) return saved || null;
  const companyCountry = resolveCountryConfig(company).country;
  return {
    countryCode: country,
    legalName: company?.legalName || "",
    tradeName: company?.tradeName || "",
    state: companyCountry === country ? company?.emirate || company?.state || "" : "",
    gstin: country === "IN" && companyCountry === country ? company?.gstin || company?.taxNumber || "" : "",
    trn: country === "AE" && companyCountry === country ? company?.trn || company?.taxNumber || "" : "",
    registered: companyCountry === country && (country === "IN" ? Boolean(company?.gstRegistered || company?.gstStatus === "Registered") : Boolean(company?.vatRegistered || company?.vatStatus === "Registered")),
  };
}

export function saveCountryTaxSetting(source, data, company) {
  const state = clone(source);
  const config = resolveCountryConfig(data.countryCode || data.country_code || company?.country);
  const identifier = String(data[config.tax.identifierField] || "").trim().toUpperCase();
  if (data.registered && !config.tax.validateIdentifier(identifier)) {
    throw new Error(config.country === "AE" ? "Enter a valid 15-digit TRN" : "Enter a valid GSTIN");
  }
  const existing = findTaxSetting(state, config.country, state.currentCompanyId, false);
  const timestamp = new Date().toISOString();
  const record = {
    ...existing,
    ...data,
    id: existing?.id || id(),
    companyId: state.currentCompanyId,
    countryCode: config.country,
    country_code: config.country,
    taxSystem: config.tax.system,
    tax_system: config.tax.system,
    registered: Boolean(data.registered),
    gstRegistered: config.country === "IN" && Boolean(data.registered),
    vatRegistered: config.country === "AE" && Boolean(data.registered),
    taxNumber: data.registered ? identifier : "",
    gstin: config.country === "IN" && data.registered ? identifier : "",
    trn: config.country === "AE" && data.registered ? identifier : "",
    updatedAt: timestamp,
  };
  if (existing) state.gstSettings[state.gstSettings.indexOf(existing)] = record;
  else state.gstSettings.push(record);
  state.audit.unshift({ id: id(), companyId: state.currentCompanyId, timestamp, actorId: "current-account", actorName: "Current account", action: `${config.tax.system} settings changed`, entity: "Tax Settings", entityId: record.id, previous: existing, new: record, reason: "", metadata: { countryCode: config.country } });
  return { state, record };
}

export function taxSettingMatches(actual, expected) {
  if (!actual || !expected) return false;
  const keys = ["countryCode", "taxSystem", "registered", "gstin", "trn", "legalName", "tradeName", "registrationType", "state", "defaultPlaceOfSupply", "defaultGstRate", "defaultVatRate", "taxInclusive", "rounding"];
  return keys.every(key => {
    if (!(key in expected)) return true;
    if (typeof expected[key] === "boolean") return Boolean(actual[key]) === expected[key];
    return String(actual[key] ?? "") === String(expected[key] ?? "");
  });
}
