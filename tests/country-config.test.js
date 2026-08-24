import test from "node:test";
import assert from "node:assert/strict";
import { resolveCountryConfig } from "../src/country/registry.js";
import { resolveAdministrationConfig, saveConfiguredCompany, saveConfiguredTax } from "../src/administration/country.js";
import { bootstrap, defaultState } from "../src/administration/core.js";

test("country resolver returns the India configuration for IN", () => {
  const config = resolveCountryConfig("IN");
  assert.equal(config.country, "IN");
  assert.equal(config.currency, "INR");
  assert.equal(config.tax.identifier, "GSTIN");
});

test("country resolver returns the UAE configuration for AE", () => {
  const config = resolveCountryConfig("AE");
  assert.equal(config.country, "AE");
  assert.equal(config.currency, "AED");
  assert.equal(config.tax.identifier, "TRN");
  assert.equal(config.tax.validateIdentifier("100123456700003"), true);
  assert.equal(config.tax.validateIdentifier("123"), false);
});

test("legacy India, missing and unknown countries safely fall back to India", () => {
  for (const value of ["India", null, undefined, "unknown"]) assert.equal(resolveCountryConfig(value).country, "IN");
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
