import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeCurrentCompany } from "../src/company/context.js";
import { createCountryContext } from "../src/country/registry.js";
import { reconcileAdministrationCompany } from "../src/administration/company.js";
import { documentTotals as salesTotals, initialState as initialSalesState, money as salesMoney, saveCustomer } from "../src/sales/core.js";
import { documentTotals as purchaseTotals, initialState as initialPurchaseState, money as purchaseMoney, saveSupplier } from "../src/purchases/core.js";
import { createCountryDefaultChart, financeChartDefinition } from "../src/finance/country-chart.js";
import { supplierTemplateCsv, validateSupplierImportRows } from "../src/purchases/supplier-import.js";
import { projectCurrencyNumberFormat } from "../src/scripts/projects-xlsx.js";
import { vatAnalyticsReport } from "../src/analytics/statutory.js";

const company = country => ({ companyId: `company-${country}`, ownerId: "owner-1", name: `${country} Company`, legalName: `${country} Company LLC`, country, state: country === "AE" ? "Dubai" : "Tamil Nadu", profileComplete: true });
const line = { description: "Service", quantity: 2, rate: 100, discount: 0, gstRate: 5 };

test("current company normalization preserves one authoritative profile identity", () => {
  for (const country of ["IN", "AE"]) {
    const resolved = normalizeCurrentCompany(company(country));
    assert.equal(resolved.id, `company-${country}`);
    assert.equal(resolved.companyId, `company-${country}`);
    assert.equal(resolved.owner_id, "owner-1");
    assert.equal(resolved.country, country);
  }
});

test("India and UAE share the same country-context contract without leakage", () => {
  const india = createCountryContext(company("IN")), uae = createCountryContext(company("AE"));
  assert.deepEqual([india.currency, india.taxSystem, india.taxRegistrationLabel, india.regionLabel], ["INR", "GST", "GSTIN", "State"]);
  assert.deepEqual([uae.currency, uae.taxSystem, uae.taxRegistrationLabel, uae.regionLabel], ["AED", "VAT", "TRN", "Emirate"]);
  assert.match(india.formatMoney(12), /₹|INR/);
  assert.match(uae.formatMoney(12), /AED/);
});

test("Administration always reconciles a stale non-placeholder company to the authenticated company", () => {
  for (const country of ["IN", "AE"]) {
    const state = { currentCompanyId: "LOCAL", companies: [{ id: "LOCAL", tradeName: "Old", placeholder: false }], branches: [{ id: "BR", companyId: "LOCAL" }], departments: [], companyMembers: [], roles: [], moduleAccess: [], financialYears: [], documentSequences: [], gstSettings: [], sharedMasters: [], notificationSettings: [], audit: [], settings: {} };
    const config = createCountryContext(company(country)).config;
    reconcileAdministrationCompany(state, company(country), config);
    assert.equal(state.currentCompanyId, `company-${country}`);
    assert.equal(state.companies[0].country, country);
    assert.equal(state.companies[0].currency, config.currency);
    assert.equal(state.branches[0].companyId, `company-${country}`);
  }
});

test("Sales and Purchases use GST components for India and VAT for UAE", () => {
  for (const totals of [salesTotals, purchaseTotals]) {
    const india = totals([line], { country: "IN", sellerStateCode: "TN", businessStateCode: "TN" }, "TN");
    assert.equal(india.taxSystem, "GST"); assert.equal(india.cgst, 5); assert.equal(india.sgst, 5); assert.equal(india.igst, 0); assert.equal(india.vat, 0);
    const uae = totals([line], { country: "AE", sellerStateCode: "Dubai", businessStateCode: "Dubai" }, "Dubai");
    assert.equal(uae.taxSystem, "VAT"); assert.equal(uae.vat, 10); assert.equal(uae.cgst, 0); assert.equal(uae.sgst, 0); assert.equal(uae.igst, 0);
  }
});

test("shared module money formatters follow the saved company", () => {
  assert.match(salesMoney(25, company("IN")), /₹|INR/);
  assert.match(purchaseMoney(25, company("IN")), /₹|INR/);
  assert.match(salesMoney(25, company("AE")), /AED/);
  assert.match(purchaseMoney(25, company("AE")), /AED/);
});

