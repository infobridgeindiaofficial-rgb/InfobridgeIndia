import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialState, saveSupplier, saveRequest, submitRequest, decideApproval, createRfqFromRequest, recordQuotation, selectQuotation, orderFromQuotation, createGrn, markGrnInventoryPosted, createBill } from "../src/purchases/core.js";
import { createMovement } from "../src/inventory/core.js";

const app = readFileSync(new URL("../src/purchases/app.js", import.meta.url), "utf8");

// ---- Root cause: lineHtml no longer fabricates "Unknown item" / default Nos / 0 for an unselected line ----

test("lineHtml no longer defaults description to nameProd(undefined) (the 'Unknown item' root cause)", () => {
  assert.doesNotMatch(app, /x\.description\|\|nameProd\(x\.productId\)/);
});

test("a brand-new requested-item row starts with an explicit unselected placeholder instead of silently defaulting to the first product", () => {
  assert.ok(app.includes('<option value="" selected disabled>Select a product…</option>'), "expected an explicit unselected placeholder option for a new line");
  assert.match(app, /\$\{x\.productId\?"":'<option value="" selected disabled>Select a product…<\/option>'\}/);
});

test("the product dropdown shows the product's SKU alongside its name so the correct catalogue item can be identified", () => {
  assert.match(app, /esc\(p\.name\)\} \(\$\{esc\(p\.sku\)\}\)/);
});

