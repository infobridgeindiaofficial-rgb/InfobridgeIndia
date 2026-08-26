import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canDeleteProduct, findDuplicateSku, normalizeSku, prepareProduct, productUsageReasons } from "../src/inventory/core.js";

const app = readFileSync(new URL("../src/inventory/app.js", import.meta.url), "utf8");
const productsFnSource = (name) => app.slice(app.indexOf(`function ${name}(`), app.indexOf("\n}", app.indexOf(`function ${name}(`)) + 2);

// ---- SKU uniqueness (core/data layer) ----

test("normalizeSku trims whitespace and lower-cases for comparison", () => {
  assert.equal(normalizeSku(" A4-PAPER-001 "), "a4-paper-001");
  assert.equal(normalizeSku("A4-PAPER-001"), normalizeSku("a4-paper-001"));
  assert.equal(normalizeSku("A4-PAPER-001"), normalizeSku(" A4-PAPER-001 "));
});

test("prepareProduct rejects an exact duplicate SKU with the required message", () => {
  const products = [{ id: "PRD-1", sku: "A4-PAPER-001", name: "A4 Paper" }];
  assert.throws(() => prepareProduct(products, { name: "A4 Paper Ream", sku: "A4-PAPER-001" }), /A product with this SKU already exists\./);
});

test("prepareProduct rejects a duplicate SKU that only differs by case", () => {
  const products = [{ id: "PRD-1", sku: "A4-PAPER-001", name: "A4 Paper" }];
  assert.throws(() => prepareProduct(products, { name: "A4 Paper Ream", sku: "a4-paper-001" }), /A product with this SKU already exists\./);
});

test("prepareProduct rejects a duplicate SKU that only differs by surrounding whitespace", () => {
  const products = [{ id: "PRD-1", sku: "A4-PAPER-001", name: "A4 Paper" }];
  assert.throws(() => prepareProduct(products, { name: "A4 Paper Ream", sku: " A4-PAPER-001 " }), /A product with this SKU already exists\./);
  assert.throws(() => prepareProduct([{ id: "PRD-1", sku: " A4-PAPER-001 ", name: "A4 Paper" }], { name: "New", sku: "A4-PAPER-001" }), /A product with this SKU already exists\./);
});

test("prepareProduct lets editing the original product keep its own SKU without a false self-conflict", () => {
  const existing = { id: "PRD-1", sku: "A4-PAPER-001", name: "A4 Paper", createdAt: "2026-01-01T00:00:00.000Z" };
  const products = [existing];
  const result = prepareProduct(products, { name: "A4 Paper (Updated)", sku: "A4-PAPER-001" }, existing);
  assert.equal(result.id, "PRD-1");
  assert.equal(result.sku, "A4-PAPER-001");
  assert.equal(result.name, "A4 Paper (Updated)");
  assert.equal(result.createdAt, "2026-01-01T00:00:00.000Z");
});

test("prepareProduct still blocks a duplicate against an archived (inactive) product with the same SKU", () => {
  const products = [{ id: "PRD-1", sku: "A4-PAPER-001", name: "A4 Paper", active: false }];
  assert.throws(() => prepareProduct(products, { name: "New A4 Paper", sku: "A4-PAPER-001" }), /A product with this SKU already exists\./);
});

test("company A's SKU does not incorrectly block the same SKU being used in company B (products arrays are independent per company)", () => {
  const companyAProducts = [{ id: "PRD-A1", sku: "A4-PAPER-001", name: "A4 Paper" }];
  const companyBProducts = [];
  assert.equal(findDuplicateSku(companyAProducts, "A4-PAPER-001"), companyAProducts[0]);
  assert.equal(findDuplicateSku(companyBProducts, "A4-PAPER-001"), null);
  const result = prepareProduct(companyBProducts, { name: "A4 Paper", sku: "A4-PAPER-001" });
  assert.equal(result.sku, "A4-PAPER-001");
});