test("Sales customers and Purchase suppliers use the active jurisdiction registration identifier", () => {
  const customer = saveCustomer(initialSalesState(), { countryCode: "AE", type: "Business", name: "UAE Customer", mobile: "0500000000", stateCode: "Dubai", gstin: "100000000000003" }).record;
  const supplier = saveSupplier(initialPurchaseState(), { countryCode: "AE", type: "Business", name: "UAE Supplier", mobile: "0500000001", stateCode: "Dubai", gstin: "100000000000003" }).record;
  assert.equal(customer.trn, "100000000000003"); assert.equal(customer.gstin, undefined);
  assert.equal(supplier.trn, "100000000000003"); assert.equal(supplier.gstin, undefined);
  assert.throws(() => saveCustomer(initialSalesState(), { countryCode: "AE", type: "Business", name: "Bad TRN", mobile: "0500000002", stateCode: "Dubai", gstin: "INVALID" }), /valid TRN/);
});

test("generic authenticated UI modules consume the shared formatter and country context", () => {
  const files = ["sales/app.js", "purchases/app.js", "inventory/app.js", "finance/app.js", "banking/app.js", "analytics/app.js", "approvals/app.js", "scripts/projects.js"];
  for (const relative of files) {
    const source = readFileSync(new URL(`../src/${relative}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /new Intl\.NumberFormat\(["']en-IN["'][^\n]*(?:INR|₹)/, `${relative} must not define an India-only formatter`);
  }
  const workspace = readFileSync(new URL("../src/supabase/workspace.js", import.meta.url), "utf8");
  assert.match(workspace, /resolveCurrentCompanyContext\(\)/);
  assert.doesNotMatch(workspace, /activeProfile\?\.companyId/);
});

test("Finance creates jurisdiction-specific new charts without rewriting source state",()=>{const source={...initialPurchaseState(),settings:{defaultAccounts:{}},accounts:[],audit:[]},india=createCountryDefaultChart(source,"IN-CO","",company("IN"),p=>`${p}-IN`),uae=createCountryDefaultChart(source,"AE-CO","",company("AE"),p=>`${p}-AE`);assert.equal(source.accounts.length,0);assert.equal(india.settings.baseCurrency,"INR");assert.ok(india.accounts.some(x=>x.name==="Input CGST"));assert.equal(uae.settings.baseCurrency,"AED");assert.ok(uae.accounts.some(x=>x.name==="Input VAT"));assert.ok(uae.accounts.some(x=>x.name==="Output VAT"));assert.equal(uae.accounts.some(x=>/CGST|SGST|IGST|GST/.test(x.name)),false);assert.equal(financeChartDefinition(company("AE")).country,"AE")});

test("supplier import schema and validation follow India and UAE",()=>{assert.equal(supplierTemplateCsv(company("IN")),"Type,Name,Mobile,Email,GSTIN,State Code\r\n");assert.equal(supplierTemplateCsv(company("AE")),"Type,Name,Mobile,Email,TRN,Emirate\r\n");const india=validateSupplierImportRows([{Name:"IN Supplier",Mobile:"1",GSTIN:"33AAAAA0000A1Z5","State Code":"33"}],[],company("IN"))[0],uae=validateSupplierImportRows([{Name:"AE Supplier",Mobile:"2",TRN:"100000000000003",Emirate:"Dubai"}],[],company("AE"))[0];assert.deepEqual(india.errors,[]);assert.equal(india.data.gstin,"33AAAAA0000A1Z5");assert.deepEqual(uae.errors,[]);assert.equal(uae.data.trn,"100000000000003");assert.equal("gstin" in uae.data,false)});

test("Projects XLSX currency number formats are jurisdiction-aware",()=>{assert.match(projectCurrencyNumberFormat(company("IN")),/₹/);assert.doesNotMatch(projectCurrencyNumberFormat(company("IN")),/AED/);assert.match(projectCurrencyNumberFormat(company("AE")),/AED/);assert.doesNotMatch(projectCurrencyNumberFormat(company("AE")),/₹/)});

test("UAE statutory analytics derives VAT from sales and purchases without GST components",()=>{const result=vatAnalyticsReport({sales:{invoices:[{id:"I",status:"Approved",invoiceDate:"2026-08-01",customerId:"C",taxable:100,vat:5,grandTotal:105}],customers:[{id:"C",trn:"100000000000003"}]},purchases:{bills:[{id:"B",status:"Posted",invoiceDate:"2026-08-02",supplierId:"S",taxable:40,vat:2,grandTotal:42}],suppliers:[{id:"S",trn:"100000000000003"}]}},company("AE"));assert.equal(result.taxSystem,"VAT");assert.equal(result.outputVat,5);assert.equal(result.inputVat,2);assert.equal(result.rows.some(x=>"cgst" in x||"sgst" in x||"igst" in x),false);assert.match(result.disclaimer,/no government filing/i)});
