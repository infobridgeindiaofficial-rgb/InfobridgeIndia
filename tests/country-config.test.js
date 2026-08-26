import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCountryTax, countryCurrency, countryLocale, countryRegionLabel,
  countryTaxRegistrationLabel, countryTaxSystem, createCountryContext,
  currentCompanyCountry, formatCountryMoney, normalizeCountryCode,
  resolveCompanyCountryConfig, resolveCountryConfig,
} from "../src/country/registry.js";
import { resolveAdministrationConfig, saveConfiguredCompany, saveConfiguredTax } from "../src/administration/country.js";
import { bootstrap, defaultState } from "../src/administration/core.js";

test("country resolver returns the India configuration for IN", () => {
  const config = resolveCountryConfig("IN");
  assert.equal(config.country, "IN");
  assert.equal(config.currency, "INR");
  assert.equal(config.defaults.locale, "en-IN");
  assert.equal(config.tax.identifier, "GSTIN");
  assert.equal(config.tax.strategy, "india-gst");
  assert.deepEqual(config.tax.capabilities.components, ["CGST", "SGST", "IGST"]);
});

test("country resolver returns the UAE configuration for AE", () => {
  const config = resolveCountryConfig("AE");
  assert.equal(config.country, "AE");
  assert.equal(config.currency, "AED");
  assert.equal(config.defaults.locale, "en-AE");
  assert.equal(config.tax.identifier, "TRN");
  assert.equal(config.tax.strategy, "uae-vat");
  assert.deepEqual(config.tax.capabilities.components, ["VAT"]);
  assert.equal(config.tax.validateIdentifier("100123456700003"), true);
  assert.equal(config.tax.validateIdentifier("123"), false);
});

test("legacy India, missing and unknown countries safely fall back to India", () => {
  for (const value of ["India", "IND", "Bharat", null, undefined, "unknown"]) assert.equal(resolveCountryConfig(value).country, "IN");
  for (const value of ["UAE", "ARE", "United Arab Emirates", "United Arab Emirates (UAE)"]) assert.equal(normalizeCountryCode(value), "AE");
});

test("saved company country is the source for the reusable workspace context", () => {
  const company = { id: "CO-AE", country: "uae", currency: "INR" };
  assert.equal(currentCompanyCountry(company), "AE");
  assert.equal(resolveCompanyCountryConfig(company).currency, "AED");
  assert.equal(countryCurrency(company), "AED");
  assert.equal(countryLocale(company), "en-AE");
  assert.equal(countryTaxSystem(company), "VAT");
  assert.equal(countryTaxRegistrationLabel(company), "TRN");
  assert.equal(countryRegionLabel(company), "Emirate");
  assert.deepEqual(createCountryContext(company).taxLabels, { total: "VAT", valueAdded: "VAT" });
});

test("shared money formatter uses INR and AED locale configuration", () => {
  const inr = formatCountryMoney(123456.5, { country: "IN" });
  const aed = formatCountryMoney(123456.5, { country: "AE" });
  assert.match(inr, /₹/);
  assert.match(inr, /1,23,456\.50/);
  assert.match(aed, /AED/);
  assert.match(aed, /123,456\.50/);
  assert.match(formatCountryMoney("invalid", "AE"), /0\.00/);
});

test("India GST strategy resolves intra-state and inter-state components", () => {
  const intra = calculateCountryTax({ amount: 1000, rate: 18, originRegion: "Kerala", destinationRegion: "kerala" }, "IN");
  assert.deepEqual(intra.components, { cgst: 90, sgst: 90, igst: 0 });
  assert.deepEqual({ system: intra.system, totalTax: intra.totalTax, total: intra.total }, { system: "GST", totalTax: 180, total: 1180 });
  const inter = calculateCountryTax({ amount: 1000, rate: 18, originRegion: "Kerala", destinationRegion: "Tamil Nadu" }, "IN");
  assert.deepEqual(inter.components, { cgst: 0, sgst: 0, igst: 180 });
});

test("UAE VAT strategy resolves one VAT component without GST assumptions", () => {
  const result = createCountryContext({ country_code: "AE" }).calculateTax({ amount: 1000, rate: 5 });
  assert.deepEqual({ country: result.country, currency: result.currency, system: result.system, totalTax: result.totalTax, total: result.total, components: result.components }, { country: "AE", currency: "AED", system: "VAT", totalTax: 50, total: 1050, components: { vat: 50 } });
});

test("UAE Administration exposes UAE terminology and validates TRN", () => {
  const config = resolveAdministrationConfig({ country: "AE" });
  assert.deepEqual({ tax: config.tax.system, id: config.companyFields.taxIdentifierLabel, jurisdiction: config.companyFields.jurisdictionLabel, pan: config.companyFields.showPan, currency: config.currency }, { tax: "VAT", id: "TRN", jurisdiction: "Emirate", pan: false, currency: "AED" });
  assert.ok(config.businessTypes.includes("Limited Liability Company (LLC)"));
  assert.ok(config.jurisdictions.includes("Dubai"));
  let state = bootstrap(defaultState());
  assert.throws(() => saveConfiguredCompany(state, { legalName: "Dubai LLC", tradeName: "Dubai", businessType: "Limited Liability Company (LLC)", country: "AE", state: "Dubai", city: "Dubai", currency: "AED", timezone: "Asia/Dubai", vatStatus: "Registered", trn: "123" }), /15-digit TRN/);
  const saved = saveConfiguredCompany(state, { legalName: "Dubai LLC", tradeName: "Dubai", businessType: "Limited Liability Company (LLC)", country: "AE", state: "Dubai", city: "Dubai", currency: "AED", timezone: "Asia/Dubai", vatStatus: "Registered", trn: "100123456700003", tradeLicenseNumber: "DET-123" });
  state = saved.state;
  assert.equal(saved.record.taxSystem, "VAT");
  assert.equal(saved.record.gstin, "");
  const tax = saveConfiguredTax(state, { registered: true, trn: "100123456700003", defaultVatRate: "5" }, saved.record);
  assert.equal(tax.record.taxNumber, "100123456700003");
});

test("India Administration retains its existing labels, values and validation", () => {
  const config = resolveAdministrationConfig({ country: "India" });
  assert.equal(config.tax.settingsLabel, "GST & Tax Settings");
  assert.equal(config.companyFields.taxStatusLabel, "GST status");
  assert.equal(config.companyFields.showPan, true);
  assert.deepEqual(config.businessTypes, ["Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited", "Trust/Society", "Individual/Freelancer", "Other"]);
  const state = bootstrap(defaultState());
  assert.throws(() => saveConfiguredCompany(state, { legalName: "India Pvt Ltd", tradeName: "India", businessType: "Private Limited", country: "India", state: "Kerala", city: "Kochi", currency: "INR", timezone: "Asia/Kolkata", gstStatus: "Registered", gstin: "bad" }), /valid GSTIN/);
});
