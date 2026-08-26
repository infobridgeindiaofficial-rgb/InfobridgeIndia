import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialState, saveLead, saveQuotation, convertQuotationToOrder, convertOrderToInvoice, recordPayment, reversePayment, createReturn } from "../src/sales/core.js";
import { buildReport, REPORT_TYPES } from "../src/sales/reports.js";
import { renderSalesReportDocument } from "../src/sales/sales-report-document.js";

function withUAE(fn) { const previous = globalThis.InfoBridgeCompany; globalThis.InfoBridgeCompany = { country: "AE", state: "Dubai" }; try { return fn(); } finally { globalThis.InfoBridgeCompany = previous; } }

function uaeInvoiceScenario() {
  let r = saveLead(initialState(), { name: "Grand Horizon Hotel Dubai", mobile: "+971501234567", stage: "Qualified", interest: "Event Waiter Manpower Supply", assignedSalesperson: "Rizwan Shaikh" });
  let state = r.state, lead = r.record;
  r = saveQuotation(state, { leadId: lead.id, date: "2026-08-25", status: "Sent", items: [{ description: "Event Waiter Manpower Supply", itemCode: "SERVICE", quantity: 25, unit: "Person", rate: 300, discount: 0, gstRate: 5 }] });
  state = r.state; const quote = r.record;
  r = convertQuotationToOrder(state, quote.id); state = r.state; const order = r.record;
  r = convertOrderToInvoice(state, order.id); state = r.state; const invoice = r.record;
  return { state, invoice };
}

function indiaInvoiceScenario() {
  let state = initialState(); state.settings.sellerStateCode = "33";
  let r = saveLead(state, { name: "Acme Traders", mobile: "9876543210", stage: "Qualified", interest: "Consulting" });
  state = r.state; const lead = r.record;
  r = saveQuotation(state, { leadId: lead.id, date: "2026-08-19", placeOfSupply: "33", status: "Sent", items: [{ description: "Consulting", hsnSac: "9983", quantity: 1, unit: "Service", rate: 10000, discount: 0, gstRate: 18 }] });
  state = r.state; const quote = r.record;
  r = convertQuotationToOrder(state, quote.id); state = r.state; const order = r.record;
  r = convertOrderToInvoice(state, order.id); state = r.state; const invoice = r.record;
  return { state, invoice };
}

const numOf = value => Number(String(value).replace(/[^0-9.-]/g, ""));
const moneyEq = (actual, expected) => assert.equal(String(actual).replace(/ /g, " "), expected);

// 1-3: Gross Sales / Credit Notes / Net Sales
test("Sales Summary: UAE gross sales, credit notes and net sales match the worked example", () => withUAE(() => {
  let { state, invoice } = uaeInvoiceScenario();
  let r = createReturn(state, { invoiceId: invoice.id, date: "2026-08-26", reasonType: "Service Cancellation", reason: "Guest count reduced", items: [{ description: "Event Waiter Manpower Supply", quantity: 5 }] });
  state = r.state;
  const report = buildReport(state, "Sales Summary", { company: { country: "AE" } });
  const byLabel = label => report.summary.find(x => x.label === label).value;
  moneyEq(byLabel("Gross Sales"), "AED 7,875.00");
  moneyEq(byLabel("Credit Notes"), "AED 1,575.00");
  moneyEq(byLabel("Net Sales"), "AED 6,300.00");
}));

// 4-9: Tax Report gross/taxable/net taxable/output/credit/net VAT
test("Tax Report: UAE gross taxable, taxable credit, net taxable, output VAT, VAT credit and net VAT match the worked example", () => withUAE(() => {
  let { state, invoice } = uaeInvoiceScenario();
  let r = createReturn(state, { invoiceId: invoice.id, date: "2026-08-26", reasonType: "Service Cancellation", reason: "Guest count reduced", items: [{ description: "Event Waiter Manpower Supply", quantity: 5 }] });
  state = r.state;
  const report = buildReport(state, "Tax Report", { company: { country: "AE" } });
  const byLabel = label => report.summary.find(x => x.label === label).value;
  moneyEq(byLabel("Gross Taxable Sales"), "AED 7,500.00");
  moneyEq(byLabel("Less Taxable Credits"), "AED 1,500.00");
  moneyEq(byLabel("Net Taxable Sales"), "AED 6,000.00");
  moneyEq(byLabel("Output VAT"), "AED 375.00");
  moneyEq(byLabel("Less VAT Credit Adjustments"), "AED 75.00");
  moneyEq(byLabel("NET VAT"), "AED 300.00");
}));

