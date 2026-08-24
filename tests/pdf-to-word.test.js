import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { parsePdf, convertPdfToDocx } from "../src/pdf-to-word/core.js";

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function buildSimplePdf({ compress = false } = {}) {
  const contentText = [
    "BT", "/F1 24 Tf", "72 700 Td", "(Test Heading) Tj", "ET",
    "BT", "/F1 12 Tf", "72 660 Td", "(This is the first line of body text.) Tj",
    "0 -14 Td", "(This is the second line of the same paragraph.) Tj",
    "0 -40 Td", "(This starts a new paragraph after a larger gap.) Tj", "ET",
  ].join("\n");
  let streamBytes = Buffer.from(contentText, "latin1");
  let filterDict = "";
  if (compress) { streamBytes = zlib.deflateSync(streamBytes); filterDict = " /Filter /FlateDecode"; }
  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
  ];
  const head = Buffer.from("%PDF-1.4\n" + objects.join(""), "latin1");
  const streamHeader = Buffer.from(`5 0 obj\n<< /Length ${streamBytes.length}${filterDict} >>\nstream\n`, "latin1");
  const streamFooter = Buffer.from(`\nendstream\nendobj\ntrailer\n<< /Size 6 /Root 1 0 R >>\n%%EOF`, "latin1");
  return Buffer.concat([head, streamHeader, streamBytes, streamFooter]);
}

function readZipEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd === -1) throw new Error("No EOCD found - not a valid zip");
  const count = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  let pos = centralOffset;
  const entries = {};
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(pos, true), 0x02014b50, `bad central directory signature at entry ${i}`);
    const nameLen = view.getUint16(pos + 28, true);
    const size = view.getUint32(pos + 24, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = Buffer.from(bytes.slice(pos + 46, pos + 46 + nameLen)).toString("utf8");
    const localNameLen = view.getUint16(localOffset + 26, true);
    const dataStart = localOffset + 30 + localNameLen;
    entries[name] = Buffer.from(bytes.slice(dataStart, dataStart + size)).toString("utf8");
    pos += 46 + nameLen + view.getUint16(pos + 30, true) + view.getUint16(pos + 32, true);
  }
  return entries;
}

for (const compress of [false, true]) {
  test(`extracts text, headings and paragraphs from a ${compress ? "FlateDecode-compressed" : "raw"} content stream`, async () => {
    const parsed = await parsePdf(toArrayBuffer(buildSimplePdf({ compress })));
    assert.equal(parsed.pageCount, 1);
    assert.equal(parsed.warnings.length, 0);
    const allText = parsed.pages[0].map((p) => p.text).join(" | ");
    assert.ok(allText.includes("Test Heading"));
    assert.ok(allText.includes("This is the first line of body text."));
    assert.ok(allText.includes("second line of the same paragraph"));
    assert.ok(allText.includes("This starts a new paragraph"));
    assert.equal(parsed.pages[0][0].fontSize, 24);
    assert.ok(parsed.pages[0].some((p) => p.text.includes("first line") && p.text.includes("second line")));
    assert.ok(parsed.pages[0].some((p) => p.text.trim().startsWith("This starts a new paragraph") && !p.text.includes("second line")));
  });
}

test("produces a structurally valid .docx (zip with required OOXML parts)", async () => {
  const { bytes, pageCount, warnings } = await convertPdfToDocx(toArrayBuffer(buildSimplePdf()));
  assert.ok(bytes instanceof Uint8Array && bytes.length > 0);
  assert.equal(pageCount, 1);
  assert.equal(warnings.length, 0);
  const entries = readZipEntries(bytes);
  for (const f of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/_rels/document.xml.rels", "docProps/core.xml", "docProps/app.xml"]) {
    assert.ok(f in entries, `missing zip part: ${f}`);
  }
  assert.ok(entries["word/document.xml"].includes("Test Heading"));
  assert.ok(entries["word/document.xml"].includes('w:val="Heading1"'));
  assert.ok(entries["[Content_Types].xml"].includes("word/document.xml"));
});

test("rejects non-PDF input", async () => {
  await assert.rejects(() => parsePdf(toArrayBuffer(Buffer.from("not a pdf at all"))), (e) => e.code === "NOT_PDF");
});

test("rejects encrypted PDFs", async () => {
  const buf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R /Encrypt 2 0 R >>\n%%EOF", "latin1");
  await assert.rejects(() => parsePdf(toArrayBuffer(buf)), (e) => e.code === "ENCRYPTED");
});

