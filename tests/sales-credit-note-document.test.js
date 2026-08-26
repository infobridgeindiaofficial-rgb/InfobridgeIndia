import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderCreditNoteDocument } from "../src/sales/credit-note-document.js";

const customer = { name: "Grand Horizon Hotel Dubai", contactPerson: "Ahmed Khalid", mobile: "050 123 4567", email: "events@grandhorizon.ae" };
const uaeInvoice = { id: "INV/2026-27/0001", date: "2026-08-25", countryCode: "AE" };
const uaeCreditNote = { id: "CN/2026-27/0001", invoiceId: uaeInvoice.id, countryCode: "AE", date: "2026-08-26", reasonType: "Service Cancellation", reason: "Guest count reduced from 25 to 20", taxable: 1500, vat: 75, grandTotal: 1575, roundOff: 0, settlementMethod: "", excessAmount: 0, items: [{ description: "Event Waiter Manpower Supply", itemCode: "SERVICE", quantity: 5, unit: "Person", rate: 300, discount: 0, gstRate: 5, taxable: 1500 }] };

test("UAE credit note document shows VAT/AED/TRN terminology and hides GST-only fields", () => {
  const html = renderCreditNoteDocument({ creditNote: uaeCreditNote, invoice: uaeInvoice, company: { country: "AE", name: "Shayay Hospitality", address: "Abu Dhabi", trn: "100000000000013", vatRegistered: true }, customer });
  assert.match(html, /CREDIT NOTE/);
  assert.match(html, /CN\/2026-27\/0001/);
  assert.match(html, /Original Invoice No\./);
  assert.match(html, /INV\/2026-27\/0001/);
  assert.match(html, /Item \/ Service Code/);
  assert.match(html, /VAT 5%/);
  assert.match(html, /TRN:/);
  assert.match(html, /AED[^<]*1,500\.00|AED&nbsp;1,500\.00/);
  assert.match(html, /AED[^<]*75\.00|AED&nbsp;75\.00/);
  assert.match(html, /AED[^<]*1,575\.00|AED&nbsp;1,575\.00/);
  assert.match(html, /TOTAL CREDIT/);
  assert.match(html, /Guest count reduced from 25 to 20/);
  assert.doesNotMatch(html, /HSN \/ SAC|GSTIN|CGST|SGST|IGST|Place of Supply/);
  assert.doesNotMatch(html, /LEAD-|QT\/|SO\//);
  assert.match(html, /Authorized Signatory/);
});

test("India credit note document shows GST/INR/GSTIN terminology and CGST+SGST breakdown", () => {
  const invoice = { id: "INV-IN/1", date: "2026-08-19", countryCode: "IN", placeOfSupply: "33" };
  const creditNote = { id: "CN-IN/1", invoiceId: invoice.id, countryCode: "IN", date: "2026-08-20", reasonType: "Billing Correction", reason: "Rate correction", taxable: 5000, cgst: 450, sgst: 450, igst: 0, grandTotal: 5900, roundOff: 0, items: [{ description: "Consulting", hsnSac: "9983", quantity: 0.5, unit: "Service", rate: 10000, discount: 0, gstRate: 18, taxable: 5000 }] };
  const html = renderCreditNoteDocument({ creditNote, invoice, company: { country: "IN", name: "India Services Pvt Ltd", address: "Chennai", state: "Tamil Nadu", gstin: "33AAAAA0000A1Z5", gstRegistered: true }, customer: { ...customer, gstin: "33AAAAA0000A1Z5" } });
  assert.match(html, /CREDIT NOTE/);
  assert.match(html, /HSN \/ SAC/);
  assert.match(html, /9983/);
  assert.match(html, /GSTIN:/);
  assert.match(html, /CGST/);
  assert.match(html, /SGST/);
  assert.match(html, /INR/);
  assert.doesNotMatch(html, /TRN:|Item \/ Service Code/);
});

test("Credit note document shows settlement information only when a settlement method is recorded", () => {
  const settled = { ...uaeCreditNote, settlementMethod: "Refund Customer", excessAmount: 700 };
  const html = renderCreditNoteDocument({ creditNote: settled, invoice: uaeInvoice, company: { country: "AE", name: "Shayay Hospitality" }, customer });
  assert.match(html, /Settlement/);
  assert.match(html, /Refund Customer/);
  const withoutSettlement = renderCreditNoteDocument({ creditNote: uaeCreditNote, invoice: uaeInvoice, company: { country: "AE", name: "Shayay Hospitality" }, customer });
  assert.doesNotMatch(withoutSettlement, /<h2>Settlement<\/h2>/);
});

const app = readFileSync(new URL("../src/sales/app.js", import.meta.url), "utf8");

test("Sales app routes credit note preview to the dedicated professional renderer", () => {
  assert.match(app, /renderCreditNoteDocument/);
  assert.match(app, /data-preview\^="returns:/);
  assert.match(app, /professionalCreditNotePreview/);
});

test("Returns & Credit Notes page uses country-neutral naming and the Create Credit Note action", () => {
  assert.match(app, /Create Credit Note/);
  assert.doesNotMatch(app, /Create Return</);
  assert.match(app, /Create credit notes for returns, cancellations, billing corrections, discounts, and invoice adjustments\./);
  assert.doesNotMatch(app, /Reverse invoiced quantities and GST/);
  assert.doesNotMatch(app, /Create a return against an existing GST invoice/);
});

test("Create Credit Note form loads the original invoice's items instead of manual entry", () => {
  assert.match(app, /function returnModal\(invoiceId\)/);
  assert.match(app, /creditableInvoiceLines\(state,invoice\.id\)/);
  assert.match(app, /Original Qty.*Credit \/ Return Qty/);
  assert.match(app, /data-credit-qty/);
  assert.match(app, /max="\$\{line\.remaining\}"/);
});

test("Credit note settlement section is only shown when the credited amount exceeds the outstanding balance", () => {
  assert.match(app, /data-settlement/);
  assert.match(app, /settlementBox\.style\.display=excess>0\?"":"none"/);
  assert.match(app, /SETTLEMENT_METHODS/);
});

test("Original Invoice is a searchable invoice-number selector instead of a plain dropdown", () => {
  assert.match(app, />Original Invoice<input type="hidden" name="invoiceId"/);
  assert.doesNotMatch(app, /Original Invoice<select name="invoiceId"/);
  assert.match(app, /data-invoice-search/);
  assert.match(app, /placeholder="Search by invoice number…"/);
  assert.match(app, /data-invoice-results/);
});

test("Invoice search filters by invoice number via the shared searchInvoicesByNumber helper", () => {
  assert.match(app, /searchInvoicesByNumber/);
  assert.match(app, /searchInvoices=query=>searchInvoicesByNumber\(eligible,query\)/);
});

test("Invoice search results show invoice number, customer, total and status, and selecting one reuses the existing selection behavior", () => {
  assert.match(app, /invoiceLabel=x=>`\$\{x\.id\} · \$\{customerName\(x\.customerId\)\} · \$\{money\(x\.grandTotal\)\} · \$\{x\.status\}`/);
  assert.match(app, /data-invoice-option/);
  assert.match(app, /function pick\(id\)\{const found=eligible\.find\(x=>x\.id===id\);if\(!found\)return;hiddenInput\.value=found\.id;searchInput\.value=invoiceLabel\(found\);resultsBox\.hidden=true;selectInvoice\(found\.id\)\}/);
  assert.match(app, /function selectInvoice\(id\)\{invoice=eligible\.find\(x=>x\.id===id\)\|\|invoice;lines=creditableInvoiceLines\(state,invoice\.id\);summaryBox\.innerHTML=summaryHtml\(\);linesBox\.innerHTML=linesHtml\(\);bindLineInputs\(\);recalc\(\)\}/);
});

test("Invoice search supports opening with recent invoices, keyboard selection and closing without losing the current selection", () => {
  assert.match(app, /searchInput\.addEventListener\("focus",\(\)=>renderResults\(searchInvoices\(searchInput\.value\)\)\)/);
  assert.match(app, /searchInput\.addEventListener\("input",\(\)=>renderResults\(searchInvoices\(searchInput\.value\)\)\)/);
  assert.match(app, /e\.key==="Enter"/);
  assert.match(app, /e\.key==="Escape"/);
  assert.match(app, /searchInput\.addEventListener\("blur",\(\)=>setTimeout\(\(\)=>\{resultsBox\.hidden=true;searchInput\.value=invoiceLabel\(invoice\)\},150\)\)/);
});
