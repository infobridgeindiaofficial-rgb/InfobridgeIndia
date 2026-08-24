import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseDocx, renderDocumentHtml, convertDocxToHtml } from "../src/word-to-pdf/core.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REFERENCE_PATH = join(__dirname, "..", "reference-files", "sample-word-document.docx");

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
function loadReferenceBuffer() {
  return toArrayBuffer(readFileSync(REFERENCE_PATH));
}

// ---------------------------------------------------------------------------
// Minimal ZIP writer (store method only) for synthetic .docx test fixtures.
// ---------------------------------------------------------------------------

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true); // method 0 = store
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x21, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length + data.length;
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const c of centralParts) centralSize += c.length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of [...localParts, ...centralParts, eocd]) { out.set(part, p); p += part.length; }
  return out;
}

function docPart(bodyXml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${bodyXml}</w:body></w:document>`;
}

function buildDocxFromBody(bodyXml, { extraFiles = [] } = {}) {
  const enc = new TextEncoder();
  const files = [
    { name: "word/document.xml", data: enc.encode(docPart(bodyXml)) },
    ...extraFiles,
  ];
  return toArrayBuffer(Buffer.from(buildStoredZip(files)));
}

// ---------------------------------------------------------------------------
// PRIMARY ACCEPTANCE TEST: the real reference document
// ---------------------------------------------------------------------------

test("reference DOCX: parses without throwing and has no warnings", async () => {
  const parsed = await parseDocx(loadReferenceBuffer());
  assert.equal(parsed.warnings.length, 0, parsed.warnings.join("; "));
  assert.ok(parsed.blocks.length > 10, "expected a substantial number of blocks");
});

test("reference DOCX: main title and subtitle text are present with correct formatting", async () => {
  const parsed = await parseDocx(loadReferenceBuffer());
  const allText = (b) => (b.type === "paragraph" ? b.inlines.filter((i) => i.type === "text").map((i) => i.text).join("") : "");
  const title = parsed.blocks.find((b) => allText(b).includes("Word to PDF Conversion Test"));
  assert.ok(title, "title paragraph not found");
  const titleRun = title.inlines.find((i) => i.type === "text" && i.text.includes("Word to PDF Conversion Test"));
  assert.equal(titleRun.bold, true);
  assert.equal(titleRun.sizePt, 22); // sz=44 half-points

  const subtitle = parsed.blocks.find((b) => allText(b).includes("Reference document for layout"));
  assert.ok(subtitle, "subtitle paragraph not found");
  const subtitleRun = subtitle.inlines.find((i) => i.type === "text");
  assert.equal(subtitleRun.italic, true);
});

test("reference DOCX: bold, italic and underline runs are individually detected within the same paragraph", async () => {
  const parsed = await parseDocx(loadReferenceBuffer());
  const allText = (b) => (b.type === "paragraph" ? b.inlines.filter((i) => i.type === "text").map((i) => i.text).join("") : "");
  const para = parsed.blocks.find((b) => allText(b).includes("This paragraph contains"));
  assert.ok(para);
  const bold = para.inlines.find((i) => i.type === "text" && i.text === "bold text");
  const italic = para.inlines.find((i) => i.type === "text" && i.text === "italic text");
  const underline = para.inlines.find((i) => i.type === "text" && i.text === "underlined text");
  assert.equal(bold.bold, true);
  assert.equal(italic.italic, true);
  assert.equal(underline.underline, true);
  // and none of them should be cross-contaminated
  assert.equal(bold.italic, false);
  assert.equal(italic.bold, false);
});

test("reference DOCX: the long paragraph is justified", async () => {
  const parsed = await parseDocx(loadReferenceBuffer());
  const allText = (b) => (b.type === "paragraph" ? b.inlines.filter((i) => i.type === "text").map((i) => i.text).join("") : "");
  const para = parsed.blocks.find((b) => allText(b).includes("test line wrapping and paragraph alignment"));
  assert.ok(para);
  assert.equal(para.align, "justify");
});

test("reference DOCX: bullet list (3 items) and numbered list (3 items) are both recognized with correct types", async () => {
  const parsed = await parseDocx(loadReferenceBuffer());
  const bulletParas = parsed.blocks.filter((b) => b.type === "paragraph" && b.listType === "bullet");
  const numberParas = parsed.blocks.filter((b) => b.type === "paragraph" && b.listType === "number");
  // 3 bullet items in section 2, plus 6 more bullet items in the final checklist = 9 total
  assert.ok(bulletParas.length >= 9, `expected >=9 bullet paragraphs, got ${bulletParas.length}`);
  assert.equal(numberParas.length, 3);
  const numberTexts = numberParas.map((p) => p.inlines.map((i) => i.text || "").join(""));
  assert.deepEqual(numberTexts, ["Open the Word document", "Convert it to PDF", "Compare the layout with the original"]);
});

test("reference DOCX: the table has 5 columns and 4 rows, with correct header and cell text", async () => {
  const parsed = await parseDocx(loadReferenceBuffer());
  const table = parsed.blocks.find((b) => b.type === "table");
  assert.ok(table);
  assert.equal(table.rows.length, 4);
  assert.equal(table.gridCols.length, 5);
  const headerTexts = table.rows[0].cells.map((c) => c.paragraphs.map((p) => p.inlines.map((i) => i.text || "").join("")).join(""));
  assert.deepEqual(headerTexts, ["Item", "Description", "Qty", "Rate", "Amount"]);
  const longDescRow = table.rows[3].cells[1].paragraphs[0].inlines.map((i) => i.text || "").join("");
  assert.ok(longDescRow.includes("Long description item to test text wrapping"));
});

test("reference DOCX: left/center/right aligned paragraphs on page 2 are captured correctly", async () => {
  const parsed = await parseDocx(loadReferenceBuffer());
  const findByText = (t) =>
    parsed.blocks.find((b) => b.type === "paragraph" && b.inlines.some((i) => i.type === "text" && i.text === t));
  assert.equal(findByText("Left aligned text").align, "left");
  assert.equal(findByText("Centered text").align, "center");
  assert.equal(findByText("Right aligned text").align, "right");
});

test("reference DOCX: the multi-line address uses line breaks, not separate paragraphs, and stays in order", async () => {
  const parsed = await parseDocx(loadReferenceBuffer());
  const addressPara = parsed.blocks.find(
    (b) => b.type === "paragraph" && b.inlines.some((i) => i.type === "text" && i.text.includes("Sample Customer Pvt Ltd"))
  );
  assert.ok(addressPara);
  const brCount = addressPara.inlines.filter((i) => i.type === "br").length;
  assert.ok(brCount >= 5, `expected several line breaks in the address block, got ${brCount}`);
  const lines = addressPara.inlines.filter((i) => i.type === "text").map((i) => i.text);
  assert.deepEqual(lines, [
    "Bill To:",
    "Sample Customer Pvt Ltd",
    "45 Business Avenue",
    "Chennai, Tamil Nadu 600001",
    "India",
    "Email: customer@example.com",
    "Phone: +91 90000 00000",
  ]);
});

test("reference DOCX: the manual page break is present exactly once, in the correct position", async () => {
  const parsed = await parseDocx(loadReferenceBuffer());
  const findIndex = (predicate) => parsed.blocks.findIndex(predicate);
  const pageBreakIndex = findIndex((b) => b.type === "paragraph" && b.inlines.some((i) => i.type === "pageBreak"));
  const grandTotalIndex = findIndex((b) => b.type === "paragraph" && b.inlines.some((i) => i.type === "text" && i.text.includes("Grand Total")));
  const page2HeadingIndex = findIndex((b) => b.type === "paragraph" && b.inlines.some((i) => i.type === "text" && i.text.includes("Page 2 - Layout")));
  assert.ok(pageBreakIndex > -1, "page break not found");
  assert.ok(pageBreakIndex > grandTotalIndex, "page break must come after the Grand Total block (end of page 1 content)");
  assert.ok(pageBreakIndex < page2HeadingIndex, "page break must come before the Page 2 heading");

  // exactly one page break in the whole document
  const totalPageBreaks = parsed.blocks.reduce(
    (n, b) => n + (b.type === "paragraph" ? b.inlines.filter((i) => i.type === "pageBreak").length : 0),
    0
  );
  assert.equal(totalPageBreaks, 1);
});

test("reference DOCX: both embedded images are found, decoded and keep their source aspect ratio", async () => {
  const parsed = await parseDocx(loadReferenceBuffer());
  const images = [];
  for (const b of parsed.blocks) {
    if (b.type === "paragraph") images.push(...b.inlines.filter((i) => i.type === "image"));
  }
  assert.equal(images.length, 2);
  for (const img of images) {
    assert.ok(img.dataUrl.startsWith("data:image/png;base64,"));
    // source PNG is 700x180 (ratio ~3.889); both usages must preserve that ratio
    const ratio = img.widthPx / img.heightPx;
    assert.ok(Math.abs(ratio - 700 / 180) < 0.01, `image aspect ratio drifted: ${ratio}`);
  }
});

test("reference DOCX: footer text is extracted", async () => {
  const parsed = await parseDocx(loadReferenceBuffer());
  const footerText = parsed.footerBlocks.map((p) => p.inlines.map((i) => i.text || "").join("")).join(" ");
  assert.ok(footerText.includes("InfoBridgeIndia - Word to PDF Test Reference"));
});

test("reference DOCX: page size is US Letter (8.5in x 11in) with the source document's margins", async () => {
  const parsed = await parseDocx(loadReferenceBuffer());
  assert.equal(parsed.pageSetup.widthIn, 8.5);
  assert.equal(parsed.pageSetup.heightIn, 11);
  assert.ok(Math.abs(parsed.pageSetup.marginTopIn - 936 / 1440) < 0.001);
  assert.ok(Math.abs(parsed.pageSetup.marginLeftIn - 1008 / 1440) < 0.001);
});

test("reference DOCX: rendered HTML contains real <table>, <ul>, <ol> and <img> elements (not flattened plain text)", async () => {
  const { bodyHtml, footerHtml } = await convertDocxToHtml(loadReferenceBuffer());
  assert.ok(bodyHtml.includes("<table"));
  assert.ok(bodyHtml.includes("<ul"));
  assert.ok(bodyHtml.includes("<ol"));
  assert.ok(bodyHtml.includes("<img"));
  assert.ok(bodyHtml.includes("font-weight:bold"));
  assert.ok(bodyHtml.includes("font-style:italic"));
  assert.ok(bodyHtml.includes("text-decoration:underline"));
  assert.ok(bodyHtml.includes('class="wtp-page-break"'));
  assert.ok(footerHtml.includes("InfoBridgeIndia"));
});

// ---------------------------------------------------------------------------
// Robustness / error handling
// ---------------------------------------------------------------------------

test("rejects a non-DOCX file (e.g. plain text or another binary format) with a clear error", async () => {
  const bad = toArrayBuffer(Buffer.from("This is not a docx file at all.", "utf8"));
  await assert.rejects(() => parseDocx(bad), (err) => err.code === "NOT_DOCX");
});

test("rejects a valid ZIP that is missing word/document.xml", async () => {
  const buf = buildDocxFromBody("").slice(0); // placeholder, replaced below
  const enc = new TextEncoder();
  const zip = buildStoredZip([{ name: "not-a-word-doc.txt", data: enc.encode("hello") }]);
  await assert.rejects(() => parseDocx(toArrayBuffer(Buffer.from(zip))), (err) => err.code === "NOT_DOCX");
});

test("rejects a corrupted document.xml (valid zip, malformed XML) with a clear error instead of crashing", async () => {
  const enc = new TextEncoder();
  const zip = buildStoredZip([{ name: "word/document.xml", data: enc.encode("<w:document><w:body><w:p><unclosed") }]);
  await assert.rejects(() => parseDocx(toArrayBuffer(Buffer.from(zip))), (err) => err.code === "CORRUPTED" || err.code === "MALFORMED_XML");
});

test("an empty/near-empty DOCX parses without crashing and reports a warning instead of throwing", async () => {
  const buf = buildDocxFromBody("<w:p/>");
  const parsed = await parseDocx(buf);
  assert.equal(parsed.warnings.length, 1);
  assert.ok(parsed.warnings[0].toLowerCase().includes("empty"));
});

test("a simple one-paragraph DOCX (no styles.xml, no numbering.xml, no rels) still converts", async () => {
  const buf = buildDocxFromBody(`<w:p><w:r><w:t>Hello, world.</w:t></w:r></w:p>`);
  const { bodyHtml } = await convertDocxToHtml(buf);
  assert.ok(bodyHtml.includes("Hello, world."));
});

test("a text-only multi-paragraph DOCX preserves paragraph order", async () => {
  const buf = buildDocxFromBody(
    `<w:p><w:r><w:t>First paragraph.</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph.</w:t></w:r></w:p><w:p><w:r><w:t>Third paragraph.</w:t></w:r></w:p>`
  );
  const parsed = await parseDocx(buf);
  const texts = parsed.blocks.map((b) => b.inlines.map((i) => i.text || "").join(""));
  assert.deepEqual(texts, ["First paragraph.", "Second paragraph.", "Third paragraph."]);
});

test("long paragraphs are preserved verbatim (no truncation) for later CSS wrapping", async () => {
  const longText = "Lorem ipsum dolor sit amet. ".repeat(80);
  const buf = buildDocxFromBody(`<w:p><w:r><w:t>${longText}</w:t></w:r></w:p>`);
  const parsed = await parseDocx(buf);
  assert.equal(parsed.blocks[0].inlines[0].text, longText);
});

test("a DOCX containing only a table (no surrounding paragraphs) converts without error", async () => {
  const tableXml = `<w:tbl><w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="2000"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="2000"/></w:tcPr><w:p><w:r><w:t>A1</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="2000"/></w:tcPr><w:p><w:r><w:t>B1</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
  const buf = buildDocxFromBody(tableXml);
  const parsed = await parseDocx(buf);
  assert.equal(parsed.blocks.length, 1);
  assert.equal(parsed.blocks[0].type, "table");
  assert.equal(parsed.blocks[0].rows[0].cells.length, 2);
});