test("orders multi-page documents correctly and detects bold from font name", async () => {
  const c1 = Buffer.from("BT\n/F1 12 Tf\n72 700 Td\n(Page one text) Tj\nET", "latin1");
  const c2 = Buffer.from("BT\n/F1 12 Tf\n72 700 Td\n(Page two text) Tj\nET", "latin1");
  const objs = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 6 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    `4 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 6 0 R >> >> /Contents 7 0 R >>\nendobj\n`,
    `6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Arial-BoldMT >>\nendobj\n`,
  ];
  const head = Buffer.from("%PDF-1.4\n" + objs.join(""), "latin1");
  const s5 = Buffer.from(`5 0 obj\n<< /Length ${c1.length} >>\nstream\n`, "latin1");
  const s7 = Buffer.from(`7 0 obj\n<< /Length ${c2.length} >>\nstream\n`, "latin1");
  const mid = Buffer.from(`\nendstream\nendobj\n`, "latin1");
  const tail = Buffer.from(`trailer\n<< /Root 1 0 R >>\n%%EOF`, "latin1");
  const pdfBuf = Buffer.concat([head, s5, c1, mid, s7, c2, mid, tail]);

  const parsed = await parsePdf(toArrayBuffer(pdfBuf));
  assert.equal(parsed.pageCount, 2);
  assert.ok(parsed.pages[0][0].text.includes("Page one"));
  assert.ok(parsed.pages[1][0].text.includes("Page two"));
  assert.equal(parsed.pages[0][0].bold, true);

  const { bytes } = await convertPdfToDocx(toArrayBuffer(pdfBuf));
  const entries = readZipEntries(bytes);
  assert.ok(entries["word/document.xml"].includes('w:type="page"'));
  assert.ok(entries["word/document.xml"].includes("<w:b/>"));
});

test("decodes ToUnicode CMap bfchar and bfrange blocks for composite (Type0) fonts", async () => {
  const cmap = [
    "/CIDInit /ProcSet findresource begin",
    "1 begincodespacerange", "<0000> <FFFF>", "endcodespacerange",
    "1 beginbfchar", "<0003> <0041>", "endbfchar",
    "1 beginbfrange", "<0004> <0006> <0042>", "endbfrange",
  ].join("\n");
  const content = Buffer.from("BT\n/F1 12 Tf\n72 700 Td\n<0003000400050006> Tj\nET", "latin1");
  const objs = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 6 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    `6 0 obj\n<< /Type /Font /Subtype /Type0 /BaseFont /Custom /ToUnicode 8 0 R >>\nendobj\n`,
  ];
  const head = Buffer.from("%PDF-1.4\n" + objs.join(""), "latin1");
  const s5 = Buffer.from(`5 0 obj\n<< /Length ${content.length} >>\nstream\n`, "latin1");
  const s8 = Buffer.from(`8 0 obj\n<< /Length ${cmap.length} >>\nstream\n`, "latin1");
  const mid = Buffer.from(`\nendstream\nendobj\n`, "latin1");
  const tail = Buffer.from(`trailer\n<< /Root 1 0 R >>\n%%EOF`, "latin1");
  const pdfBuf = Buffer.concat([head, s5, content, mid, s8, Buffer.from(cmap, "latin1"), mid, tail]);

  const parsed = await parsePdf(toArrayBuffer(pdfBuf));
  assert.equal(parsed.pages[0][0].text, "ABCD");
});

