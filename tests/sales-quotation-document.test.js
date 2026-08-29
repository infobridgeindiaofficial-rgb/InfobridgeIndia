import test from "node:test";
import assert from "node:assert/strict";
import { renderQuotationDocument } from "../src/sales/quotation-document.js";

const company = { country: "AE", name: "Shayay Hospitality", address: "Business Bay", city: "Dubai", state: "Dubai", trn: "100123456700003", vatRegistered: true, logo: "data:image/png;base64,AAAA", phone: "+971 4 555 0100" };
const quote = { id: "QT/2026-27/0001", country: "AE", date: "2026-08-25", validUntil: "2026-09-01", status: "Sent", leadId: "LEAD/2026-27/0001", assignedSalesperson: "Rizwan Shaikh", taxable: 7500, vat: 375, grandTotal: 7875, additionalCharges: 0, roundOff: 0, customerNotes: "Thank you for the opportunity.", terms: "Valid for seven days.", notes: "PRIVATE CRM NOTE", items: [{ description: "Event Waiter Manpower Supply", itemCode: "SERVICE", quantity: 25, unit: "Service", rate: 300, discount: 0, gstRate: 5, taxable: 7500, total: 7875 }] };
const party = { name: "Grand Horizon Hotel Dubai", contactPerson: "Amina", address: "Sheikh Zayed Road, Dubai", mobile: "+971 50 000 0000", email: "events@grandhorizon.test" };

test("UAE quotation renders as a dedicated professional A4 document", () => {
  const html = renderQuotationDocument({ quote, company, party });
  assert.match(html, /@page\{size:A4;margin:0\}/);
  assert.match(html, /@media print[\s\S]*padding:12mm 12mm 14mm/);
  assert.match(html, /class="company-logo" src="data:image\/png;base64,AAAA"/);
  assert.match(html, />QUOTATION</);
  assert.match(html, /QT\/2026-27\/0001/);
  assert.match(html, /Grand Horizon Hotel Dubai/);
  assert.match(html, /Rizwan Shaikh/);
  assert.match(html, /<span>Contact Person<\/span><strong>Rizwan Shaikh<\/strong>/);
  assert.doesNotMatch(html, /Lead Reference|LEAD\/2026-27\/0001/);
  assert.equal(quote.leadId, "LEAD/2026-27/0001", "rendering must not alter the stored internal lead link");
  assert.match(html, /<th>Qty<\/th><th>Unit<\/th>/);
  assert.match(html, /Item \/ Service Code/);
  assert.match(html, /VAT 5%/);
  assert.match(html, /AED\s*7,875\.00/);
  assert.doesNotMatch(html, /Grand Total AED AED/i);
  assert.doesNotMatch(html, /HSN|CGST|SGST|IGST/);
  assert.doesNotMatch(html, /PRIVATE CRM NOTE/);
  assert.doesNotMatch(html, /localhost|Sales &amp; CRM|window\.print|overflow-x/);
  assert.match(html, /For Shayay Hospitality/);
  assert.match(html, /Authorized Signatory/);
  assert.match(html, /<footer class="report-footer">/);
  assert.match(html, /Generated with InfoBridgeIndia/);
});

test("India quotation uses the same document structure with GST-only fields", () => {
  const html = renderQuotationDocument({ quote: { ...quote, id: "QT-IN/1", country: "IN", placeOfSupply: "27", vat: 0, cgst: 675, sgst: 675, grandTotal: 8850, items: [{ ...quote.items[0], itemCode: undefined, hsnSac: "9985", gstRate: 18 }] }, company: { country: "IN", name: "India Services Pvt Ltd", address: "Mumbai", state: "Maharashtra", gstin: "27ABCDE1234F1Z5", gstRegistered: true }, party });
  assert.match(html, /HSN \/ SAC/);
  assert.match(html, /GSTIN: 27ABCDE1234F1Z5/);
  assert.match(html, /Place of Supply/);
  assert.match(html, /CGST/);
  assert.match(html, /SGST/);
  assert.match(html, /INR/);
  assert.doesNotMatch(html, /TRN:|VAT %|VAT 18%/);
  assert.doesNotMatch(html, /Lead Reference|LEAD\/2026-27\/0001/);
});

test("missing logo falls back to company name without a broken image", () => {
  const html = renderQuotationDocument({ quote, company: { ...company, logo: "" }, party });
  assert.doesNotMatch(html, /class="company-logo"/);
  assert.match(html, /<h1>Shayay Hospitality<\/h1>/);
});

test("UAE address comes only from the active company profile without a Dubai fallback", () => {
  const html = renderQuotationDocument({ quote, company: { ...company, address: "Al Maryah Island", city: "Abu Dhabi", state: "Abu Dhabi" }, party });
  assert.match(html, /Al Maryah Island/);
  assert.match(html, /Abu Dhabi/);
  assert.match(html, />UAE</);
  assert.doesNotMatch(html, /Dubai, UAE|>Dubai</);
});
