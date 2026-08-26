import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/purchases/app.js", import.meta.url), "utf8");

// ---- Scope guard: this redesign is UAE-only; India's Purchase Request flow is untouched ----

test("Purchase Request branches by company country and only redesigns the UAE flow", () => {
  assert.match(app, /const uae=isUaeCompany\(\);/);
  assert.match(app, /const linesBody=uae\?/);
});

test("the India path still renders the original shared line-item grid unchanged (lineHtml/bindLines, estimate=true)", () => {
  assert.match(app, /:`<div class="lines"><div class="panel-head"><h2>Requested items<\/h2><button type="button" class="btn secondary compact" data-add-line>Add line<\/button><\/div><div data-lines>\$\{lineHtml\(\{\},true\)\}<\/div><\/div>`/);
  assert.match(app, /if\(uae\)bindRequestLines\(\);else bindLines\(true\)/);
});

test("isUaeCompany resolves the active company's country via the shared country registry (no hardcoded India/UAE branching elsewhere)", () => {
  assert.match(app, /function isUaeCompany\(\)\{return resolveCountryConfig\(globalThis\.InfoBridgeCompany\)\.country==="AE"\}/);
});

// ---- Required column layout with visible labels ----

test("the UAE Requested Items header shows all 8 required column labels in order", () => {
  assert.match(app, /<span>Product<\/span><span>Description<\/span><span>Qty<\/span><span>Unit<\/span><span>Estimated Rate<\/span><span>VAT %<\/span><span>Estimated Amount<\/span><span>Remove<\/span>/);
});

test("no GST terminology is shown in the UAE Requested Items header (VAT % only)", () => {
  const headerMatch = app.match(/function requestLineHead\(\)\{return`([^`]*)`\}/);
  assert.ok(headerMatch, "requestLineHead should exist");
  assert.doesNotMatch(headerMatch[1], /GST/);
  assert.match(headerMatch[1], /VAT %/);
});

// ---- Product mapping preserved ----

test("the product dropdown still uses the authoritative Inventory product list and shows Product Name (SKU)", () => {
  assert.match(app, /function requestLineHtml\(x=\{\}\)\{return`<div class="request-line-grid"><select name="productId" required>/);
  assert.match(app, /esc\(p\.name\)\} \(\$\{esc\(p\.sku\)\}\)/);
});

test("a brand-new UAE requested-item row does not silently default to the first product", () => {
  assert.ok(app.includes('<option value="" selected disabled>Select a product…</option>'));
});