test("scanned/empty PDFs produce a warning and a valid placeholder docx instead of failing", async () => {
  const objs = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 5 0 R >>\nendobj\n`,
  ];
  const head = Buffer.from("%PDF-1.4\n" + objs.join(""), "latin1");
  const s5 = Buffer.from(`5 0 obj\n<< /Length 0 >>\nstream\n`, "latin1");
  const tail = Buffer.from(`\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`, "latin1");
  const pdfBuf = Buffer.concat([head, s5, tail]);

  const parsed = await parsePdf(toArrayBuffer(pdfBuf));
  assert.equal(parsed.warnings.length, 1);
  const { bytes } = await convertPdfToDocx(toArrayBuffer(pdfBuf));
  const entries = readZipEntries(bytes);
  assert.ok(entries["word/document.xml"].includes("No extractable text was found"));
});

// ---------------------------------------------------------------------------
// Regression coverage for a real bug report: text arriving as many small
// Tj/TJ fragments (word-by-word or letter-by-letter, a very common real-world
// PDF content-stream pattern) was exploding into one paragraph per fragment,
// turning a 2-page PDF into dozens of pages with words/letters split apart.
// These tests build content streams with a REAL /Widths table (approximate
// Helvetica AFM metrics) and precise glyph advances, exactly like a real PDF
// generator would, rather than adversarial hand-picked numbers.
// ---------------------------------------------------------------------------

const HELV_WIDTHS = {
  " ": 278, "!": 278, '"': 355, "#": 556, $: 556, "%": 889, "&": 667, "'": 191,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  0: 556, 1: 556, 2: 556, 3: 556, 4: 556, 5: 556, 6: 556, 7: 556, 8: 556, 9: 556,
  ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500,
  K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
  U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  "[": 278, "\\": 278, "]": 278, "^": 469, _: 556, "`": 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
  u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  "{": 334, "|": 260, "}": 334, "~": 584,
};
const FIRST_CHAR = 32, LAST_CHAR = 126;
const WIDTHS_ARRAY = [];
for (let c = FIRST_CHAR; c <= LAST_CHAR; c++) WIDTHS_ARRAY.push(HELV_WIDTHS[String.fromCharCode(c)] ?? 556);
function helvAdvance(text, fontSize) {
  let total = 0;
  for (const ch of text) total += ((HELV_WIDTHS[ch] ?? 556) / 1000) * fontSize;
  return total;
}
function buildPdfWithRealWidths({ pagesContent }) {
  const kids = [];
  const pageObjs = [];
  const contentObjs = [];
  let nextObj = 5;
  for (let i = 0; i < pagesContent.length; i++) {
    const pageNum = nextObj++;
    const contentNum = nextObj++;
    kids.push(`${pageNum} 0 R`);
    pageObjs.push(`${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents ${contentNum} 0 R >>\nendobj\n`);
    const bytes = Buffer.from(pagesContent[i], "latin1");
    contentObjs.push(`${contentNum} 0 obj\n<< /Length ${bytes.length} >>\nstream\n${pagesContent[i]}\nendstream\nendobj\n`);
  }
  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pagesContent.length} >>\nendobj\n`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /FirstChar ${FIRST_CHAR} /LastChar ${LAST_CHAR} /Widths [${WIDTHS_ARRAY.join(" ")}] >>\nendobj\n`,
    ...pageObjs,
    ...contentObjs,
  ];
  const head = Buffer.from("%PDF-1.4\n" + objects.join(""), "latin1");
  const tail = Buffer.from(`trailer\n<< /Root 1 0 R >>\n%%EOF`, "latin1");
  return Buffer.concat([head, tail]);
}

// Per PDF spec (9.4.2), Td/TD offset from the text LINE matrix (Tlm) - the
// position set by the *previous* Td/TD/Tm/T* - not from wherever auto-advance
// left the pen after showing glyphs. So a Td that repositions to the next
// word must supply the FULL distance from the last line-matrix anchor
// (previous word's width + the space), not just the space width alone.
test("word-by-word Tj fragments, each repositioned via a spec-correct cumulative Td, reassemble into one correctly-spaced paragraph", async () => {
  const fontSize = 12;
  const words = ["Hello", "World,", "this", "is", "one", "normal", "line", "of", "text."];
  const lines = ["BT", "/F1 12 Tf", "72 700 Td"];
  words.forEach((w, i) => {
    if (i > 0) lines.push(`${(helvAdvance(words[i - 1], fontSize) + helvAdvance(" ", fontSize)).toFixed(3)} 0 Td`);
    lines.push(`(${w}) Tj`);
  });
  lines.push("ET");
  const pdfBuf = buildPdfWithRealWidths({ pagesContent: [lines.join("\n")] });
  const parsed = await parsePdf(toArrayBuffer(pdfBuf));
  assert.equal(parsed.pages[0].length, 1, "word-by-word text must not explode into one paragraph per word");
  assert.equal(parsed.pages[0][0].text, "Hello World, this is one normal line of text.");
});

// This is exactly the real-world pattern found in reference-files/Amazon.pdf
// (a Chrome/Skia PDF export): every single glyph gets its own Tj, preceded
// by a Td whose value equals the PREVIOUS glyph's own advance width - i.e.
// the content stream reproduces natural auto-advance one character at a
// time via explicit, spec-correct, cumulative Tlm repositioning.
test("per-glyph Tj+Td fragments (the real Amazon.pdf pattern) reassemble into whole, correctly-spaced words", async () => {
  const fontSize = 12;
  const word1 = ["H", "e", "l", "l", "o"];
  const word2 = ["W", "o", "r", "l", "d"];
  const lines = ["BT", "/F1 12 Tf", "72 700 Td"];
  let prevChar = null;
  for (const ch of word1) {
    if (prevChar) lines.push(`${helvAdvance(prevChar, fontSize).toFixed(3)} 0 Td`);
    lines.push(`(${ch}) Tj`);
    prevChar = ch;
  }
  lines.push(`${(helvAdvance(prevChar, fontSize) + helvAdvance(" ", fontSize)).toFixed(3)} 0 Td`);
  prevChar = null;
  for (const ch of word2) {
    if (prevChar) lines.push(`${helvAdvance(prevChar, fontSize).toFixed(3)} 0 Td`);
    lines.push(`(${ch}) Tj`);
    prevChar = ch;
  }
  lines.push("ET");
  const pdfBuf = buildPdfWithRealWidths({ pagesContent: [lines.join("\n")] });
  const parsed = await parsePdf(toArrayBuffer(pdfBuf));
  assert.equal(parsed.pages[0].length, 1, "per-glyph text must not explode into one paragraph per letter");
  assert.equal(parsed.pages[0][0].text, "Hello World");
});

