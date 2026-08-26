import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { bootstrap, defaultState } from "../src/administration/core.js";
import { findTaxSetting, saveCountryTaxSetting, taxSettingCountry } from "../src/administration/tax-settings.js";
import { KEY, repository } from "../src/administration/repository.js";

const company = state => state.companies.find(item => item.id === state.currentCompanyId);

test("India and UAE tax settings are isolated by company and country", () => {
  let state = bootstrap(defaultState());
  const historical = { id: "INV-OLD", total: 1180, finalised: true };
  state.invoices = [historical];
  state = saveCountryTaxSetting(state, { countryCode: "IN", registered: true, gstin: "27ABCDE1234F1Z5", defaultGstRate: "18" }, company(state)).state;
  state = saveCountryTaxSetting(state, { countryCode: "AE", registered: true, trn: "100123456700003", defaultVatRate: "5" }, company(state)).state;
  assert.equal(findTaxSetting(state, "IN").gstin, "27ABCDE1234F1Z5");
  assert.equal(findTaxSetting(state, "AE").trn, "100123456700003");
  assert.equal(state.gstSettings.length, 2);
  assert.deepEqual(state.invoices, [historical]);
});

test("saving an existing country updates instead of duplicating or overwriting the other country", () => {
  let state = bootstrap(defaultState());
  state = saveCountryTaxSetting(state, { countryCode: "IN", registered: false, defaultGstRate: "18" }, company(state)).state;
  state = saveCountryTaxSetting(state, { countryCode: "AE", registered: false, defaultVatRate: "5" }, company(state)).state;
  const aeId = findTaxSetting(state, "AE").id;
  state = saveCountryTaxSetting(state, { countryCode: "IN", registered: false, defaultGstRate: "12" }, company(state)).state;
  assert.equal(state.gstSettings.length, 2);
  assert.equal(findTaxSetting(state, "IN").defaultGstRate, "12");
  assert.equal(findTaxSetting(state, "AE").id, aeId);
  assert.equal(findTaxSetting(state, "AE").defaultVatRate, "5");
});

test("registered identifiers validate and unregistered records clear stale identifiers", () => {
  const state = bootstrap(defaultState());
  assert.throws(() => saveCountryTaxSetting(state, { countryCode: "IN", registered: true, gstin: "BAD" }, company(state)), /valid GSTIN/);
  assert.throws(() => saveCountryTaxSetting(state, { countryCode: "AE", registered: true, trn: "123" }, company(state)), /15-digit TRN/);
  const saved = saveCountryTaxSetting(state, { countryCode: "AE", registered: false, trn: "100123456700003" }, company(state));
  assert.equal(saved.record.trn, "");
  assert.equal(saved.record.taxNumber, "");
});

test("legacy tax rows resolve without rewriting existing data", () => {
  const state = bootstrap(defaultState()), current = company(state);
  assert.equal(taxSettingCountry({ companyId: current.id, gstin: "27ABCDE1234F1Z5" }, current), "IN");
  assert.equal(taxSettingCountry({ companyId: current.id, trn: "100123456700003" }, current), "AE");
});

test("Tax Settings UI exposes one radio-card selector and country-specific fields", () => {
  const source = fs.readFileSync(new URL("../src/administration/app.js", import.meta.url), "utf8");
  assert.match(source, /const nav\s*=\s*\[[^\]]*"Tax Settings"/s);
  assert.match(source, /role="radiogroup"/);
  assert.match(source, /aria-checked/);
  assert.match(source, /Save \$\{uae\s*\?\s*"UAE VAT"\s*:\s*"India GST"\} Settings/);
  assert.match(source, /VAT Registered/);
  assert.match(source, /Casual Taxable Person/);
  const countries = fs.readFileSync(new URL("../src/country/shared.js", import.meta.url), "utf8");
  assert.match(countries, /Umm Al Quwain/);
  assert.match(source, /Historical finalised documents are never silently recalculated/);
  assert.match(source, /button\.textContent\s*=\s*"Saving\.\.\."/);
  assert.match(source, /button\.textContent\s*=\s*"Saved ✓"/);
  assert.match(source, /saveVerified/);
  assert.match(source, /database read-back did not match/i);
});

test("verified repository save waits for database write and reads authoritative state back", async () => {
  const initial = bootstrap(defaultState());
  let databaseText = "", verifiedWrites = 0, reads = 0;
  const storage = {
    getItem: () => null,
    setItem: () => {},
    async setItemVerified(key, value) { assert.equal(key, KEY); verifiedWrites++; databaseText = value; },
    async readItemFromDatabase(key) { assert.equal(key, KEY); reads++; return databaseText; },
  };
  const saved = await repository(storage).saveVerified(initial);
  assert.equal(saved.version, 2);
  assert.equal(verifiedWrites, 1);
  assert.equal(reads, 1);
});

test("verified repository save exposes database failures instead of reporting success", async () => {
  const initial = bootstrap(defaultState());
  const storage = {
    getItem: () => null,
    setItem: () => {},
    async setItemVerified() { throw new Error("workspace_records permission denied"); },
    async readItemFromDatabase() { throw new Error("must not read after failed save"); },
  };
  await assert.rejects(repository(storage).saveVerified(initial), /permission denied/);
});
