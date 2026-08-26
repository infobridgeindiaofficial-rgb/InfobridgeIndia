import { resolveCountryConfig } from "../country/registry.js";
import { assertCompanyCountryChangeAllowed, normalizeCompanyProfileInput } from "../company/profile.js";
import { saveCompany } from "./core.js";
import { saveCountryTaxSetting } from "./tax-settings.js";
import { normalizeAdministrationCompanyInput } from "./company-form.js";
import { reconcileCompanyHeadOffice } from "./branch-form.js";

export function resolveAdministrationConfig(company) {
  const country = resolveCountryConfig(company?.country ?? globalThis.InfoBridgeCompany?.country);
  return Object.freeze({ ...country, companyFields: Object.freeze({
    taxStatusLabel: country.tax.statusLabel,
    taxIdentifierLabel: country.tax.identifier,
    jurisdictionLabel: country.jurisdictionLabel,
    showPan: country.registration.showPan,
    registrationNumberLabel: country.registration.numberLabel,
    showTradeLicenceExpiry: country.registration.tradeLicence,
  }) });
}

export function saveConfiguredCompany(source, data) {
  const existing = source.companies.find(company => company.id === data.id);
  assertCompanyCountryChangeAllowed(existing, data.country);
  if(data.taxType){const result=saveCompany(source,normalizeAdministrationCompanyInput(data));if(!existing){const head=result.state.branches.find(x=>x.companyId===result.record.id&&x.code==="HO");if(head)head.placeholder=true;}reconcileCompanyHeadOffice(result.state,result.record);return result;}
  const registered = data.vatStatus === "Registered" || data.gstStatus === "Registered";
  const requestedConfig = resolveCountryConfig(data.country);
  const normalized = normalizeCompanyProfileInput({ ...data, emirate: requestedConfig.country === "AE" ? data.emirate || data.state : data.emirate, taxRegistered: registered, taxNumber: requestedConfig.country === "AE" ? data.trn : data.gstin });
  const config = resolveCountryConfig(normalized.country);
  if (normalized.gstRegistered && !config.tax.validateIdentifier(normalized.gstin)) throw new Error("Enter a valid GSTIN");
  if (normalized.vatRegistered && !config.tax.validateIdentifier(normalized.trn)) throw new Error("Enter a valid 15-digit TRN");
  return saveCompany(source, { ...data, ...normalized, country: config.country, currency: config.currency, gstStatus: normalized.gstRegistered ? "Registered" : "Unregistered", vatStatus: normalized.vatRegistered ? "Registered" : "Unregistered", pan: config.registration.showPan ? data.pan : "" });
}

export function saveConfiguredTax(source, data, company) {
  return saveCountryTaxSetting(source, data, company);
}