// 10: UAE report hides CGST/SGST/IGST
test("Tax Report: UAE columns never expose CGST/SGST/IGST/GSTIN/HSN/Place of Supply", () => withUAE(() => {
  const { state } = uaeInvoiceScenario();
  const report = buildReport(state, "Tax Report", { company: { country: "AE" } });
  const joined = report.columns.join(" ");
  assert.doesNotMatch(joined, /CGST|SGST|IGST|GSTIN|HSN|Place of Supply/);
  assert.match(joined, /TRN/);
}));

// 11-12: India GST fields + credit note GST adjustment
test("Tax Report: India uses GST/GSTIN fields and a credit note correctly adjusts net GST", () => {
  let { state, invoice } = indiaInvoiceScenario();
  let r = createReturn(state, { invoiceId: invoice.id, date: "2026-08-20", reasonType: "Billing Correction", reason: "Rate correction", items: [{ description: "Consulting", quantity: 0.5 }] });
  state = r.state;
  const report = buildReport(state, "Tax Report", { company: { country: "IN" } });
  const joined = report.columns.join(" ");
  assert.match(joined, /CGST/); assert.match(joined, /SGST/); assert.match(joined, /GSTIN/);
  assert.doesNotMatch(joined, /TRN/);
  const byLabel = label => report.summary.find(x => x.label === label).value;
  assert.equal(byLabel("Gross Taxable Sales"), "₹10,000.00");
  assert.equal(byLabel("Less Taxable Credits"), "₹5,000.00");
  assert.equal(byLabel("Net Taxable Sales"), "₹5,000.00");
  assert.equal(byLabel("Output GST"), "₹1,800.00");
  assert.equal(byLabel("Less GST Credit Adjustments"), "₹900.00");
  assert.equal(byLabel("NET GST"), "₹900.00");
});

