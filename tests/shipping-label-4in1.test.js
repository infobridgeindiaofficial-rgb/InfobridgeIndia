import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildFourInOnePdf,
  parsePdfDocument,
  slotBox,
  computePlacement,
  A4_WIDTH,
  A4_HEIGHT,
  PAGE_MARGIN,
} from "../src/shipping-label-4in1/core.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REFERENCE_PATH = join(__dirname, "..", "reference-files", "sample-shipping-label.pdf");

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function loadReferenceBytes() {
  return new Uint8Array(readFileSync(REFERENCE_PATH));
}

// Builds a minimal, valid multi-page PDF for layout/ordering tests, in the
// same spirit as the fixtures in pdf-to-word.test.js - classic xref-less
// (but trailer-terminated) structure our hand-rolled scanner accepts.
function buildMiniPdf(pageSizes, { rotate, cropBox } = {}) {
  const kids = [];
  const pageObjs = [];
  const contentObjs = [];
  let nextObj = 3;
  for (let i = 0; i < pageSizes.length; i++) {
    const [w, h] = pageSizes[i];
    const pageNum = nextObj++;
    const contentNum = nextObj++;
    kids.push(`${pageNum} 0 R`);
    const rotateAttr = rotate ? ` /Rotate ${rotate}` : "";
    const cropAttr = cropBox ? ` /CropBox [${cropBox.join(" ")}] /TrimBox [${cropBox.join(" ")}]` : "";
    pageObjs.push(
      `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}]${cropAttr}${rotateAttr} /Resources << /ProcSet [/PDF] >> /Contents ${contentNum} 0 R >>\nendobj\n`
    );
    const content = `1 0 0 RG\n0 0 ${w} ${h} re\nS\n`;
    contentObjs.push(`${contentNum} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  }
  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pageSizes.length} >>\nendobj\n`,
    ...pageObjs,
    ...contentObjs,
  ];
  const head = Buffer.from("%PDF-1.4\n" + objects.join(""), "latin1");
  const tail = Buffer.from(`trailer\n<< /Root 1 0 R >>\n%%EOF`, "latin1");
  return new Uint8Array(Buffer.concat([head, tail]));
}

async function generatedPages(bytes) {
  const doc = await parsePdfDocument(toArrayBuffer(Buffer.from(bytes)));
  return doc;
}

// Reads back the placement geometry actually written for one output sheet:
// for every /Sn XObject used on that page, returns its Form's BBox/Matrix
// plus the outer `cm` scale/offset that was written into the page's own
// (always-uncompressed) content stream.
function readSlotPlacements(doc, pageEntry) {
  const contentsRef = pageEntry.dict["/Contents"];
  const contentObj = doc.objects.get(contentsRef.ref);
  const contentBytes = doc.bytes.slice(contentObj.stream.byteStart, contentObj.stream.byteEnd);
  const contentText = Buffer.from(contentBytes).toString("latin1");

  const resources = pageEntry.dict["/Resources"];
  const xobjectDict = resources["/XObject"];
  const placements = {};
  const lineRe = /q ([\d.\-]+) 0 0 ([\d.\-]+) ([\d.\-]+) ([\d.\-]+) cm \/(S\d) Do Q/g;
  let m;
  while ((m = lineRe.exec(contentText))) {
    const [, scale, , offX, offY, name] = m;
    const formRef = xobjectDict["/" + name];
    const formObj = doc.objects.get(formRef.ref);
    placements[name] = {
      scale: Number(scale),
      offX: Number(offX),
      offY: Number(offY),
      bbox: formObj.dict["/BBox"],
      matrix: formObj.dict["/Matrix"],
    };
  }
  return placements;
}

test("TEST 1: a single slip produces one A4 page occupying only the top-left quarter", async () => {
  const bytes = loadReferenceBytes();
  const result = await buildFourInOnePdf([{ name: "ref.pdf", bytes }]);
  assert.equal(result.slipCount, 1);
  assert.equal(result.pageCount, 1);

  const doc = await generatedPages(result.bytes);
  assert.equal(doc.pages.length, 1);
  const placements = readSlotPlacements(doc, doc.pages[0]);
  assert.deepEqual(Object.keys(placements).sort(), ["S0"]);

  const p = placements.S0;
  const box = slotBox(0);
  // Must fit fully inside the top-left slot (no overflow into other quarters).
  assert.ok(p.offX >= box.x - 0.5 && p.offX <= box.x + box.w + 0.5);
  assert.ok(p.offY >= box.y - 0.5 && p.offY <= box.y + box.h + 0.5);
  // Top-left quarter sits in the upper half of the sheet.
  assert.ok(p.offY > A4_HEIGHT / 2, "slip must be placed in the top half of the sheet");
  assert.ok(p.offX < A4_WIDTH / 2, "slip must be placed in the left half of the sheet");
});

test("TEST 2: two slips fill top-left and top-right, bottom row stays empty", async () => {
  const bytes = loadReferenceBytes();
  const result = await buildFourInOnePdf([
    { name: "ref1.pdf", bytes },
    { name: "ref2.pdf", bytes },
  ]);
  assert.equal(result.slipCount, 2);
  assert.equal(result.pageCount, 1);

  const doc = await generatedPages(result.bytes);
  const placements = readSlotPlacements(doc, doc.pages[0]);
  assert.deepEqual(Object.keys(placements).sort(), ["S0", "S1"]);
  assert.ok(placements.S1.offX > placements.S0.offX, "slip 2 must be to the right of slip 1");
  assert.ok(Math.abs(placements.S0.offY - placements.S1.offY) < 0.01, "both slips must be on the same (top) row");
});

test("three slips leave the bottom-right slot completely blank", async () => {
  const bytes = loadReferenceBytes();
  const result = await buildFourInOnePdf([0, 1, 2].map(i => ({ name: `ref${i}.pdf`, bytes })));
  const doc = await generatedPages(result.bytes);
  const placements = readSlotPlacements(doc, doc.pages[0]);
  assert.deepEqual(Object.keys(placements).sort(), ["S0", "S1", "S2"]);
  assert.equal(placements.S3, undefined);
});

test("TEST 3: four slips fill all four quadrants in the approved order", async () => {
  const bytes = loadReferenceBytes();
  const files = [0, 1, 2, 3].map((i) => ({ name: `ref${i}.pdf`, bytes }));
  const result = await buildFourInOnePdf(files);
  assert.equal(result.slipCount, 4);
  assert.equal(result.pageCount, 1);

  const doc = await generatedPages(result.bytes);
  const p = readSlotPlacements(doc, doc.pages[0]);
  assert.deepEqual(Object.keys(p).sort(), ["S0", "S1", "S2", "S3"]);
  assert.ok(p.S1.offX > p.S0.offX, "S1 (top-right) must be right of S0 (top-left)");
  assert.ok(p.S3.offX > p.S2.offX, "S3 (bottom-right) must be right of S2 (bottom-left)");
  assert.ok(p.S0.offY > p.S2.offY, "S0 (top-left) must be above S2 (bottom-left)");
  assert.ok(p.S1.offY > p.S3.offY, "S1 (top-right) must be above S3 (bottom-right)");
  assert.ok(Math.abs(p.S0.offY - p.S1.offY) < 0.01);
  assert.ok(Math.abs(p.S2.offY - p.S3.offY) < 0.01);
  assert.ok(Math.abs(p.S0.offX - p.S2.offX) < 0.01);
  assert.ok(Math.abs(p.S1.offX - p.S3.offX) < 0.01);
});

test("TEST 4: five slips span two A4 pages - page 1 full, page 2 has only top-left", async () => {
  const bytes = loadReferenceBytes();
  const files = [0, 1, 2, 3, 4].map((i) => ({ name: `ref${i}.pdf`, bytes }));
  const result = await buildFourInOnePdf(files);
  assert.equal(result.slipCount, 5);
  assert.equal(result.pageCount, 2);

  const doc = await generatedPages(result.bytes);
  assert.equal(doc.pages.length, 2);
  const page1 = readSlotPlacements(doc, doc.pages[0]);
  const page2 = readSlotPlacements(doc, doc.pages[1]);
  assert.deepEqual(Object.keys(page1).sort(), ["S0", "S1", "S2", "S3"]);
  assert.deepEqual(Object.keys(page2).sort(), ["S0"]);
});

test("TEST 5: twenty slips produce exactly five A4 pages; twenty-one produce six with a lone final slot", async () => {
  const bytes = loadReferenceBytes();

  const files20 = Array.from({ length: 20 }, (_, i) => ({ name: `ref${i}.pdf`, bytes }));
  const result20 = await buildFourInOnePdf(files20);
  assert.equal(result20.slipCount, 20);
  assert.equal(result20.pageCount, 5);
  const doc20 = await generatedPages(result20.bytes);
  assert.equal(doc20.pages.length, 5);
  for (const page of doc20.pages) {
    assert.deepEqual(Object.keys(readSlotPlacements(doc20, page)).sort(), ["S0", "S1", "S2", "S3"]);
  }

  const files21 = Array.from({ length: 21 }, (_, i) => ({ name: `ref${i}.pdf`, bytes }));
  const result21 = await buildFourInOnePdf(files21);
  assert.equal(result21.slipCount, 21);
  assert.equal(result21.pageCount, 6);
  const doc21 = await generatedPages(result21.bytes);
  const lastPagePlacements = readSlotPlacements(doc21, doc21.pages[5]);
  assert.deepEqual(Object.keys(lastPagePlacements).sort(), ["S0"]);
});

test("multiple PDFs (3-page + 5-page) preserve upload order and in-file page order across sheets", async () => {
  // Each synthetic page gets a unique width so the resulting scale factor
  // (which is a deterministic function of that page's own width) reveals
  // which source page landed in which output slot, proving no reordering.
  const fileA = buildMiniPdf([[100, 400], [120, 400], [140, 400]]); // 3 pages
  const fileB = buildMiniPdf([[160, 400], [180, 400], [200, 400], [220, 400], [240, 400]]); // 5 pages

  const result = await buildFourInOnePdf([
    { name: "fileA.pdf", bytes: fileA },
    { name: "fileB.pdf", bytes: fileB },
  ]);
  assert.equal(result.slipCount, 8);
  assert.equal(result.pageCount, 2);

  const doc = await generatedPages(result.bytes);
  const page1 = readSlotPlacements(doc, doc.pages[0]);
  const page2 = readSlotPlacements(doc, doc.pages[1]);

  const expectedWidths = [100, 120, 140, 160, 180, 200, 220, 240];
  const box = slotBox(0); // all slots share the same w/h
  const allSlots = [
    page1.S0, page1.S1, page1.S2, page1.S3,
    page2.S0, page2.S1, page2.S2, page2.S3,
  ];
  allSlots.forEach((slot, i) => {
    const w = expectedWidths[i];
    const expectedScale = Math.min(box.w / w, box.h / 400);
    assert.ok(Math.abs(slot.scale - expectedScale) < 0.001, `slot ${i}: expected scale for width ${w}`);
  });
});

test("aspect ratio is preserved (never stretched) and content never overflows its slot", async () => {
  const bytes = loadReferenceBytes();
  const doc = await parsePdfDocument(toArrayBuffer(Buffer.from(bytes)));
  const mediabox = doc.pages[0].dict["/MediaBox"];
  const srcW = mediabox[2] - mediabox[0];
  const srcH = mediabox[3] - mediabox[1];

  const box = slotBox(0);
  const placement = computePlacement(srcW, srcH, box);
  assert.ok(Math.abs(placement.placedW / placement.placedH - srcW / srcH) < 1e-9, "aspect ratio must be preserved exactly");
  assert.ok(placement.placedW <= box.w + 1e-9);
  assert.ok(placement.placedH <= box.h + 1e-9);
});

test("complete MediaBox controls scaling even when visible/crop bounds are shorter", async () => {
  const fullPage = buildMiniPdf([[300, 600]], { cropBox: [0, 300, 300, 600] });
  const result = await buildFourInOnePdf([{ name: "full-physical-page.pdf", bytes: fullPage }]);
  const doc = await generatedPages(result.bytes);
  const placement = readSlotPlacements(doc, doc.pages[0]).S0;
  const box = slotBox(0);
  assert.deepEqual(placement.bbox, [0, 0, 300, 600], "Form BBox must preserve the full source MediaBox");
  assert.ok(Math.abs(placement.scale - Math.min(box.w / 300, box.h / 600)) < 0.001);
  assert.notEqual(placement.scale, Math.min(box.w / 300, box.h / 300), "Crop/content height must not control scaling");
});

test("rotated source pages (/Rotate 90) are compensated so content lands fully within bounds, dimensions swapped", async () => {
  const rotated = buildMiniPdf([[300, 500]], { rotate: 90 });
  const result = await buildFourInOnePdf([{ name: "rotated.pdf", bytes: rotated }]);
  const doc = await generatedPages(result.bytes);
  const placements = readSlotPlacements(doc, doc.pages[0]);
  const { bbox, matrix } = placements.S0;

  const [x0, y0, x1, y1] = bbox;
  const [a, b, c, d, e, f] = matrix;
  const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  // A 90-degree rotation of a 300x500 box must produce an effective 500x300
  // box, mapped into non-negative space starting at the origin.
  assert.ok(Math.min(...xs) > -0.001 && Math.min(...ys) > -0.001, "rotated content must not go negative");
  assert.ok(Math.abs(Math.max(...xs) - 500) < 0.001, `expected rotated width 500, got ${Math.max(...xs)}`);
  assert.ok(Math.abs(Math.max(...ys) - 300) < 0.001, `expected rotated height 300, got ${Math.max(...ys)}`);

  // The slot placement itself must scale using the *rotated* (swapped) size.
  const box = slotBox(0);
  const expectedScale = Math.min(box.w / 500, box.h / 300);
  assert.ok(Math.abs(placements.S0.scale - expectedScale) < 0.001);
});

test("rejects a non-PDF file with a clear, per-file error message", async () => {
  const bad = new Uint8Array(Buffer.from("not a pdf at all", "latin1"));
  await assert.rejects(
    () => buildFourInOnePdf([{ name: "not-a-pdf.txt", bytes: bad }]),
    (err) => err.message.includes("not-a-pdf.txt") && err.code === "NOT_PDF"
  );
});

test("rejects encrypted PDFs", async () => {
  const buf = new Uint8Array(
    Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R /Encrypt 2 0 R >>\n%%EOF", "latin1")
  );
  await assert.rejects(() => buildFourInOnePdf([{ name: "locked.pdf", bytes: buf }]), (err) => err.code === "ENCRYPTED");
});

test("the produced PDF preserves the original content stream bytes untouched for a single-stream page (no re-encoding)", async () => {
  const bytes = loadReferenceBytes();
  const srcDoc = await parsePdfDocument(toArrayBuffer(Buffer.from(bytes)));
  const srcContentRef = srcDoc.pages[0].dict["/Contents"];
  const srcContentObj = srcDoc.objects.get(srcContentRef.ref);
  const srcContentBytes = srcDoc.bytes.slice(srcContentObj.stream.byteStart, srcContentObj.stream.byteEnd);

  const result = await buildFourInOnePdf([{ name: "ref.pdf", bytes }]);
  const outDoc = await generatedPages(result.bytes);
  const xobjectDict = outDoc.pages[0].dict["/Resources"]["/XObject"];
  const formObj = outDoc.objects.get(xobjectDict["/S0"].ref);
  const formBytes = outDoc.bytes.slice(formObj.stream.byteStart, formObj.stream.byteEnd);

  assert.equal(formBytes.length, srcContentBytes.length);
  assert.ok(Buffer.from(formBytes).equals(Buffer.from(srcContentBytes)), "original compressed content stream bytes must be copied verbatim");
});
