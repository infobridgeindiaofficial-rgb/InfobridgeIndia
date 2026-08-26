import test from "node:test";
import assert from "node:assert/strict";
import { renderSalesOrderDocument } from "../src/sales/sales-order-document.js";

const customer = { name: "Grand Horizon Hotel Dubai", contactPerson: "Ahmed Khalid", mobile: "050 123 4567", email: "events@grandhorizon.ae", assignedSalesperson: "Rizwan Shaikh" };
const uaeOrder = { id: "SO/2026-27/0001", quotationId: "QT/2026-27/0001", leadId: "LEAD/2026-27/0001", countryCode: "AE", date: "2026-08-25", status: "Confirmed", assignedSalesperson: "Rizwan Shaikh", taxable: 7500, vat: 375, grandTotal: 7875, items: [{ description: "Event Waiter Manpower Supply", itemCode: "SERVICE", quantity: 25, unit: "Person", rate: 300, discount: 0, gstRate: 5, taxable: 7500 }] };

test("UAE sales order print is AED/VAT-specific and hides internal lead trace", () => {
  const html = renderSalesOrderDocument({ order: uaeOrder, company: { country: "AE", name: "Shayay Hospitality", address: "Abu Dhabi", trn: "100000000000013", vatRegistered: true, logo: "/logo.png" }, customer });
  assert.match(html, /SALES ORDER/);
  assert.match(html, /SO\/2026-27\/0001/);
  assert.match(html, /QT\/2026-27\/0001/);
  assert.equal(html.match(/Quotation Reference/g)?.length, 1);
  assert.match(html, /Customer PO \/ Reference<\/span><strong>—<\/strong>/);
  assert.match(html, /Service \/ Delivery Date<\/span><strong>—<\/strong>/);
  assert.doesNotMatch(html, /Expected Completion/);
  assert.doesNotMatch(html, /LEAD\/2026-27\/0001|Lead Reference/i);
  assert.match(html, /Grand Horizon Hotel Dubai|Rizwan Shaikh/);
  assert.match(html, /Item \/ Service Code|VAT 5%|TRN:/);
  assert.match(html, /AED[^<]*7,500\.00|AED&nbsp;7,500\.00/);
  assert.match(html, /AED[^<]*375\.00|AED&nbsp;375\.00/);
  assert.match(html, /AED[^<]*7,875\.00|AED&nbsp;7,875\.00/);
  assert.doesNotMatch(html, /HSN \/ SAC|GSTIN|CGST|SGST|IGST|Place of Supply/);
  assert.match(html, /Authorized Signatory/);
  assert.equal(uaeOrder.leadId, "LEAD/2026-27/0001");
});

test("Sales order information renders only saved PO and service date values", () => {
  const html = renderSalesOrderDocument({ order: { ...uaeOrder, customerPoReference: "PO-7781", serviceDate: "2026-09-05" }, company: { country: "AE", name: "Shayay Hospitality" }, customer });
  assert.match(html, /Customer PO \/ Reference<\/span><strong>PO-7781<\/strong>/);
  assert.match(html, /Service \/ Delivery Date<\/span><strong>05 Sept 2026<\/strong>/);
  assert.equal(html.match(/Quotation Reference/g)?.length, 1);
});

test("India sales order print uses INR/GST fields without UAE registration fields", () => {
  const order = { ...uaeOrder, id: "SO-IN/1", countryCode: "IN", placeOfSupply: "Maharashtra (27)", vat: 0, cgst: 675, sgst: 675, grandTotal: 8850, items: [{ ...uaeOrder.items[0], itemCode: undefined, hsnSac: "9985", gstRate: 18 }] };
  const html = renderSalesOrderDocument({ order, company: { country: "IN", name: "India Services Pvt Ltd", address: "Mumbai", state: "Maharashtra", gstin: "27ABCDE1234F1Z5", gstRegistered: true }, customer });
  assert.match(html, /HSN \/ SAC|9985/);
  assert.match(html, /GSTIN:|CGST|SGST|Place of Supply|Maharashtra \(27\)/);
  assert.match(html, /INR/);
  assert.doesNotMatch(html, /TRN:|Item \/ Service Code|LEAD\/2026-27\/0001/);
});

test("Sales app routes order preview to the dedicated renderer and lists quotation reference", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../src/sales/app.js", import.meta.url), "utf8"));
  assert.match(source, /renderSalesOrderDocument/);
  assert.match(source, /data-preview\^="orders:/);
  assert.match(source, /order\?\.quotationId\|\|"—"/);
});