// 13, 28: Collections use non-reversed payments; reversed payments do not inflate totals
test("Collections Report: total only includes non-reversed payments, but reversed payments remain visible in history", () => withUAE(() => {
  let { state, invoice } = uaeInvoiceScenario();
  let r = recordPayment(state, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-08-27", amount: 2000, mode: "Cash" });
  state = r.state; const receipt = r.record;
  r = recordPayment(state, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-08-27", amount: 1000, mode: "Card" });
  state = r.state;
  state = reversePayment(state, receipt.id, "Chargeback");
  const report = buildReport(state, "Collections Report", { company: { country: "AE" } });
  assert.equal(report.summary[0].label, "Total Collections");
  moneyEq(report.summary[0].value, "AED 1,000.00");
  assert.equal(report.rows.length, 2);
  assert.ok(report.rows.some(row => row.Status === "Reversed"));
}));

// 14: Outstanding uses actual current invoice balance
test("Outstanding Receivables uses the invoice's live current balance, not a stale figure", () => withUAE(() => {
  let { state, invoice } = uaeInvoiceScenario();
  let r = recordPayment(state, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-08-27", amount: 3000, mode: "Cash" });
  state = r.state;
  const report = buildReport(state, "Outstanding Receivables", { company: { country: "AE" } });
  assert.equal(report.rows.length, 1);
  moneyEq(report.rows[0]["Balance Due"], "AED 4,875.00");
  const paidInFull = recordPayment(state, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-08-28", amount: 4875, mode: "Cash" }).state;
  assert.equal(buildReport(paidInFull, "Outstanding Receivables", { company: { country: "AE" } }).rows.length, 0);
}));

// 15-16: Salesperson report resolves legacy name + HR employee ID, no double counting
test("Salesperson Performance resolves a legacy name-only record and an HR-ID record to one row each, without double counting", () => withUAE(() => {
  let { state, invoice } = uaeInvoiceScenario();
  state.team.push({ id: "USR-1", employeeId: "UAE005", target: 50000, branch: "Head Office" });
  const employees = [{ id: "UAE005", firstName: "Rizwan", lastName: "Shaikh", designation: "Sales Executive" }];
  const report = buildReport(state, "Salesperson Performance", { company: { country: "AE" }, employees });
  const rizwanRows = report.rows.filter(r => r.Salesperson === "Rizwan Shaikh");
  assert.equal(rizwanRows.length, 1);
  moneyEq(rizwanRows[0]["Gross Sales"], "AED 7,875.00");
  assert.equal(rizwanRows[0].Designation, "Sales Executive");
}));

// 17-19: date filters (invoice, credit note, payment)
test("Invoice Report date filter uses invoice date, Credit Note report uses credit note date, Collections uses payment date", () => withUAE(() => {
  let { state, invoice } = uaeInvoiceScenario();
  let r = recordPayment(state, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-09-05", amount: 1000, mode: "Cash" });
  state = r.state;
  r = createReturn(state, { invoiceId: invoice.id, date: "2026-09-10", reasonType: "Product Return", reason: "Test", items: [{ description: "Event Waiter Manpower Supply", quantity: 1 }] });
  state = r.state;
  assert.equal(buildReport(state, "Invoice Report", { from: "2026-08-25", to: "2026-08-25", company: { country: "AE" } }).rows.length, 1);
  assert.equal(buildReport(state, "Invoice Report", { from: "2026-09-01", to: "2026-09-30", company: { country: "AE" } }).rows.length, 0);
  assert.equal(buildReport(state, "Credit Note / Returns Report", { from: "2026-09-10", to: "2026-09-10", company: { country: "AE" } }).rows.length, 1);
  assert.equal(buildReport(state, "Credit Note / Returns Report", { from: "2026-08-01", to: "2026-08-31", company: { country: "AE" } }).rows.length, 0);
  assert.equal(buildReport(state, "Collections Report", { from: "2026-09-05", to: "2026-09-05", company: { country: "AE" } }).rows.length, 1);
  assert.equal(buildReport(state, "Collections Report", { from: "2026-08-01", to: "2026-08-31", company: { country: "AE" } }).rows.length, 0);
}));

test("Date filtering with only From, only To, both, and neither behaves correctly", () => withUAE(() => {
  const { state } = uaeInvoiceScenario();
  assert.equal(buildReport(state, "Invoice Report", { from: "2026-08-25", company: { country: "AE" } }).rows.length, 1);
  assert.equal(buildReport(state, "Invoice Report", { from: "2026-08-26", company: { country: "AE" } }).rows.length, 0);
  assert.equal(buildReport(state, "Invoice Report", { to: "2026-08-25", company: { country: "AE" } }).rows.length, 1);
  assert.equal(buildReport(state, "Invoice Report", { to: "2026-08-24", company: { country: "AE" } }).rows.length, 0);
  assert.equal(buildReport(state, "Invoice Report", { from: "2026-08-01", to: "2026-08-31", company: { country: "AE" } }).rows.length, 1);
  assert.equal(buildReport(state, "Invoice Report", { company: { country: "AE" } }).rows.length, 1);
}));

// 20-22: CSV respects report type, dates and UAE/India fields (via row shape, consumed by the existing toCsv helper)
test("Report rows are plain label-keyed objects usable directly by the existing CSV exporter, per selected report and date range", () => withUAE(() => {
  let { state, invoice } = uaeInvoiceScenario();
  let r = createReturn(state, { invoiceId: invoice.id, date: "2026-08-26", reasonType: "Product Return", reason: "Test", items: [{ description: "Event Waiter Manpower Supply", quantity: 5 }] });
  state = r.state;
  const full = buildReport(state, "Sales Summary", { company: { country: "AE" } });
  assert.deepEqual(Object.keys(full.rows[0]), full.columns);
  const filtered = buildReport(state, "Sales Summary", { from: "2026-08-26", to: "2026-08-26", company: { country: "AE" } });
  assert.equal(filtered.rows.length, 0);
}));

test("CSV field set differs correctly between UAE and India for the same report type", () => {
  const uaeColumns = withUAE(() => buildReport(uaeInvoiceScenario().state, "Tax Report", { company: { country: "AE" } }).columns);
  const indiaColumns = buildReport(indiaInvoiceScenario().state, "Tax Report", { company: { country: "IN" } }).columns;
  assert.notDeepEqual(uaeColumns, indiaColumns);
  assert.ok(uaeColumns.includes("TRN") && !uaeColumns.includes("GSTIN"));
  assert.ok(indiaColumns.includes("GSTIN") && !indiaColumns.includes("TRN"));
});

// 23-26: Preview contains company name, logo mechanism, UAE TRN/VAT, India GSTIN/GST
test("Report preview document contains the company name and the same logo resolution used by other Sales documents", () => withUAE(() => {
  const { state } = uaeInvoiceScenario();
  const report = buildReport(state, "Sales Summary", { company: { country: "AE" } });
  const html = renderSalesReportDocument({ report, company: { country: "AE", name: "Shayay Hospitality", logo: "/logo.png" } });
  assert.match(html, /Shayay Hospitality/);
  assert.match(html, /<img class="company-logo" src="\/logo\.png"/);
  const withoutLogo = renderSalesReportDocument({ report, company: { country: "AE", name: "Shayay Hospitality" } });
  assert.doesNotMatch(withoutLogo, /<img class="company-logo"/);
}));

test("UAE report preview uses TRN/VAT terminology and India preview uses GSTIN/GST terminology", () => {
  const uaeReport = withUAE(() => buildReport(uaeInvoiceScenario().state, "Sales Summary", { company: { country: "AE" } }));
  const uaeHtml = renderSalesReportDocument({ report: uaeReport, company: { country: "AE", name: "Shayay Hospitality", trn: "100000000000013", vatRegistered: true } });
  assert.match(uaeHtml, /TRN: 100000000000013/);
  assert.match(uaeHtml, /VAT/);
  const indiaReport = buildReport(indiaInvoiceScenario().state, "Sales Summary", { company: { country: "IN" } });
  const indiaHtml = renderSalesReportDocument({ report: indiaReport, company: { country: "IN", name: "India Services Pvt Ltd", gstin: "27ABCDE1234F1Z5", gstRegistered: true } });
  assert.match(indiaHtml, /GSTIN: 27ABCDE1234F1Z5/);
  assert.match(indiaHtml, /GST/);
});

// 27: Net values never double-deduct the same credit
test("A single credit note is deducted exactly once across the summary and its own invoice row, never twice", () => withUAE(() => {
  let { state, invoice } = uaeInvoiceScenario();
  let r = createReturn(state, { invoiceId: invoice.id, date: "2026-08-26", reasonType: "Product Return", reason: "Test", items: [{ description: "Event Waiter Manpower Supply", quantity: 5 }] });
  state = r.state;
  const report = buildReport(state, "Sales Summary", { company: { country: "AE" } });
  const netSalesSummary = numOf(report.summary.find(x => x.label === "Net Sales").value);
  const netSalesRow = numOf(report.rows[0]["Net Sales"]);
  assert.equal(netSalesSummary, 6300);
  assert.equal(netSalesRow, 6300);
  const invoiceReport = buildReport(state, "Invoice Report", { company: { country: "AE" } });
  assert.equal(numOf(invoiceReport.rows[0]["Net Invoice Value"]), 6300);
}));

// 29: Existing reports with no credit notes still calculate normally
test("With no credit notes, Gross Sales equals Net Sales and Net Taxable equals Gross Taxable", () => withUAE(() => {
  const { state } = uaeInvoiceScenario();
  const summary = buildReport(state, "Sales Summary", { company: { country: "AE" } });
  assert.equal(summary.summary.find(x => x.label === "Gross Sales").value, summary.summary.find(x => x.label === "Net Sales").value);
  moneyEq(summary.summary.find(x => x.label === "Credit Notes").value, "AED 0.00");
  const tax = buildReport(state, "Tax Report", { company: { country: "AE" } });
  assert.equal(tax.summary.find(x => x.label === "Gross Taxable Sales").value, tax.summary.find(x => x.label === "Net Taxable Sales").value);
}));

test("REPORT_TYPES exposes exactly the eight required professional report types", () => {
  assert.deepEqual(REPORT_TYPES, ["Sales Summary", "Invoice Report", "Collections Report", "Outstanding Receivables", "Credit Note / Returns Report", "Tax Report", "Salesperson Performance", "Customer Sales Report"]);
});

// App wiring: Preview Report button, date filters, CSV branching, same document family
const app = readFileSync(new URL("../src/sales/app.js", import.meta.url), "utf8");

test("Reports page keeps Report Type / From / To / Export CSV and adds a Preview Report action", () => {
  assert.match(app, /data-report>/);
  assert.match(app, /data-date-from/);
  assert.match(app, /data-date-to/);
  assert.match(app, /data-export-report>Export CSV/);
  assert.match(app, /data-preview-report>Preview Report/);
});

test("Date filter inputs are bound and re-render the selected report", () => {
  assert.match(app, /\$\("\[data-date-from\]"\)\?\.addEventListener\("change",e=>\{filters\.dateFrom=e\.target\.value;render\(\)\}\)/);
  assert.match(app, /\$\("\[data-date-to\]"\)\?\.addEventListener\("change",e=>\{filters\.dateTo=e\.target\.value;render\(\)\}\)/);
});

test("Export CSV branches to the professional report builder for the eight upgraded report types", () => {
  assert.match(app, /REPORT_TYPES\.includes\(selected\)\)download\(`\$\{selected\}\.csv`,toCsv\(buildReport\(state,selected,reportContext\(\)\)\.rows\)\)/);
});

test("Preview Report reuses the same professional document/print architecture as invoice and credit note previews", () => {
  assert.match(app, /function professionalReportPreview\(type\)/);
  assert.match(app, /renderSalesReportDocument\(\{report,company:globalThis\.InfoBridgeCompany\|\|\{\}\}\)/);
  assert.match(app, /quotation-preview-frame/);
  assert.match(app, /frame\.contentWindow\?\.print\(\)/);
});