test("Tj calls with no repositioning at all rely on pure auto-advance and stay on one line", async () => {
  const chars = ["H", "e", "l", "l", "o"];
  const lines = ["BT", "/F1 12 Tf", "72 700 Td", ...chars.map((ch) => `(${ch}) Tj`), "ET"];
  const pdfBuf = buildPdfWithRealWidths({ pagesContent: [lines.join("\n")] });
  const parsed = await parsePdf(toArrayBuffer(pdfBuf));
  assert.equal(parsed.pages[0].length, 1);
  assert.equal(parsed.pages[0][0].text, "Hello");
});

test("a realistic word-by-word 2-page document keeps its page count proportional, not exploded", async () => {
  const fontSize = 11;
  const leading = 14;
  function buildPage(sentences) {
    const lines = ["BT", `/F1 ${fontSize} Tf`];
    let y = 700;
    for (const sentence of sentences) {
      const words = sentence.split(" ");
      lines.push(`72 ${y} Td`);
      words.forEach((w, i) => {
        if (i > 0) lines.push(`${(helvAdvance(words[i - 1], fontSize) + helvAdvance(" ", fontSize)).toFixed(3)} 0 Td`);
        lines.push(`(${w}) Tj`);
      });
      lines.push("ET");
      y -= leading;
      lines.push("BT", `/F1 ${fontSize} Tf`);
    }
    lines.push("ET");
    return lines.join("\n");
  }
  const page1 = buildPage([
    "This is the first paragraph of a normal business document.",
    "It has a few sentences that should stay together as one flowing paragraph of text.",
  ]);
  const page2 = buildPage([
    "This is the second page of the same document, continuing normally.",
    "Word by word rendering should not explode the page count at all.",
  ]);
  const pdfBuf = buildPdfWithRealWidths({ pagesContent: [page1, page2] });
  const parsed = await parsePdf(toArrayBuffer(pdfBuf));
  assert.equal(parsed.pageCount, 2);
  assert.ok(parsed.pages[0].length <= 3, `page 1 produced ${parsed.pages[0].length} blocks, expected a small handful`);
  assert.ok(parsed.pages[1].length <= 3, `page 2 produced ${parsed.pages[1].length} blocks, expected a small handful`);
  const page1Text = parsed.pages[0].map((b) => b.text).join(" ");
  assert.ok(page1Text.includes("This is the first paragraph of a normal business document."), page1Text);
  assert.ok(page1Text.includes("It has a few sentences that should stay together as one flowing paragraph of text."), page1Text);
  const { pageCount } = await convertPdfToDocx(toArrayBuffer(pdfBuf));
  assert.equal(pageCount, 2);
});

test("a positionally-aligned grid of text is detected and rendered as a real table, not paragraphs", async () => {
  const cols = [72, 200, 350];
  const rows = [
    ["Item", "Qty", "Amount"],
    ["Widget A", "2", "500.00"],
    ["Widget B", "5", "1250.00"],
    ["Widget C", "1", "99.00"],
  ];
  const lines = [];
  let y = 700;
  for (const row of rows) {
    for (let c = 0; c < cols.length; c++) {
      lines.push("BT", "/F1 12 Tf", `1 0 0 1 ${cols[c]} ${y} Tm`, `(${row[c]}) Tj`, "ET");
    }
    y -= 20;
  }
  const pdfBuf = buildPdfWithRealWidths({ pagesContent: [lines.join("\n")] });
  const parsed = await parsePdf(toArrayBuffer(pdfBuf));

  const tableBlocks = parsed.pages[0].filter((b) => b.type === "table");
  assert.equal(tableBlocks.length, 1);
  const t = tableBlocks[0];
  assert.equal(t.rows.length, 4);
  assert.ok(t.rows.every((r) => r.segments.length === 3));
  assert.equal(t.rows[0].segments.map((s) => s.text.trim()).join("|"), "Item|Qty|Amount");
  assert.equal(t.rows[2].segments.map((s) => s.text.trim()).join("|"), "Widget B|5|1250.00");

  const { bytes } = await convertPdfToDocx(toArrayBuffer(pdfBuf));
  const entries = readZipEntries(bytes);
  assert.ok(entries["word/document.xml"].includes("<w:tbl>"));
  assert.ok(["Item", "Qty", "Amount", "Widget A", "500.00", "Widget C"].every((t2) => entries["word/document.xml"].includes(t2)));
  assert.ok(entries["word/document.xml"].includes("tblBorders"));
});
