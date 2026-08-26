import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderInvoiceDocument } from "../src/sales/invoice-document.js";

const customer = { name: "Grand Horizon Hotel Dubai", contactPerson: "Ahmed Khalid", mobile: "050 123 4567", email: "events@grandhorizon.ae", assignedSalesperson: "Rizwan Shaikh" };
const uaeInvoice = { id: "INV/2026-27/0001", orderId: "SO/2026-27/0001", quotationId: "QT/2026-27/0001", countryCode: "AE", date: "2026-08-25", dueDate: "2026-09-24", assignedSalesperson: "Rizwan Shaikh", taxable: 7500, vat: 375, grandTotal: 7875, roundOff: 0, additionalCharges: 0, items: [{ description: "Event Waiter Manpower Supply", itemCode: "SERVICE", quantity: 25, unit: "Person", rate: 300, discount: 0, gstRate: 5, taxable: 7500 }] };

test("UAE invoice print is AED/VAT-specific and hides GST-only fields", () => {
  const html = renderInvoiceDocument({ invoice: uaeInvoice, company: { country: "AE", name: "Shayay Hospitality", address: "Abu Dhabi", trn: "100000000000013", vatRegistered: true }, customer });
  assert.match(html, /TAX INVOICE/);
  assert.match(html, /INV\/2026-27\/0001/);
  assert.match(html, /Sales Order Reference/);
  assert.match(html, /SO\/2026-27\/0001/);
  assert.match(html, /Quotation Reference/);
  assert.match(html, /QT\/2026-27\/0001/);
  assert.match(html, /Item \/ Service Code/);
  assert.match(html, /VAT 5%/);
  assert.match(html, /TRN:/);
  assert.match(html, /AED[^<]*7,500\.00|AED&nbsp;7,500\.00/);
  assert.match(html, /AED[^<]*7,875\.00|AED&nbsp;7,875\.00/);
  assert.doesNotMatch(html, /HSN \/ SAC|GSTIN|CGST|SGST|IGST|Place of Supply/);
  assert.match(html, /Authorized Signatory/);
});

test("India invoice print uses INR/GST fields without UAE registration fields", () => {
  const invoice = { ...uaeInvoice, id: "INV-IN/1", countryCode: "IN", placeOfSupply: "Maharashtra (27)", vat: 0, cgst: 675, sgst: 675, grandTotal: 8850, items: [{ ...uaeInvoice.items[0], itemCode: undefined, hsnSac: "9985", gstRate: 18 }] };
  const html = renderInvoiceDocument({ invoice, company: { country: "IN", name: "India Services Pvt Ltd", address: "Mumbai", state: "Maharashtra", gstin: "27ABCDE1234F1Z5", gstRegistered: true }, customer: { ...customer, gstin: "27ABCDE1234F1Z5" } });
  assert.match(html, /GST INVOICE/);
  assert.match(html, /HSN \/ SAC/);
  assert.match(html, /9985/);
  assert.match(html, /GSTIN:/);
  assert.match(html, /CGST/);
  assert.match(html, /SGST/);
  assert.match(html, /Place of Supply/);
  assert.match(html, /Maharashtra \(27\)/);
  assert.doesNotMatch(html, /TRN:|Item \/ Service Code/);
});

test("Sales app routes invoice preview to the dedicated country-aware renderer", () => {
  const source = readFileSync(new URL("../src/sales/app.js", import.meta.url), "utf8");
  assert.match(source, /renderInvoiceDocument/);
  assert.match(source, /data-preview\^="invoices:/);
  assert.match(source, /professionalInvoicePreview/);
});

test("Sales & CRM invoice section uses country-neutral naming instead of GST-specific naming", () => {
  const source = readFileSync(new URL("../src/sales/app.js", import.meta.url), "utf8");
  assert.match(source, /\["invoices","Invoices"\]/);
  assert.match(source, /invoices:\["Invoices"/);
  assert.doesNotMatch(source, /GST Invoices/);
});