test("selecting a product populates description, unit and rate from the authoritative Inventory Product Master record", () => {
  assert.match(app, /function applyProductToLine\(row,estimate\)\{/);
  assert.match(app, /description\.value=p\.name/);
  assert.match(app, /unit\.value=p\.unit\|\|""/);
  assert.match(app, /rate\.value=num\(p\.purchasePrice\|\|0\)/);
});

test("the product select is wired with a change listener so re-selecting a product re-syncs the row (root fix, not a per-screen hack)", () => {
  assert.match(app, /addEventListener\("change",\(\)=>applyProductToLine\(row,estimate\)\)/);
});

test("there is exactly one shared lineHtml/applyProductToLine/bindLines implementation reused by every purchasing screen, not a separate hack per screen", () => {
  assert.equal((app.match(/function lineHtml\(/g) || []).length, 1);
  assert.equal((app.match(/function applyProductToLine\(/g) || []).length, 1);
  assert.equal((app.match(/function bindLines\(/g) || []).length, 1);
});

test("RFQ response, Purchase Order and Purchase Bill forms all call the shared bindLines (they inherit the fix automatically)", () => {
  assert.match(app, /function responseModal\([^)]*\)\{[\s\S]*?bindLines\(\)/);
  assert.match(app, /function orderModal\([^)]*\)\{[\s\S]*?bindLines\(\)/);
  assert.match(app, /function billModal\([^)]*\)\{[\s\S]*?bindLines\(\)/);
  assert.match(app, /function requestModal\(\)\{[\s\S]*?bindLines\(true\)/);
});

test("Add line no longer stacks a duplicate insert-handler on repeated clicks (incidental fix uncovered while repairing bindLines)", () => {
  assert.match(app, /row\.dataset\.wired/);
  assert.match(app, /addButton\.dataset\.wired/);
});

test("Purchases never creates its own product master; the product dropdown is always sourced from the shared Inventory product list", () => {
  assert.doesNotMatch(app, /state\.products/);
  assert.equal(Object.prototype.hasOwnProperty.call(initialState(), "products"), false, "Purchases core state must not own a separate product collection");
});

// ---- Global header / dashboard quick-action cleanup ----

test("the global Purchases header no longer shows 'New Request' / 'Create PO' buttons", () => {
  assert.doesNotMatch(app, /top-actions/);
  assert.doesNotMatch(app, /data-new="request">New Request</);
  assert.doesNotMatch(app, /data-new="order">\$\{icon\("plus"\)\} Create PO</);
});

test("the Purchases Dashboard quick-action panel has been removed", () => {
  assert.doesNotMatch(app, /quick-card/);
  assert.doesNotMatch(app, /Daily actions/);
  assert.doesNotMatch(app, /Every stage preserves supplier, item, tax, warehouse, and source references\./);
});

test("Purchase Requests page still has its own page-specific New Purchase Request action", () => {
  assert.match(app, /data-new="request">New Purchase Request</);
});

test("Purchase Orders page still has its own page-specific Create Purchase Order action", () => {
  assert.match(app, /data-new="order">Create Purchase Order</);
});

test("the underlying [data-new] dispatcher used by page-specific buttons is still wired for every workflow stage", () => {
  assert.match(app, /\{supplier:supplierModal,request:requestModal,rfq:rfqModal,order:orderModal,grn:grnModal,bill:billModal,payment:paymentModal,return:returnModal\}/);
});

// ---- Downstream product identity: PR -> RFQ -> Quotation -> PO -> GRN -> Bill ----

test("the stable Inventory productId is preserved unchanged through PR -> RFQ -> Quotation -> PO -> GRN -> Bill", () => {
  const product = { id: "PRD-A4-001", name: "A4 Copy Paper", unit: "Pack" };
  const warehouse = { id: "WH-1", name: "Main" };
  let s = initialState();
  let r = saveSupplier(s, { type: "Business", name: "Paper Supplier", mobile: "9876500000", gstin: "33AAAAA0000A1Z5", stateCode: "33", active: true });
  s = r.state; const supplier = r.record;

  r = saveRequest(s, { date: "2026-08-19", requestedBy: "Buyer", department: "Operations", warehouseId: warehouse.id, requiredBy: "2026-08-25", priority: "High", status: "Draft", items: [{ productId: product.id, description: product.name, quantity: 10, unit: product.unit, estimatedRate: 20, gstRate: 18 }] });
  s = r.state; const request = r.record;
  assert.equal(request.items[0].productId, product.id);

  s = submitRequest(s, request.id);
  s = decideApproval(s, s.approvals[0].id, "Approved");

  r = createRfqFromRequest(s, request.id, { date: "2026-08-19", closingDate: "2026-08-20", requiredDeliveryDate: "2026-08-25", supplierIds: [supplier.id] });
  s = r.state; const rfq = r.record;
  assert.equal(rfq.items[0].productId, product.id);

  r = recordQuotation(s, rfq.id, { supplierId: supplier.id, supplierQuotationNumber: "Q-1", date: "2026-08-19", validUntil: "2026-08-30", freight: 0, otherCharges: 0, items: [{ productId: product.id, description: product.name, quantity: 10, unit: product.unit, rate: 20, discount: 0, gstRate: 18 }] });
  s = r.state; const quotation = r.record;
  assert.equal(quotation.items[0].productId, product.id);

  s = selectQuotation(s, quotation.id, "Only response received");
  r = orderFromQuotation(s, quotation.id, { warehouseId: warehouse.id, expectedDeliveryDate: "2026-08-25" });
  s = r.state; const order = r.record;
  assert.equal(order.items[0].productId, product.id);

  r = createGrn(s, { orderId: order.id, date: "2026-08-22", warehouseId: warehouse.id, receivedBy: "Store", items: [{ productId: product.id, receivedQuantity: 10, acceptedQuantity: 10, damagedQuantity: 0, rejectedQuantity: 0 }] });
  s = r.state; const grn = r.record;
  assert.equal(grn.items[0].productId, product.id);
  const movement = createMovement({ type: "purchase-receipt", productId: product.id, warehouseId: warehouse.id, quantity: 10, reference: grn.id }, [], {});
  s = markGrnInventoryPosted(s, grn.id, [movement.id]);

  r = createBill(s, { supplierId: supplier.id, supplierInvoiceNumber: "INV-1", invoiceDate: "2026-08-22", postingDate: "2026-08-22", dueDate: "2026-09-22", orderId: order.id, grnId: grn.id, placeOfSupply: "33", items: [{ productId: product.id, description: product.name, quantity: 10, unit: product.unit, rate: 20, discount: 0, gstRate: 18 }] });
  const bill = r.record;
  assert.equal(bill.items[0].productId, product.id);

  const ids = [request.items[0].productId, rfq.items[0].productId, quotation.items[0].productId, order.items[0].productId, grn.items[0].productId, bill.items[0].productId];
  assert.ok(ids.every((id) => id === product.id), "productId must remain identical end-to-end across the purchasing workflow");
});