test("data layer defense-in-depth: a second save that re-reads the freshest product list after the first save persisted rejects the duplicate, closing the rapid-click race even if a UI guard were bypassed", () => {
  let persisted = [];
  const put = (p) => { persisted = [...persisted.filter((x) => x.id !== p.id), p]; return p; };
  const first = prepareProduct(persisted, { name: "A4 Paper", sku: "A4-PAPER-001" });
  put(first);
  assert.throws(() => prepareProduct(persisted, { name: "A4 Paper", sku: "A4-PAPER-001" }), /A product with this SKU already exists\./);
  assert.equal(persisted.length, 1, "only one product should ever be persisted for the same SKU");
});

// ---- Delete / Archive eligibility (core/data layer) ----

test("an unused, zero-stock product with no history can be deleted", () => {
  assert.equal(canDeleteProduct("PRD-1", [], {}), true);
  assert.deepEqual(productUsageReasons("PRD-1", [], {}), []);
});

test("a product with any stock movement (even if it later nets to zero stock) cannot be deleted", () => {
  const movements = [
    { productId: "PRD-1", type: "opening", quantity: 10 },
    { productId: "PRD-1", type: "stock-out", quantity: 10 },
  ];
  assert.equal(canDeleteProduct("PRD-1", movements, {}), false);
  assert.deepEqual(productUsageReasons("PRD-1", movements, {}), ["Stock movement history"]);
});

test("a product currently holding stock cannot be deleted", () => {
  const movements = [{ productId: "PRD-1", type: "opening", quantity: 5 }];
  assert.equal(canDeleteProduct("PRD-1", movements, {}), false);
});

test("a product referenced by a Purchase Order cannot be deleted, and the reason is reported", () => {
  const cross = { purchaseOrders: [{ id: "PO-1", items: [{ productId: "PRD-1" }] }] };
  assert.equal(canDeleteProduct("PRD-1", [], cross), false);
  assert.deepEqual(productUsageReasons("PRD-1", [], cross), ["Purchase Order"]);
});

test("a product referenced anywhere across Purchase Request/RFQ/Quotation/PO/GRN/Bill/Return or Sales Quotation/Order/Invoice/Return cannot be deleted", () => {
  const refs = {
    purchaseRequests: "Purchase Request", rfqs: "RFQ", purchaseQuotations: "Supplier Quotation",
    purchaseOrders: "Purchase Order", grns: "GRN", purchaseBills: "Purchase Bill", purchaseReturns: "Purchase Return",
    salesQuotations: "Sales Quotation", salesOrders: "Sales Order", salesInvoices: "Sales Invoice", salesReturns: "Sales Return",
  };
  for (const [key, label] of Object.entries(refs)) {
    const cross = { [key]: [{ id: "DOC-1", items: [{ productId: "PRD-1" }] }] };
    assert.equal(canDeleteProduct("PRD-1", [], cross), false, `${key} should block deletion`);
    assert.deepEqual(productUsageReasons("PRD-1", [], cross), [label], `${key} should report "${label}"`);
  }
});

test("a referenced product is unaffected in unrelated documents (no false positive)", () => {
  const cross = { purchaseOrders: [{ id: "PO-1", items: [{ productId: "PRD-OTHER" }] }] };
  assert.equal(canDeleteProduct("PRD-1", [], cross), true);
});

// ---- UI wiring: duplicate-submit guard ----

test("openModal disables the submit button and shows a Saving state before awaiting onSubmit, and only re-enables on failure", () => {
  const src = productsFnSource("openModal");
  assert.match(src, /let saving=false/);
  assert.match(src, /if\(saving\) return/);
  assert.match(src, /saving=true;\s*submitButton\.disabled=true;\s*submitButton\.textContent="Saving\.\.\."/);
  assert.match(src, /catch\(error\)\{toast\(error\.message,"error"\);saving=false;submitButton\.disabled=false;submitButton\.textContent=submitLabel\}/);
  assert.doesNotMatch(src, /modalRoot\.innerHTML="";saving=false/, "success path must not re-enable a button on a modal that has already been removed");
});

test("saveProduct validates against a freshly-fetched product list (not the possibly-stale in-memory state) before persisting", () => {
  assert.match(app, /const freshProducts=await all\("products"\);/);
  assert.match(app, /const data=prepareProduct\(freshProducts,candidate,existing\);/);
});

