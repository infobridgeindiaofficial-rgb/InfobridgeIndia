import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { XLSX } from "../src/gst/xlsx-shim.js";
import { analyticsReportCsv, analyticsReportModel, buildAnalyticsWorkbook, renderAnalyticsPrintDocument } from "../src/analytics/export.js";

const company = { companyId: "CO-1", name: "Example Trading LLC", country: "AE", currency: "AED", trn: "100000000000001", address: "Dubai", city: "Abu Dhabi", logo: "data:image/png;base64,AAAA" };
const filters = { start: "2026-08-01", end: "2026-08-31", includeExcluded: false };
const sources = {
  sales: { available: true, invoices: [{ id: "INV-1", invoiceDate: "2026-08-05", customerId: "C-1", status: "Confirmed", grandTotal: 1050, balanceDue: 250, amountPaid: 800 }], creditNotes: [], leads: [{ id: "L-1", date: "2026-08-02", status: "Won" }] },
  purchases: { available: true, bills: [{ id: "B-1", billDate: "2026-08-06", supplierId: "S-1", status: "Posted", grandTotal: 420, balanceDue: 120 }], debitNotes: [], orders: [] },
  inventory: { available: true, products: [{ id: "P-1", currentStock: 5, costPrice: 20, warehouseId: "W-1" }], movements: [{ id: "M-1", date: "2026-08-07", warehouseId: "W-1", quantity: 2, type: "Sale", productId: "P-1" }] },
  banking: { available: true, transactions: [{ id: "T-1", date: "2026-08-08", accountId: "A-1", direction: "In", amount: 800, signedAmount: 800, reconciliationStatus: "Reconciled" }] },
  statutory: { available: true, taxSystem: "VAT", outputVat: 50, inputVat: 20, disclaimer: "Internal VAT preparation only.", rows: [{ date: "2026-08-05", direction: "Output", taxableValue: 1000, vat: 50 }] },
  gst: { rows: [] }, approvals: { requests: [] }, finance: { journals: [] }, hr: {},
};
const audit = { rows: [{ timestamp: "2026-08-09T10:00:00Z", module: "Sales", action: "Created", recordId: "INV-1", actor: "Owner" }] };

test("Executive workbook uses the existing branded workbook standard and AED formatting", async () => {
  const model = analyticsReportModel("executive", { sources, filters, audit, company });
  const book = buildAnalyticsWorkbook(XLSX, model, { company, generatedAt: new Date("2026-08-30T10:00:00Z") });
  const summary = book.Sheets.Summary;
  assert.equal(summary.A1.v, company.name);
  assert.equal(summary.A2.v, "Executive Dashboard");
  assert.match(summary.A3.v, /InfoBridgeIndia.*2026-08-01 to 2026-08-31.*AED/);
  assert.equal(summary.A6.v, "Total Sales");
  assert.match(summary.B6.z, /AED/);
  assert.equal(summary["!cols"].length, 3);
  assert.equal(summary["!freeze"].ySplit, 5);
  const bytes = XLSX.writeBytes(book);
  const parsed = await XLSX.readAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.deepEqual(parsed.SheetNames, ["Summary", "Business Summary"]);
  assert.equal(parsed.Sheets.Summary.A1.v, company.name);
});

