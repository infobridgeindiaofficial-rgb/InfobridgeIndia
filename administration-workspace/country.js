import { resolveCountryConfig } from "../country/registry.js";
import { saveCompany, saveGst } from "./core.js";

export function resolveAdministrationConfig(company) {
  const country = resolveCountryConfig(globalThis.InfoBridgeCompany?.country ?? company?.country);
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
  const config = resolveCountryConfig(data.country);
  if (config.country === "IN") return saveCompany(source, data);
  const registered = data.vatStatus === "Registered";
  if (registered && !config.tax.validateIdentifier(data.trn)) throw new Error("Enter a valid 15-digit TRN");
  return saveCompany(source, { ...data, country: "AE", currency: "AED", gstStatus: "Unregistered", gstin: "", pan: "", vatRegistered: registered, taxSystem: "VAT", taxNumber: data.trn || "" });
}

export function saveConfiguredTax(source, data, company) {
  const config = resolveCountryConfig(company?.country);
  if (config.country === "IN") return saveGst(source, data);
  if (data.registered && !config.tax.validateIdentifier(data.trn)) throw new Error("Enter a valid 15-digit TRN");
  const result = saveGst(source, { ...data, registered: false, gstin: "" });
  Object.assign(result.record, { registered: Boolean(data.registered), vatRegistered: Boolean(data.registered), trn: data.trn || "", taxSystem: "VAT", taxNumber: data.trn || "", defaultVatRate: data.defaultVatRate });
  return result;
}
