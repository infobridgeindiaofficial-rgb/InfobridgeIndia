import { resolveCountryConfig } from "../country/registry.js";

const enabled = value => value === true || value === "true" || value === "yes" || value === "Registered";

export function companyProfileCountryModel(countryOrCompany) {
  const config = resolveCountryConfig(countryOrCompany);
  return Object.freeze({
    code: config.country,
    name: config.countryName,
    businessTypes: config.businessTypes,
    jurisdictions: config.jurisdictions,
    regionLabel: config.jurisdictionLabel,
    regionPlaceholder: `Select ${config.jurisdictionLabel.toLowerCase()}`,
    postalCodeLabel: config.postalCodeLabel,
    currency: config.currency,
    taxSystem: config.tax.system,
    taxRegistrationLabel: `${config.tax.system} Registered? *`,
    taxNumberLabel: `${config.tax.identifier} *`,
    taxNumberHint: config.country === "AE" ? "15-digit UAE Tax Registration Number." : "15-character Goods and Services Tax Identification Number.",
    taxNumberPlaceholder: config.country === "AE" ? "100123456700003" : "27ABCDE1234F1Z5",
    taxNumberInputMode: config.country === "AE" ? "numeric" : "text",
    showTradeLicence: config.registration.tradeLicence,
    config,
  });
}

export function normalizeCompanyProfileInput(input = {}) {
  const model = companyProfileCountryModel(input.country);
  const registered = enabled(input.taxRegistered) || enabled(model.code === "AE" ? input.vatRegistered : input.gstRegistered);
  const taxNumber = String(input.taxNumber || (model.code === "AE" ? input.trn : input.gstin) || "").trim();
  const state = String(model.code === "AE" ? input.emirate || "" : input.state || "").trim();
  return {
    ...input,
    country: model.code,
    state,
    gstRegistered: model.code === "IN" && registered,
    gstin: model.code === "IN" && registered ? taxNumber.toUpperCase() : "",
    vatRegistered: model.code === "AE" && registered,
    trn: model.code === "AE" && registered ? taxNumber : "",
    tradeLicenseNumber: model.showTradeLicence ? String(input.tradeLicenseNumber || "").trim() : "",
    tradeLicenseExpiryDate: model.showTradeLicence ? String(input.tradeLicenseExpiryDate || "").trim() : "",
    taxSystem: model.taxSystem,
    taxNumber: registered ? (model.code === "AE" ? taxNumber : taxNumber.toUpperCase()) : "",
    currency: model.currency,
  };
}

export function canEditCompanyCountry(profile) {
  return !profile?.companyId && !profile?.id || profile?.profileComplete === false || profile?.placeholder === true;
}

export function assertCompanyCountryChangeAllowed(existing, requestedCountry) {
  if (!existing || canEditCompanyCountry(existing)) return true;
  const saved = companyProfileCountryModel(existing).code, requested = companyProfileCountryModel(requestedCountry).code;
  if (saved !== requested) throw new Error("Company country is locked after setup because it defines the accounting and tax jurisdiction.");
  return true;
}

export function switchCompanyCountryDraft(draft = {}, requestedCountry) {
  const model = companyProfileCountryModel(requestedCountry);
  return {
    ...draft,
    country: model.code,
    businessType: "",
    state: "",
    emirate: "",
    taxRegistered: false,
    taxNumber: "",
    gstRegistered: false,
    gstin: "",
    vatRegistered: false,
    trn: "",
    tradeLicenseNumber: model.showTradeLicence ? draft.tradeLicenseNumber || "" : "",
    tradeLicenseExpiryDate: model.showTradeLicence ? draft.tradeLicenseExpiryDate || "" : "",
    currency: model.currency,
    taxSystem: model.taxSystem,
  };
}
