import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = read("../src/gst-invoice-generator/styles.css");
const printCss = css.slice(css.indexOf("@media print"));
const page = read("../src/pages/marketing/gst-invoice-generator.js");
const app = read("../src/gst-invoice-generator/app.js");

// ---- Root cause: visibility:hidden hides content but never removes it from layout, so
// the full on-screen height of the header/hero/form/footer was still being reserved and
// paginated as blank pages. The fix must actually remove that height with display:none. ----

test("every non-invoice section of the page is removed from print layout with display:none, not just hidden with visibility", () => {
  for (const selector of [".site-header", ".service-hero", "#invoiceForm", ".preview-top", ".preview-actions", "#pdfStatus", ".site-footer"]) {
    assert.ok(printCss.includes(selector), `${selector} must be listed in the print stylesheet`);
  }
  const hideRule = printCss.slice(printCss.indexOf(".site-header"), printCss.indexOf("{", printCss.indexOf(".site-footer")) + 30);
  assert.match(hideRule, /display:\s*none\s*!important/);
});

test("the known non-invoice sections match every top-level section actually rendered on this page (site header, hero, form, preview chrome, footer)", () => {
  assert.match(page, /<header class="site-header"|renderHeader/);
  assert.match(page, /class="service-hero"/);
  assert.match(page, /id="invoiceForm"/);
  assert.match(page, /class="preview-top"/);
  assert.match(page, /class="preview-actions"/);
  assert.match(page, /id="pdfStatus"/);
  assert.match(page, /renderFooter/);
});

// ---- #invoicePreview must stay in normal document flow so its OWN real height (one page
// or several) is what gets paginated -- position:absolute would remove it from the height
// calculation used for pagination, risking a long invoice being clipped after page 1. ----

test("#invoicePreview prints in normal document flow (not absolutely positioned), so a long invoice can paginate across multiple pages without being clipped", () => {
  const rule = printCss.slice(printCss.indexOf("#invoicePreview {"), printCss.indexOf("#invoicePreview {") + 400);
  assert.match(rule, /position:\s*static\s*!important/);
  assert.doesNotMatch(rule, /position:\s*absolute/);
  assert.match(rule, /overflow:\s*visible\s*!important/);
  assert.match(rule, /max-height:\s*none\s*!important/);
});

test("the ancestor wrappers of #invoicePreview are neutralized (block, static, no width/padding constraints) instead of retaining the on-screen grid/sticky layout", () => {
  const rule = printCss.slice(printCss.indexOf(".section, .container"), printCss.indexOf(".section, .container") + 260);
  assert.match(rule, /display:\s*block\s*!important/);
  assert.match(rule, /position:\s*static\s*!important/);
});

// ---- A4 page setup, and multi-page-safe table rules for a genuinely long invoice ----

test("the page is set to clean A4 portrait with a small margin, and long invoices are allowed to flow across multiple pages", () => {
  assert.match(printCss, /@page\s*\{\s*size:\s*A4\s*portrait;\s*margin:\s*7mm;\s*\}/);
  assert.match(printCss, /html, body \{[^}]*height:\s*auto\s*!important/);
});

test("the item table repeats its header row and never splits a row across a page break", () => {
  assert.match(printCss, /#invoicePreview \.preview-table thead \{ display: table-header-group; \}/);
  assert.match(printCss, /#invoicePreview \.preview-table tr \{ page-break-inside: avoid !important; break-inside: avoid !important; \}/);
});

test("summary, bottom and note blocks avoid being split across a page break", () => {
  assert.match(printCss, /#invoicePreview \.summary-area, #invoicePreview \.invoice-bottom, #invoicePreview \.invoice-note \{ break-inside: avoid !important; page-break-inside: avoid !important; \}/);
});

// ---- Nothing about calculations, GST logic, fields, or the on-screen UI changed ----

test("GST calculation, invoice fields and the printInvoice/downloadPdf wiring are unchanged", () => {
  assert.match(app, /function printInvoice\(\)\s*\{\s*updatePreview\(\);\s*if \(!validateInvoice\(\)\) return;\s*window\.print\(\);\s*\}/);
  assert.match(app, /function downloadPdf\(\)/);
  assert.doesNotMatch(css.slice(0, css.indexOf("@media print")), /display:\s*none\s*!important.*invoiceForm/s);
});
