import test from "node:test";
import assert from "node:assert/strict";
import { XLSX } from "../src/gst/xlsx-shim.js";
import { processMeesho } from "../src/gst/marketplace-meesho.js";
import { processFlipkart } from "../src/gst/marketplace-flipkart.js";
import { processCombined } from "../src/gst/marketplace-combined.js";

// ---------------------------------------------------------------------------
// Test helpers: build a real .xlsx (via the shim's own writer) from a plain
// array of row objects, and wrap it as a minimal browser File-like object
// (name/size/arrayBuffer) for the processing functions to consume.
// ---------------------------------------------------------------------------

function rowsToAoa(rows) {
  const headers = Object.keys(rows[0]);
  return [headers, ...rows.map((row) => headers.map((h) => row[h]))];
}

function buildXlsxBytes(rows, sheetName = "Sheet1") {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rowsToAoa(rows));
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  return XLSX.writeBytes(workbook);
}

function makeFile(name, bytes) {
  return {
    name,
    size: bytes.length,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

function fixtureFile(name, rows, sheetName) {
  return makeFile(name, buildXlsxBytes(rows, sheetName));
}

// ---------------------------------------------------------------------------
// xlsx-shim round-trip
// ---------------------------------------------------------------------------

test("xlsx-shim: write then read back a workbook preserves headers, text and numbers", async () => {
  const rows = [
    { Name: "Widget A", Qty: 3, Price: 199.5 },
    { Name: "Widget B", Qty: 10, Price: 49 },
  ];
  const bytes = buildXlsxBytes(rows, "Data");
  const workbook = await XLSX.readAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.deepEqual(workbook.SheetNames, ["Data"]);
  const parsed = XLSX.utils.sheet_to_json(workbook.Sheets["Data"], { defval: "", raw: true });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].Name, "Widget A");
  assert.equal(parsed[0].Qty, 3);
  assert.equal(parsed[0].Price, 199.5);
  assert.equal(parsed[1].Name, "Widget B");
});

test("xlsx-shim: SSF.parse_date_code converts an Excel serial to the correct calendar date", () => {
  // 46254 = 2026-08-20 (verified against the same 1899-12-30 epoch formula
  // already used elsewhere in this project's gst/app.js isoDate()).
  const parsed = XLSX.SSF.parse_date_code(46254);
  assert.deepEqual(parsed, { y: 2026, m: 8, d: 20 });
});

// ---------------------------------------------------------------------------
// MEESHO
// ---------------------------------------------------------------------------

const MEESHO_SALES_ROWS = [
  { sub_order_num: "S1", order_date: "2026-08-01", hsn_code: "1234", gst_rate: 18, total_taxable_sale_value: 1000, end_customer_state_new: "Tamil Nadu" },
  { sub_order_num: "S2", order_date: "2026-08-02", hsn_code: "1234", gst_rate: 18, total_taxable_sale_value: 500, end_customer_state_new: "Karnataka" },
];
const MEESHO_RETURN_ROWS = [
  { sub_order_num: "S1", cancel_return_date: "2026-08-05", hsn_code: "1234", gst_rate: 18, total_taxable_sale_value: 200, end_customer_state_new: "Tamil Nadu" },
];

test("Meesho: requires both Sales and Return reports", async () => {
  await assert.rejects(
    () => processMeesho({ salesFile: null, returnFile: null, gstin: "33AAAAA0000A1Z5", fp: "082026" }),
    /Meesho Sales Report/
  );
  const salesFile = fixtureFile("sales.xlsx", MEESHO_SALES_ROWS);
  await assert.rejects(
    () => processMeesho({ salesFile, returnFile: null, gstin: "33AAAAA0000A1Z5", fp: "082026" }),
    /Meesho Return Report/
  );
});