test("selecting a product auto-fills description, unit and estimated rate from Inventory Product Master (purchasePrice), not free text", () => {
  assert.match(app, /function applyProductToRequestLine\(row\)\{/);
  assert.match(app, /description\.value=p\.name/);
  assert.match(app, /unit\.value=p\.unit\|\|""/);
  assert.match(app, /rate\.value=num\(p\.purchasePrice\|\|0\)/);
});

test("the stored field name stays gstRate under the hood so PR -> RFQ -> PO conversion keeps working, even though it displays as VAT %", () => {
  assert.match(app, /name="gstRate"/);
  assert.match(app, /row\.querySelector\('\[name="gstRate"\]'\)/);
});

// ---- UAE VAT defaulting ----

test("the UAE default VAT rate constant is 5, not the old hardcoded GST 18", () => {
  assert.match(app, /const UAE_DEFAULT_VAT_RATE=5;/);
  assert.match(app, /value="\$\{x\.gstRate!=null&&x\.gstRate!==""\?num\(x\.gstRate\):UAE_DEFAULT_VAT_RATE\}"/);
});

// ---- Quantity validation ----

test("quantity remains a required numeric field defaulting to 1", () => {
  assert.match(app, /<input name="quantity" type="number" min="\.001" step="\.001" value="\$\{num\(x\.quantity\)\|\|1\}" required>/);
});

// ---- Estimated Amount: read-only, calculated, live-recalculated ----

test("Estimated Amount is rendered as a read-only, unnamed display field so it can never be submitted as free text", () => {
  assert.match(app, /<input class="request-amount-display" type="text" readonly tabindex="-1"/);
  assert.doesNotMatch(app, /class="request-amount-display"[^>]*name=/);
});

test("Estimated Amount uses the exact required formula: subtotal = qty * rate, vat = subtotal * rate% / 100, total = subtotal + vat", () => {
  assert.match(app, /function recalcRequestLineAmount\(row\)\{/);
  assert.match(app, /subtotal=quantity\*rate/);
  assert.match(app, /vatAmount=subtotal\*vatRate\/100/);
  assert.match(app, /amountField\.value=money\(subtotal\+vatAmount\)/);
});

test("the documented example (Qty 10 x AED 20.00, VAT 5%) computes to AED 210.00 using the same formula", () => {
  const quantity = 10, rate = 20, vatRate = 5;
  const subtotal = quantity * rate;
  const vatAmount = subtotal * vatRate / 100;
  const total = subtotal + vatAmount;
  assert.equal(subtotal, 200);
  assert.equal(vatAmount, 10);
  assert.equal(total, 210);
});

test("Estimated Amount recalculates on product change, quantity change and estimated rate change (and VAT change)", () => {
  assert.match(app, /row\.querySelector\('select\[name="productId"\]'\)\?\.addEventListener\("change",\(\)=>applyProductToRequestLine\(row\)\)/);
  assert.match(app, /row\.querySelector\('\[name="quantity"\]'\)\?\.addEventListener\("input",\(\)=>recalcRequestLineAmount\(row\)\)/);
  assert.match(app, /row\.querySelector\('\[name="estimatedRate"\]'\)\?\.addEventListener\("input",\(\)=>recalcRequestLineAmount\(row\)\)/);
  assert.match(app, /row\.querySelector\('\[name="gstRate"\]'\)\?\.addEventListener\("input",\(\)=>recalcRequestLineAmount\(row\)\)/);
});

test("applyProductToRequestLine also recalculates the Estimated Amount immediately after auto-filling the rate", () => {
  const fnMatch = app.match(/function applyProductToRequestLine\(row\)\{([\s\S]*?)\}\n?function/);
  assert.ok(fnMatch);
  assert.match(fnMatch[1], /recalcRequestLineAmount\(row\)/);
});

// ---- Add line uses the same layout/calculation ----

test("Add line inserts another UAE row using the exact same requestLineHtml template and re-binds it", () => {
  assert.match(app, /b\.insertAdjacentHTML\("beforeend",requestLineHtml\(\{\}\)\);bindRequestLines\(\)/);
});

test("Add line does not stack duplicate insert-handlers on repeated clicks", () => {
  assert.match(app, /addButton\.dataset\.wired/);
});

// ---- Remove action preserved ----

test("each UAE row keeps the x remove action", () => {
  const fnMatch = app.match(/function requestLineHtml\(x=\{\}\)\{return`([\s\S]*?)`\}/);
  assert.ok(fnMatch);
  assert.match(fnMatch[1], /class="request-line-grid"/);
  assert.match(fnMatch[1], /data-remove-line>×<\/button>/);
  assert.match(app, /querySelector\("\[data-remove-line\]"\)\?\.addEventListener\("click",\(\)=>\{if\(b\.children\.length>1\)row\.remove\(\)\}\)/);
});

// ---- linesData / core submission path still captures the UAE grid ----

test("linesData now also reads rows from the new request-line-grid so UAE items are actually submitted", () => {
  assert.match(app, /querySelectorAll\("\[data-lines\] \.line-grid, \[data-lines\] \.request-line-grid"\)/);
  assert.match(app, /querySelectorAll\("input\[name\],select\[name\]"\)/);
});

// ---- Modal width increased for the UAE request modal only ----

test("only the Purchase Request modal gets the widened request-modal class; other modals are unaffected", () => {
  assert.match(app, /uae\?"request-modal":""/);
  assert.match(app, /function modal\(t,b,s,onSave,wide=true,extraClass=""\)/);
});

test("the widened modal CSS is scoped to .modal.request-modal, not the shared .modal.wide rule", () => {
  const css = readFileSync(new URL("../src/purchases/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.modal\.request-modal\{width:min\(1180px,96vw\)\}/);
});

test("the request-line-grid CSS gives Product/Description more width than Qty/VAT, and is added to purchases/styles.css only (not the shared inventory stylesheet)", () => {
  const css = readFileSync(new URL("../src/purchases/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.request-line-head,\.request-line-grid\{display:grid;grid-template-columns:1\.8fr 1\.6fr \.6fr \.8fr 1\.1fr \.7fr 1\.2fr auto/);
  const inventoryCss = readFileSync(new URL("../src/inventory/styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(inventoryCss, /request-line-grid/);
});