test("clean Reports print document contains report content and excludes application controls", () => {
  const model = analyticsReportModel("executive", { sources, filters, audit, company });
  const html = renderAnalyticsPrintDocument(model, { company, generatedAt: new Date("2026-08-30T10:00:00Z") });
  assert.match(html, /class="company-report-header"/);
  assert.match(html, /class="company-logo" src="data:image\/png;base64,AAAA"/);
  assert.match(html, /Example Trading LLC/);
  assert.match(html, /Dubai/);
  assert.match(html, /Abu Dhabi/);
  assert.match(html, /TRN: 100000000000001/);
  assert.match(html, /Executive Dashboard/);
  assert.match(html, /2026-08-01 to 2026-08-31/);
  assert.match(html, /AED/);
  assert.match(html, /@page\{size:A4/);
  assert.doesNotMatch(html, /infobridgeindia-logo\.png/i);
  const body = html.slice(html.indexOf("<body>"));
  assert.ok(body.indexOf("Example Trading LLC") < body.indexOf("Executive Dashboard"));
  assert.ok(html.indexOf("Generated with InfoBridgeIndia") > html.indexOf("Business Summary"));
  for (const forbidden of ["sidebar", "global-search", "Refresh Sources", "Apply", "Clear", "Open Sales", "data-export"]) assert.doesNotMatch(html, new RegExp(forbidden, "i"));
});

test("temporary Reports print document closes after Save PDF or Cancel without navigating the Reports app", () => {
  const model = analyticsReportModel("executive", { sources, filters, audit, company });
  const html = renderAnalyticsPrintDocument(model, { company, generatedAt: new Date("2026-08-30T10:00:00Z") });
  assert.match(html, /addEventListener\("afterprint",closePrintWindow,\{once:true\}\)/);
  assert.match(html, /addEventListener\("focus",\(\)=>setTimeout\(closePrintWindow,250\),\{once:true\}\)/);
  assert.match(html, /window\.print\(\)/);
  assert.match(html, /window\.close\(\)/);
  assert.doesNotMatch(html, /opener\.location|location\.(?:assign|replace)|history\.(?:back|go)/);
  const app = readFileSync(new URL("../src/analytics/app.js", import.meta.url), "utf8");
  assert.match(app, /const model=exportModel\(key\),popup=open\("","_blank"\)/);
  assert.doesNotMatch(app, /location\.(?:assign|replace).*print|document\.write\(renderAnalyticsPrintDocument[^)]*\).*location/s);

  const runLifecycle = completionEvent => {
    const listeners = {}, calls = { print: 0, close: 0 };
    const addEventListener = (name, handler) => { listeners[name] = handler; };
    const window = { print: () => { calls.print += 1; }, close: () => { calls.close += 1; } };
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    runInNewContext(script, { addEventListener, setTimeout: handler => handler(), window });
    listeners.load();
    listeners[completionEvent]();
    return calls;
  };
  assert.deepEqual(runLifecycle("afterprint"), { print: 1, close: 1 });
  assert.deepEqual(runLifecycle("focus"), { print: 1, close: 1 });
});

test("Sales, Banking, and all requested report models expose human-readable export structures", () => {
  const keys = ["executive", "sales", "purchases", "inventory", "banking", "profitability", "receivables", "payables", "statutory", "management", "audit", "custom", "saved"];
  for (const key of keys) {
    const model = analyticsReportModel(key, { sources, filters, audit, company, custom: { source: "Sales", rows: sources.sales.invoices, fields: ["id", "grandTotal"], savedReports: [] } });
    assert.ok(model.title, key);
    assert.equal(model.currency, "AED", key);
    assert.doesNotThrow(() => buildAnalyticsWorkbook(XLSX, model, { company }), key);
  }
  assert.equal(analyticsReportModel("statutory", { sources, filters, company }).title, "VAT & Statutory");
  assert.equal(analyticsReportModel("banking", { sources, filters, company }).metrics[0].label, "Book Balance");
});

test("India statutory exports retain GST terminology without UAE VAT headings", () => {
  const indiaSources = { ...sources, statutory: { available: true, taxSystem: "GST", rows: [{ date: "2026-08-05", taxableValue: 1000, cgst: 90, sgst: 90, igst: 0, cess: 0 }] } };
  const model = analyticsReportModel("statutory", { sources: indiaSources, filters, company: { name: "India Co", country: "IN" } });
  assert.equal(model.title, "GST & Statutory");
  assert.equal(model.currency, "INR");
  assert.deepEqual(model.metrics.slice(1, 4).map(item => item.label), ["CGST", "SGST", "IGST"]);
  assert.doesNotMatch(analyticsReportCsv(model), /Output VAT|Input VAT/);
});

test("CSV remains available with branded context and human-readable labels", () => {
  const csv = analyticsReportCsv(analyticsReportModel("executive", { sources, filters, company }));
  assert.match(csv, /InfoBridgeIndia/);
  assert.match(csv, /Executive Dashboard/);
  assert.match(csv, /Total Sales/);
  assert.match(csv, /Cash & Bank/);
  assert.doesNotMatch(csv, /"cashBank"|"salesReturns"|"purchaseReturns"/);
});

test("Reports export controls route to workbook, CSV, and dedicated print-document handlers", () => {
  const app = readFileSync(new URL("../src/analytics/app.js", import.meta.url), "utf8");
  assert.match(app, /data-export="\$\{key\}">Excel/);
  assert.match(app, /data-csv="\$\{key\}">CSV/);
  assert.match(app, /data-print="\$\{key\}">Print \/ PDF/);
  assert.match(app, /buildAnalyticsWorkbook\(XLSX,model/);
  assert.match(app, /renderAnalyticsPrintDocument\(model/);
  assert.doesNotMatch(app, /data-print[^\n]+window\.print\(\)/);
});