test("Meesho only: calculates intra/inter tax split and nets sales against returns correctly", async () => {
  const salesFile = fixtureFile("meesho-sales.xlsx", MEESHO_SALES_ROWS);
  const returnFile = fixtureFile("meesho-returns.xlsx", MEESHO_RETURN_ROWS);

  const result = await processMeesho({ salesFile, returnFile, gstin: "33AAAAA0000A1Z5", fp: "082026" });

  // Row1 (TN, home state by the old logic's own fallback rule) -> intra: base 1000, 18% tax = 180 => 90 CGST + 90 SGST
  // Row2 (Karnataka, not home state) -> inter: base 500, 18% tax = 90 => 90 IGST
  // Return (TN) -> intra: base 200, 18% tax = 36 => 18 CGST + 18 SGST, subtracted
  assert.equal(result.summary.salesTaxable, 1500);
  assert.equal(result.summary.returnTaxable, 200);
  assert.equal(result.summary.netTaxable, 1300);
  assert.equal(result.summary.netIGST, 90);
  assert.equal(result.summary.netCGST, 72);
  assert.equal(result.summary.netSGST, 72);

  assert.equal(result.meta.salesRowCount, 2);
  assert.equal(result.meta.returnRowCount, 1);

  // Excel workbook has the 3 expected portal-ready sheets
  assert.deepEqual(result.workbook.SheetNames, ["B2C Others", "HSN Ready", "ECO Ready"]);

  // GSTR-1 JSON structure
  assert.equal(result.jsonData.gstin, "33AAAAA0000A1Z5");
  assert.equal(result.jsonData.fp, "082026");
  assert.ok(Array.isArray(result.jsonData.b2cs) && result.jsonData.b2cs.length > 0);
  const interEntry = result.jsonData.b2cs.find((e) => e.sply_ty === "INTER");
  const intraEntry = result.jsonData.b2cs.find((e) => e.sply_ty === "INTRA");
  assert.equal(interEntry.iamt, 90);
  assert.equal(intraEntry.camt, 72);
  assert.equal(intraEntry.samt, 72);
  assert.ok(result.jsonData.supeco.clttx.length > 0);
  assert.equal(result.jsonFileName, "GSTR1_33AAAAA0000A1Z5_082026_Meesho.json");
});

test("Meesho: rejects a report missing required columns with a clear message", async () => {
  const badSales = fixtureFile("bad.xlsx", [{ foo: "bar" }]);
  const returnFile = fixtureFile("meesho-returns.xlsx", MEESHO_RETURN_ROWS);
  await assert.rejects(
    () => processMeesho({ salesFile: badSales, returnFile, gstin: "33AAAAA0000A1Z5", fp: "082026" }),
    /Missing columns/
  );
});

test("Meesho: rejects non-.xlsx files", async () => {
  const salesFile = makeFile("sales.csv", new Uint8Array([1, 2, 3]));
  const returnFile = fixtureFile("meesho-returns.xlsx", MEESHO_RETURN_ROWS);
  await assert.rejects(
    () => processMeesho({ salesFile, returnFile, gstin: "33AAAAA0000A1Z5", fp: "082026" }),
    /Only \.xlsx files/
  );
});

// ---------------------------------------------------------------------------
// FLIPKART
// ---------------------------------------------------------------------------

const FLIPKART_BASE_ROW = {
  seller_gstin: "33AAAAA0000A1Z5", order_id: "OID1", order_item_id: "OI1", hsn_code: "1234",
  item_quantity: 2, igst_rate: 18, cgst_rate: 0, sgst_rate_or_utgst_as_applicable: 0,
};

const FLIPKART_ROWS = [
  { ...FLIPKART_BASE_ROW, event_type: "SALE", order_date: "2026-08-01", taxable_value_final_invoice_amount_taxes: 500, igst_amount: 90, cgst_amount: 0, sgst_amount_or_utgst_as_applicable: 0, customer_s_delivery_state: "Karnataka" },
  { ...FLIPKART_BASE_ROW, event_type: "RETURN", order_id: "OID2", order_item_id: "OI2", order_date: "2026-08-03", taxable_value_final_invoice_amount_taxes: 100, igst_rate: 0, igst_amount: 0, cgst_rate: 9, sgst_rate_or_utgst_as_applicable: 9, cgst_amount: 9, sgst_amount_or_utgst_as_applicable: 9, customer_s_delivery_state: "Tamil Nadu" },
];

test("Flipkart only: asks for a single Sales Report and nets SALE against RETURN rows from it", async () => {
  const salesFile = fixtureFile("flipkart-sales.xlsx", FLIPKART_ROWS);
  const result = await processFlipkart({ salesFile, gstin: "33AACCF0683K1CZ", fp: "082026" });

  // SALE: taxable 500, IGST 90. RETURN: taxable -100, CGST -9, SGST -9.
  assert.equal(result.summary.netTaxable, 400);
  assert.equal(result.summary.netIGST, 90);
  assert.equal(result.summary.netCGST, -9);
  assert.equal(result.summary.netSGST, -9);

  assert.equal(result.meta.salesRowCount, 1);
  assert.equal(result.meta.returnRowCount, 1);
  assert.deepEqual(result.workbook.SheetNames, ["B2C Others", "HSN Ready", "ECO Ready"]);
  assert.equal(result.jsonFileName, "GSTR1_33AACCF0683K1CZ_082026_Flipkart.json");
  assert.equal(result.jsonData.supeco.clttx[0].etin, "33AACCF0683K1CZ");
});

test("Flipkart: requires the Sales Report", async () => {
  await assert.rejects(
    () => processFlipkart({ salesFile: null, gstin: "33AACCF0683K1CZ", fp: "082026" }),
    /Flipkart Sales Report/
  );
});