// ---- UI wiring: Delete / Archive / Restore ----

test("Product Master offers Delete, Archive and Restore actions in addition to View and Edit", () => {
  assert.match(app, /data-view-product="\$\{p\.id\}"/);
  assert.match(app, /data-edit-product="\$\{p\.id\}"/);
  assert.match(app, /data-archive-product="\$\{p\.id\}"/);
  assert.match(app, /data-restore-product="\$\{p\.id\}"/);
  assert.match(app, /data-delete-product="\$\{p\.id\}"/);
});

test("confirmModal is a custom modal, never the browser confirm()/alert() dialog, for delete/archive/restore", () => {
  const src = productsFnSource("confirmModal");
  assert.match(src, /modal-backdrop/);
  assert.doesNotMatch(src, /\bconfirm\(/);
  assert.doesNotMatch(src, /\balert\(/);
  assert.match(app, /function deleteProductAction\(p\)\{/);
  assert.doesNotMatch(productsFnSource("deleteProductAction").replace(/async /, ""), /\bconfirm\(|\balert\(/);
});

test("deleteProductAction checks cross-module usage and only offers permanent delete when nothing references the product", () => {
  const src = app.slice(app.indexOf("async function deleteProductAction"), app.indexOf("\n}", app.indexOf("async function deleteProductAction")) + 2);
  assert.match(src, /productUsageFor\(p\.id\)/);
  assert.match(src, /Delete product permanently\?/);
  assert.match(src, /Delete Permanently/);
  assert.match(src, /remove\("products",p\.id\)/);
});

test("deleteProductAction offers Archive instead when the product has history, or when history could not be verified", () => {
  const src = app.slice(app.indexOf("async function deleteProductAction"), app.indexOf("\n}", app.indexOf("async function deleteProductAction")) + 2);
  assert.match(src, /usage\.length/);
  assert.match(src, /Archive Instead/);
  assert.match(src, /usage===null/, "an unverifiable history check must fail safe (block delete) rather than silently allow it");
});

test("archiveProductAction and restoreProductAction toggle the existing active flag rather than creating a second storage mechanism", () => {
  assert.match(app, /function archivePayload\(p,active\)\{return \{\.\.\.p,active,archivedAt:active\?null:new Date\(\)\.toISOString\(\),updatedAt:new Date\(\)\.toISOString\(\)\}\}/);
  assert.match(app, /archiveProductAction\(p\)\{confirmModal\("Archive this product\?"/);
  assert.match(app, /restoreProductAction\(p\)\{confirmModal\("Restore this product\?"/);
  assert.match(app, /await put\("products",archivePayload\(p,false\)\)/);
  assert.match(app, /await put\("products",archivePayload\(p,true\)\)/);
});

// ---- Archived visibility rules ----

test("Product Master (filteredProducts) keeps archived products visible instead of hiding them", () => {
  const src = productsFnSource("filteredProducts");
  assert.doesNotMatch(src, /p\.active\s*!==\s*false\s*&&/, "archived products must remain listed, not be filtered out of Product Master");
});

test("the product table marks an archived product with an Archived badge", () => {
  assert.match(app, /p\.active===false\?'<span class="badge neutral">Archived<\/span>'/);
});

test("archived products remain excluded from new-transaction product selectors (movements, transfers, adjustments, counts)", () => {
  assert.match(app, /function selectProducts\(\) \{ return state\.products\.filter\(p=>p\.active!==false\)/);
});

// ---- Existing duplicate data handling ----

test("reload() never inspects or de-duplicates products by SKU; existing duplicate SKU records are preserved as-is on load", () => {
  const src = app.slice(app.indexOf("async function reload"), app.indexOf("\n}", app.indexOf("async function reload")) + 2);
  assert.doesNotMatch(src, /sku/i);
});

test("no automatic startup/setup path removes product records; only the explicit user-triggered actions do", () => {
  const setupSrc = app.slice(app.indexOf("async function createSetup"), app.indexOf("\n}", app.indexOf("async function createSetup")) + 2);
  assert.doesNotMatch(setupSrc, /remove\("products"/);
  assert.doesNotMatch(setupSrc, /clear\("products"/);
});
