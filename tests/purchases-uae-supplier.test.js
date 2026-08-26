import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialState, saveSupplier, createOrder, createBill } from "../src/purchases/core.js";
import { resolveCountryConfig } from "../src/country/registry.js";

const SHAYAY = { name: "Shayay Hospitality", country: "AE", state: "Dubai", companyId: "CO-SHAYAY" };
const INDIA_CO = { name: "Acme Traders Pvt Ltd", country: "IN", state: "Tamil Nadu", companyId: "CO-ACME" };

function withCompany(company, fn) {
  const previous = globalThis.InfoBridgeCompany;
  globalThis.InfoBridgeCompany = company;
  try { return fn(); } finally { globalThis.InfoBridgeCompany = previous; }
}

const app = readFileSync(new URL("../src/purchases/app.js", import.meta.url), "utf8");
const supplierModalSource = app.slice(app.indexOf("function supplierModal"), app.indexOf("function lineHtml"));

// ---- A. India company ----

test("A1-A4: India branch of the Add Supplier form keeps GSTIN, PAN, State, State code and India default", () => {
  assert.match(supplierModalSource, /field\("gstin","GSTIN"/);
  assert.match(supplierModalSource, /field\("pan","PAN"/);
  assert.match(supplierModalSource, /field\("country","Country","text",x\.country\|\|"India"\)/);
  assert.match(supplierModalSource, /field\("state","State","text",x\.state\)/);
  assert.match(supplierModalSource, /field\("stateCode","State code","text",x\.stateCode\|\|state\.settings\.businessStateCode,true\)/);
  assert.match(supplierModalSource, /field\("pinCode","PIN code","text",x\.pinCode\)/);
});

test("A5: existing India supplier save still works exactly as before", () => withCompany(INDIA_CO, () => {
  const state = initialState();
  const r = saveSupplier(state, { type: "Business", name: "Chennai Steel Traders", mobile: "9876543210", gstin: "33AAAAA0000A1Z5", pan: "AAAAA0000A", state: "Tamil Nadu", stateCode: "33", pinCode: "600001", country: "India" });
  assert.equal(r.record.gstin, "33AAAAA0000A1Z5");
  assert.equal(r.record.trn, undefined);
  assert.equal(r.record.pan, "AAAAA0000A");
  assert.equal(r.record.stateCode, "33");
  assert.equal(r.record.country, "India");
  assert.equal(r.record.vatRegistered, undefined, "India records must not carry a vatRegistered flag");
  assert.throws(() => saveSupplier(state, { type: "Business", name: "Bad GSTIN Co", mobile: "9876500000", gstin: "INVALID", stateCode: "33" }), /valid GSTIN/);
}));

// ---- B. UAE company ----

test("B1: Add Supplier resolves United Arab Emirates from the active company profile (Shayay Hospitality)", () => {
  const config = resolveCountryConfig(SHAYAY);
  assert.equal(config.country, "AE");
  assert.match(config.countryName, /United Arab Emirates/);
});

test("B2-B4: UAE branch of the form never renders GSTIN, PAN or the India State/State code fields", () => {
  const aeBranch = supplierModalSource.slice(supplierModalSource.indexOf("countryFields=ae?"), supplierModalSource.indexOf(":`${field(\"gstin\""));
  assert.doesNotMatch(aeBranch, /GSTIN/);
  assert.doesNotMatch(aeBranch, /"pan"/);
  assert.doesNotMatch(aeBranch, />State</);
  assert.doesNotMatch(aeBranch, /State code/);
});

test("B5: Emirate dropdown is available and uses the country registry's jurisdiction list (the 7 UAE emirates)", () => {
  assert.match(supplierModalSource, /select\("stateCode",config\.jurisdictionLabel,config\.jurisdictions,region,true\)/);
  const config = resolveCountryConfig(SHAYAY);
  assert.deepEqual(config.jurisdictions, ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"]);
});

test("B6: VAT Registered toggle is present in the UAE branch", () => {
  assert.match(supplierModalSource, /name="vatRegistered" data-vat-toggle/);
  assert.match(supplierModalSource, /VAT Registered/);
});

test("B7: VAT Registered = Yes requires a valid TRN", () => withCompany(SHAYAY, () => {
  const state = initialState();
  assert.throws(() => saveSupplier(state, { type: "Business", name: "No TRN Co", mobile: "0501112222", stateCode: "Dubai", vatRegistered: true }), /valid TRN/);
  assert.throws(() => saveSupplier(state, { type: "Business", name: "Bad TRN Co", mobile: "0501112223", stateCode: "Dubai", vatRegistered: true, gstin: "12345" }), /valid TRN/);
  const r = saveSupplier(state, { type: "Business", name: "Valid TRN Co", mobile: "0501112224", stateCode: "Dubai", vatRegistered: true, gstin: "100000000000003" });
  assert.equal(r.record.trn, "100000000000003");
  assert.equal(r.record.vatRegistered, true);
}));

test("B8: VAT Registered = No does not require a TRN and clears any stale value", () => withCompany(SHAYAY, () => {
  const state = initialState();
  const r = saveSupplier(state, { type: "Business", name: "Unregistered Co", mobile: "0501112225", stateCode: "Dubai", vatRegistered: false, gstin: "100000000000003" });
  assert.equal(r.record.trn, "", "a TRN typed while unregistered must not be silently retained");
  assert.equal(r.record.vatRegistered, false);
}));

test("B9: the exact Shayay Hospitality UAE supplier scenario saves and reloads correctly", () => withCompany(SHAYAY, () => {
  let state = initialState();
  let r = saveSupplier(state, { type: "Business", name: "Gulf Fresh Produce LLC", mobile: "+971501112222", stateCode: "Dubai", vatRegistered: true, gstin: "100000000000003", city: "Dubai", pinCode: "PO Box 12345", country: resolveCountryConfig(SHAYAY).countryName });
  state = r.state;
  const reloaded = JSON.parse(JSON.stringify(state)).suppliers.find(x => x.id === r.record.id);
  assert.equal(reloaded.name, "Gulf Fresh Produce LLC");
  assert.equal(reloaded.trn, "100000000000003");
  assert.equal(reloaded.gstin, undefined);
  assert.equal(reloaded.pan, undefined);
  assert.equal(reloaded.stateCode, "Dubai");
  assert.equal(reloaded.vatRegistered, true);
  assert.match(reloaded.country, /United Arab Emirates/);
}));

// ---- C. Isolation ----

test("C1: switching the active company between calls does not leak the previous company's country defaults", () => {
  const uaeConfig = withCompany(SHAYAY, () => resolveCountryConfig(globalThis.InfoBridgeCompany));
  const indiaConfig = withCompany(INDIA_CO, () => resolveCountryConfig(globalThis.InfoBridgeCompany));
  assert.equal(uaeConfig.country, "AE");
  assert.equal(indiaConfig.country, "IN");
  const uaeAgain = withCompany(SHAYAY, () => resolveCountryConfig(globalThis.InfoBridgeCompany));
  assert.equal(uaeAgain.country, "AE", "resolving the UAE company again after resolving India must not be contaminated");
});

test("C2/C3: India and UAE supplier records saved in the same state remain independently readable after switching companies", () => {
  let state = initialState();
  let r = withCompany(INDIA_CO, () => saveSupplier(state, { type: "Business", name: "India Supplier Co", mobile: "9876543211", gstin: "33AAAAA0000A1Z5", stateCode: "33" }));
  state = r.state; const indiaSupplier = r.record;
  r = withCompany(SHAYAY, () => saveSupplier(state, { type: "Business", name: "UAE Supplier Co", mobile: "0501112226", stateCode: "Dubai", vatRegistered: true, gstin: "100000000000003" }));
  state = r.state; const uaeSupplier = r.record;
  const reloadedIndia = state.suppliers.find(x => x.id === indiaSupplier.id);
  const reloadedUae = state.suppliers.find(x => x.id === uaeSupplier.id);
  assert.equal(reloadedIndia.gstin, "33AAAAA0000A1Z5");
  assert.equal(reloadedIndia.trn, undefined);
  assert.equal(reloadedUae.trn, "100000000000003");
  assert.equal(reloadedUae.gstin, undefined);
  assert.equal(state.suppliers.length, 2, "no duplicate or merged records");
});

// ---- D. Procurement compatibility ----

test("D1: supplier selection in Purchase Order / Bill forms is not filtered by country, so a UAE supplier appears alongside India suppliers", () => {
  assert.match(app, /select\("supplierId","Supplier",state\.suppliers\.filter\(x=>!x\.archived\),base\.supplierId,true\)/);
  assert.match(app, /select\("supplierId","Supplier",state\.suppliers,base\.supplierId,true\)/);
});

test("D2/D3: a UAE supplier's Purchase Order and Purchase Bill use VAT (not CGST/SGST/IGST) and keep a stable supplier reference, with no duplicate supplier created", () => withCompany(SHAYAY, () => {
  let state = initialState();
  let r = saveSupplier(state, { type: "Business", name: "Gulf Fresh Produce LLC", mobile: "+971501112222", stateCode: "Dubai", vatRegistered: true, gstin: "100000000000003" });
  state = r.state; const supplier = r.record;
  r = createOrder(state, { date: "2026-08-01", supplierId: supplier.id, warehouseId: "WH-1", expectedDeliveryDate: "2026-08-10", items: [{ description: "Vegetables", quantity: 10, unit: "Kg", rate: 50, discount: 0, gstRate: 5 }] });
  state = r.state; const order = r.record;
  assert.equal(order.supplierId, supplier.id);
  assert.equal(order.vat, 25); assert.equal(order.cgst, 0); assert.equal(order.sgst, 0); assert.equal(order.igst, 0); assert.equal(order.tax, 25);
  r = createBill(state, { supplierId: supplier.id, supplierInvoiceNumber: "INV-1", invoiceDate: "2026-08-05", postingDate: "2026-08-05", dueDate: "2026-08-20", orderId: order.id, items: order.items });
  state = r.state; const bill = r.record;
  assert.equal(bill.supplierId, supplier.id);
  assert.equal(bill.vat, 25); assert.equal(bill.cgst, 0); assert.equal(bill.sgst, 0); assert.equal(bill.igst, 0); assert.equal(bill.tax, 25);
  assert.equal(state.suppliers.length, 1, "no duplicate supplier record was created by the order/bill flow");
  // re-saving the same supplier id must update, not duplicate
  r = saveSupplier(state, { ...supplier, city: "Dubai Marina" });
  assert.equal(r.state.suppliers.length, 1);
  assert.equal(r.record.id, supplier.id);
}));

test("Purchase list views display the true tax total (VAT-inclusive) instead of only CGST+SGST+IGST", () => {
  assert.doesNotMatch(app, /money\(x\.cgst\+x\.sgst\+x\.igst\)/);
});

test("Purchase return debit notes carry the tax/vat total so it can be displayed for both India and UAE", () => {
  const core = readFileSync(new URL("../src/purchases/core.js", import.meta.url), "utf8");
  assert.match(core, /const dn=\{[^}]*vat:totals\.vat,tax:totals\.tax/);
});