test("Flipkart: rejects a report missing required columns", async () => {
  const badFile = fixtureFile("bad.xlsx", [{ foo: "bar" }]);
  await assert.rejects(() => processFlipkart({ salesFile: badFile, gstin: "33AACCF0683K1CZ", fp: "082026" }), /Missing columns/);
});

// ---------------------------------------------------------------------------
// COMBINED (Meesho Sales + Meesho Return + Flipkart Sales - 3 files, no
// Flipkart return field at all)
// ---------------------------------------------------------------------------

test("Combined: requires exactly Meesho Sales + Meesho Return + Flipkart Sales, no Flipkart return parameter exists", async () => {
  const meeshoSalesFile = fixtureFile("meesho-sales.xlsx", MEESHO_SALES_ROWS);
  const meeshoReturnFile = fixtureFile("meesho-returns.xlsx", MEESHO_RETURN_ROWS);

  await assert.rejects(
    () => processCombined({ meeshoSalesFile: null, meeshoReturnFile: null, flipkartSalesFile: null, gstin: "33AAAAA0000A1Z5", fp: "082026" }),
    /Meesho Sales Report/
  );
  await assert.rejects(
    () => processCombined({ meeshoSalesFile, meeshoReturnFile, flipkartSalesFile: null, gstin: "33AAAAA0000A1Z5", fp: "082026" }),
    /Flipkart Sales Report/
  );
});

test("Combined: merges Meesho (sales+return) and Flipkart (sales only) into one summary using the old combined-gstr1 logic", async () => {
  const meeshoSalesFile = fixtureFile("meesho-sales.xlsx", MEESHO_SALES_ROWS);
  const meeshoReturnFile = fixtureFile("meesho-returns.xlsx", MEESHO_RETURN_ROWS);
  const flipkartSalesFile = fixtureFile("flipkart-sales.xlsx", FLIPKART_ROWS);

  const result = await processCombined({ meeshoSalesFile, meeshoReturnFile, flipkartSalesFile, gstin: "33AAAAA0000A1Z5", fp: "082026" });

  // Meesho net taxable 1300 (see meesho-only test) + Flipkart net taxable 400 (see flipkart-only test) = 1700
  assert.equal(result.summary.netTaxable, 1300 + 400);
  assert.equal(result.summary.netIGST, 90 + 90);
  assert.equal(result.summary.netCGST, 72 + -9);
  assert.equal(result.summary.netSGST, 72 + -9);

  assert.equal(result.meta.meeshoSalesCount, 2);
  assert.equal(result.meta.meeshoReturnCount, 1);
  assert.equal(result.meta.flipkartSalesCount, 1);
  assert.equal(result.meta.flipkartReturnCount, 1);

  // Combined workbook has the extra Marketplace Summary sheet the single-marketplace tools don't produce
  assert.deepEqual(result.workbook.SheetNames, ["B2C Others", "HSN Ready", "ECO Ready", "Marketplace Summary"]);

  assert.equal(result.jsonFileName, "GSTR1_returns_33AAAAA0000A1Z5_monthly_082026.json");
  // Two distinct ECO GSTINs (Meesho default + Flipkart TN operator) should both be present
  const ecoGstins = result.jsonData.supeco.clttx.map((e) => e.etin).sort();
  assert.deepEqual(ecoGstins, ["33AACCF0683K1CZ", "33AARCM9332R1CV"].sort());
});

test("Combined: rejects the same file selected twice across upload fields", async () => {
  const sharedFile = fixtureFile("shared.xlsx", MEESHO_SALES_ROWS);
  await assert.rejects(
    () => processCombined({ meeshoSalesFile: sharedFile, meeshoReturnFile: sharedFile, flipkartSalesFile: fixtureFile("flipkart-sales.xlsx", FLIPKART_ROWS), gstin: "33AAAAA0000A1Z5", fp: "082026" }),
    /more than one upload field/
  );
});

// ---------------------------------------------------------------------------
// Wholesale (existing business type) must be entirely unaffected - this is
// a structural smoke check that the marketplace modules don't touch
// anything shared with the existing GST core logic.
// ---------------------------------------------------------------------------

test("existing GST core module (Wholesale / general businesses) is untouched by the new marketplace modules", async () => {
  const core = await import("../src/gst/core.js");
  assert.equal(typeof core.checklist, "function");
  assert.equal(typeof core.validateRow, "function");
  assert.equal(typeof core.summaries, "function");
  const wholesaleChecklist = core.checklist({ businessType: "Wholesale", hasB2c: true });
  assert.ok(wholesaleChecklist.some((item) => item.key === "b2c"));
});
