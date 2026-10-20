import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseLabelIdentity, findDuplicateLabels, extractLabelIdentities, sameShipment } from "../src/shipping-label-4in1/duplicates.js";
import { buildFourInOnePdf, parsePdfDocument, A4_WIDTH, A4_HEIGHT } from "../src/shipping-label-4in1/core.js";

async function labelPdf(pages) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = document.addPage([300, 420]);
    text.split("\n").forEach((line, index) => page.drawText(line, { x: 15, y: 395 - index * 16, size: 9, font }));
    for (let index = 0; index < 50; index++) page.drawRectangle({ x: 20 + index * 4, y: 80, width: index % 3 + 1, height: 30 });
    page.drawRectangle({ x: 25, y: 30, width: 20, height: 20 });
  }
  return document.save({ useObjectStreams: false });
}

function sample(marketplace, index = 1, overrides = {}) {
  const order = marketplace === "Amazon" ? `408-1234567-${String(index).padStart(7, "0")}`
    : marketplace === "Flipkart" ? `OD123456789012345${index}` : `3161399894736247${String(index).padStart(2, "0")}`;
  const fields = { order, awb: `${marketplace === "Amazon" ? "TBA" : marketplace === "Flipkart" ? "FMPC" : "VL"}1234567890${index}`, ...overrides };
  return `${marketplace}\nOrder ID: ${fields.order}\n${marketplace === "Meesho" ? `Sub Order ID: ${fields.order}_1\n` : ""}${fields.awb ? `AWB No: ${fields.awb}\n` : ""}${fields.shipment ? `Shipment ID: ${fields.shipment}\n` : ""}Customer: Same Customer\nSKU: SAME-SKU\nAddress: Same Street`;
}

async function analyze(files) {
  const labels = [];
  for (const [fileIndex, file] of files.entries()) {
    const identities = await extractLabelIdentities(file.bytes, pdfjs);
    identities.forEach((identity, pageIndex) => labels.push({ ...identity, fileIndex, pageIndex, name: file.name, key: `${fileIndex}:${pageIndex}` }));
  }
  return { labels, duplicates: findDuplicateLabels(labels) };
}

for (const marketplace of ["Amazon", "Flipkart", "Meesho"]) {
  test(`${marketplace}: duplicates within a PDF and across renamed/reformatted PDFs; selected export`, async () => {
    const label = sample(marketplace);
    const files = [
      { name: "first.pdf", bytes: await labelPdf([label, label, sample(marketplace, 2)]) },
      { name: "different-name.pdf", bytes: await labelPdf([label.replace(/AWB No:/, "Tracking Number:").replace(/12345678901/g, "12345 678901")]) },
    ];
    const { labels, duplicates } = await analyze(files);
    assert.equal(labels.length, 4);
    assert.equal(duplicates.length, 2);
    assert.ok(labels.every(label => label.marketplace === marketplace));
    assert.equal(duplicates[1].original.name, "first.pdf");
    assert.equal(duplicates[1].duplicate.name, "different-name.pdf");
    const keepBoth = await buildFourInOnePdf(files);
    assert.equal(keepBoth.slipCount, 4);
    const removed = new Set(duplicates.map(pair => pair.duplicate.key));
    const selected = files.map((file, fileIndex) => ({ ...file, pageIndices: labels.filter(label => label.fileIndex === fileIndex && !removed.has(label.key)).map(label => label.pageIndex) }));
    const result = await buildFourInOnePdf(selected);
    assert.equal(result.slipCount, 2);
    assert.equal(result.pageCount, 1);
    const document = await parsePdfDocument(result.bytes);
    assert.deepEqual(document.pages[0].dict["/MediaBox"], [0, 0, A4_WIDTH, A4_HEIGHT]);
    assert.equal(Object.keys(document.pages[0].dict["/Resources"]["/XObject"]).length, 2);
  });

  test(`${marketplace}: shared customer/order/SKU cannot merge different shipments`, () => {
    const first = parseLabelIdentity(sample(marketplace));
    const sameCustomer = parseLabelIdentity(sample(marketplace, 2));
    const splitShipment = parseLabelIdentity(sample(marketplace, 1, { awb: "OTHER123456789" }));
    assert.equal(findDuplicateLabels([first, sameCustomer, splitShipment]).length, 0);
    const withoutTracking = parseLabelIdentity(sample(marketplace, 1, { awb: "" }));
    assert.equal(sameShipment(first, withoutTracking), false);
  });

  test(`${marketplace}: shipment ID identifies copies without AWB; conflicting identifiers stay separate`, () => {
    const first = parseLabelIdentity(sample(marketplace, 1, { awb: "", shipment: "SHIP12345678" }));
    const copy = parseLabelIdentity(sample(marketplace, 1, { awb: "", shipment: "ship-12345678" }));
    assert.equal(sameShipment(first, copy), true);
    const split = parseLabelIdentity(sample(marketplace, 1, { awb: "", shipment: "SHIP87654321" }));
    assert.equal(sameShipment(first, split), false);
    const awb = parseLabelIdentity(sample(marketplace, 1, { shipment: "SHIP12345678" }));
    const conflict = parseLabelIdentity(sample(marketplace, 1, { shipment: "SHIP87654321" }));
    assert.equal(sameShipment(awb, conflict), false);
  });
}

test("Meesho: 10 labels / 7 unique shipments / exactly 3 duplicate copies", async () => {
  const labels = Array.from({ length: 7 }, (_, index) => sample("Meesho", index + 1));
  const files = [
    { name: "meesho-batch.pdf", bytes: await labelPdf([...labels, labels[0]]) },
    { name: "meesho-copies.pdf", bytes: await labelPdf([labels[3], labels[6]]) },
  ];
  const result = await analyze(files);
  assert.equal(result.labels.length, 10);
  assert.equal(result.duplicates.length, 3);
  const removed = new Set(result.duplicates.map(pair => pair.duplicate.key));
  const selected = files.map((file, fileIndex) => ({ ...file, pageIndices: result.labels.filter(label => label.fileIndex === fileIndex && !removed.has(label.key)).map(label => label.pageIndex) }));
  const output = await buildFourInOnePdf(selected);
  assert.equal(output.slipCount, 7);
  assert.equal(output.pageCount, 2);
});

test("mixed uploads: three independent marketplaces, same filenames and shared AWB do not cross-match", async () => {
  const unique = ["Amazon", "Flipkart", "Meesho"].map(marketplace => sample(marketplace, 1, { awb: "SHARED1234567" }));
  const files = [
    { name: "labels.pdf", bytes: await labelPdf(unique) },
    { name: "labels.pdf", bytes: await labelPdf([...unique].reverse()) },
  ];
  const { duplicates } = await analyze(files);
  assert.equal(duplicates.length, 3);
  assert.deepEqual(duplicates.map(pair => pair.duplicate.marketplace).sort(), ["Amazon", "Flipkart", "Meesho"]);
});

test("Meesho reference: recognize unbranded Valmo label and its table sub-order", async () => {
  const bytes = new Uint8Array(await readFile(new URL("../reference-files/sample-shipping-label.pdf", import.meta.url)));
  const files = [{ name: "original.pdf", bytes }, { name: "renamed.pdf", bytes }];
  const { labels, duplicates } = await analyze(files);
  assert.equal(labels[0].marketplace, "Meesho");
  assert.equal(labels[0].awb, "VL0085015831003");
  assert.equal(labels[0].orderId, "316139989473624768");
  assert.equal(labels[0].subOrderId, "3161399894736247681");
  assert.equal(duplicates.length, 1);
});

test("real Amazon packing slip/invoice: order alone is not a shipment duplicate", async () => {
  for (const filename of ["Amazon.pdf", "amazon-invoice-regression.pdf"]) {
    const bytes = new Uint8Array(await readFile(new URL(`../reference-files/${filename}`, import.meta.url)));
    const { labels, duplicates } = await analyze([{ name: filename, bytes }, { name: "copy.pdf", bytes }]);
    assert.ok(labels.every(label => label.marketplace === "Amazon"));
    assert.equal(duplicates.length, 0);
    assert.ok(labels.every(label => !label.comparable));
  }
});

test("unreadable, ambiguous and order-only formats remain unflagged", () => {
  for (const text of ["", "Amazon\nOrder ID: 408-1234567-0000001", "Flipkart\nOrder ID: OD1234567890123456", "Meesho\nAWB: FIRST123456\nAWB: SECOND123456"]) {
    const identity = parseLabelIdentity(text);
    assert.equal(identity.comparable, false);
    assert.equal(findDuplicateLabels([identity, identity]).length, 0);
  }
});

test("Meesho sub-orders are distinct and only match without stronger shipment identifiers on both copies", () => {
  const first = parseLabelIdentity("Meesho\nSub Order ID: 316139989473624768_1");
  const copy = parseLabelIdentity("Meesho\nSub-Order No: 316139989473624768-1");
  const other = parseLabelIdentity("Meesho\nSub Order ID: 316139989473624768_2");
  assert.equal(sameShipment(first, copy), true);
  assert.equal(sameShipment(first, other), false);
});

test("partial identifiers cannot transitively merge conflicting shipments", () => {
  const labels = [
    "Amazon\nAWB: AWB1234567\nShipment ID: SHIP111111",
    "Amazon\nAWB: AWB1234567",
    "Amazon\nAWB: AWB1234567\nShipment ID: SHIP222222",
  ].map(parseLabelIdentity);
  assert.equal(findDuplicateLabels(labels).length, 1);
});

test("Meesho courier variants: isolated tracking number and shared Ekart carrier do not imply Flipkart", () => {
  for (const carrier of ["Delhivery", "Xpressbees", "Shadowfax"]) {
    const label = parseLabelIdentity(`Meesho\n${carrier}\n12345678901234\nProduct Details\nOrder No.\n316139989473624768_1`);
    assert.equal(label.marketplace, "Meesho");
    assert.equal(label.awb, "12345678901234");
    assert.equal(sameShipment(label, label), true);
  }
  const label = parseLabelIdentity("Customer Address\nE-Kart Logistics\nProduct Details\nOrder No. 316139989473624768_1\nAWB: FMPC123456789");
  assert.equal(label.marketplace, "Meesho");
  const phoneOnly = parseLabelIdentity("Meesho\nDelhivery\n9876543210\nOrder ID: 316139989473624768");
  assert.equal(phoneOnly.comparable, false);
});

test("tracking normalization handles case, hyphens, Unicode spacing and broken numeric groups", () => {
  const original = parseLabelIdentity("Amazon\nAWB: TBA123456789012");
  for (const value of ["tba-123456789012", "TBA 123 456 789 012", "TBA  123  456  789  012", "TBA - 123456789012", "TBA\u00a0123456789012", "T B A 1 2 3 4 5 6 7 8 9 0 1 2"]) {
    const copy = parseLabelIdentity(`Amazon\nTracking ID: ${value}`);
    assert.equal(copy.awb, original.awb, value);
    assert.equal(sameShipment(original, copy), true, value);
  }
});

test("page selection rejects invalid indices and leaves original bytes untouched", async () => {
  const bytes = await labelPdf([sample("Amazon"), sample("Flipkart")]);
  const before = bytes.slice();
  await assert.rejects(buildFourInOnePdf([{ name: "test.pdf", bytes, pageIndices: [2] }]), { code: "INVALID_SELECTION" });
  const selected = await buildFourInOnePdf([{ name: "test.pdf", bytes, pageIndices: [1] }]);
  assert.equal(selected.slipCount, 1);
  assert.deepEqual(bytes, before);
});

async function realMeeshoFiles() {
  const directory = new URL("./fixtures/shipping-labels/meesho-real/", import.meta.url);
  const names = (await readdir(directory)).filter(name => name.endsWith(".pdf")).sort();
  return Promise.all(names.map(async name => ({ name, bytes: new Uint8Array(await readFile(new URL(name, directory))) })));
}

async function realFlipkartFiles() {
  const directory = new URL("./fixtures/shipping-labels/flipkart-real/", import.meta.url);
  const names = (await readdir(directory)).filter(name => name.endsWith(".pdf")).sort();
  return Promise.all(names.map(async name => ({ name, bytes: new Uint8Array(await readFile(new URL(name, directory))) })));
}

test("supplied Amazon 001_invoice: recognize order, preserve export, never infer shipment duplicates from an invoice alone", async () => {
  const bytes = new Uint8Array(await readFile(new URL("./fixtures/shipping-labels/amazon-real/001_invoice.pdf", import.meta.url)));
  const files = [{ name: "001_invoice.pdf", bytes }, { name: "renamed-invoice.pdf", bytes }];
  const { labels, duplicates } = await analyze(files);
  assert.equal(labels.length, 2);
  for (const label of labels) {
    assert.equal(label.marketplace, "Amazon");
    assert.equal(label.orderId, "40599969414020322");
    assert.equal(label.awb, "");
    assert.equal(label.shipmentId, "");
    assert.equal(label.comparable, false);
  }
  assert.equal(duplicates.length, 0);
  const before = bytes.slice();
  const output = await buildFourInOnePdf(files);
  assert.equal(output.slipCount, 2);
  assert.equal(output.pageCount, 1);
  assert.deepEqual(bytes, before);
});

test("supplied Flipkart labels: five distinct shipments; renamed and rewritten copies detected across files and pages", async () => {
  const originals = await realFlipkartFiles();
  assert.equal(originals.length, 5);
  const originalAnalysis = await analyze(originals);
  assert.equal(originalAnalysis.labels.length, 5);
  assert.equal(originalAnalysis.duplicates.length, 0);
  assert.ok(originalAnalysis.labels.every(label => label.marketplace === "Flipkart" && label.comparable && label.orderId && label.awb));
  assert.equal(new Set(originalAnalysis.labels.map(label => label.awb)).size, 5);
  const copies = [];
  for (const [index, file] of originals.entries()) {
    const rewritten = await PDFDocument.load(file.bytes);
    rewritten.setTitle("Reprinted shipping label");
    copies.push({ name: `renamed-${index}.pdf`, bytes: await rewritten.save({ useObjectStreams: false }) });
  }
  const files = [...originals, ...copies];
  const { labels, duplicates } = await analyze(files);
  assert.equal(labels.length, 10);
  assert.equal(duplicates.length, 5);
  const excluded = new Set(duplicates.map(pair => pair.duplicate.key));
  const selected = await buildFourInOnePdf(files.map((file, fileIndex) => ({ ...file, pageIndices: excluded.has(`${fileIndex}:0`) ? [] : [0] })));
  assert.equal(selected.slipCount, 5);
  assert.equal(selected.pageCount, 2);
  const exported = await pdfjs.getDocument({ data: selected.bytes.slice(), verbosity: 0 }).promise;
  const exportedText = [];
  for (let page = 1; page <= exported.numPages; page++) {
    const content = await (await exported.getPage(page)).getTextContent();
    exportedText.push(content.items.map(item => item.str).join(" "));
  }
  for (const label of originalAnalysis.labels) assert.ok(exportedText.join(" ").includes(label.awb));
  await exported.destroy();
  const originalsOnly = await buildFourInOnePdf(originals);
  assert.deepEqual(selected.bytes, originalsOnly.bytes);
  const combined = await PDFDocument.create();
  for (const file of files) {
    const source = await PDFDocument.load(file.bytes);
    const [page] = await combined.copyPages(source, [0]);
    combined.addPage(page);
  }
  const withinFile = await analyze([{ name: "flipkart-combined.pdf", bytes: await combined.save({ useObjectStreams: false }) }]);
  assert.equal(withinFile.labels.length, 10);
  assert.equal(withinFile.duplicates.length, 5);
});

test("mixed real Flipkart/Meesho and Amazon labels: one repeat per marketplace, no cross-marketplace matches", async () => {
  const flipkart = await realFlipkartFiles();
  const meesho = await realMeeshoFiles();
  const amazon = { name: "amazon-shipment.pdf", bytes: await labelPdf([sample("Amazon")]) };
  const files = [...flipkart, ...meesho, amazon, ...[flipkart[0], meesho[0], amazon].map(file => ({ ...file, name: `duplicate-${file.name}` }))];
  const { labels, duplicates } = await analyze(files);
  assert.equal(labels.length, 20);
  assert.equal(duplicates.length, 3);
  assert.deepEqual(duplicates.map(pair => pair.duplicate.marketplace).sort(), ["Amazon", "Flipkart", "Meesho"]);
});

test("supplied Meesho files: 11 unique orders, all courier AWBs extracted, zero false duplicates", async () => {
  const files = await realMeeshoFiles();
  assert.equal(files.length, 11);
  const { labels, duplicates } = await analyze(files);
  assert.equal(labels.length, 11);
  assert.equal(duplicates.length, 0);
  assert.equal(new Set(labels.map(label => label.orderId)).size, 11);
  assert.equal(new Set(labels.map(label => label.awb)).size, 11);
  assert.ok(labels.every(label => label.marketplace === "Meesho" && label.comparable && label.awb && label.subOrderId));
  assert.equal(labels.filter(label => /^SF\d+(?:FPL|MEL)$/.test(label.awb)).length, 6);
  assert.equal(labels.filter(label => /^VL\d+$/.test(label.awb)).length, 2);
  assert.equal(labels.filter(label => /^\d+$/.test(label.awb)).length, 3);
  const kept = await buildFourInOnePdf(files);
  assert.equal(kept.slipCount, 11);
  assert.equal(kept.pageCount, 3);
  const repeated = await analyze([...files, ...files.map(file => ({ ...file, name: `renamed-${file.name}` }))]);
  assert.equal(repeated.duplicates.length, 11);
});

test("real Meesho fixture scenario: seven supplied originals plus three copies, across files and within one PDF", async () => {
  const originals = (await realMeeshoFiles()).slice(0, 7);
  const files = [...originals, ...originals.slice(0, 3).map(file => ({ ...file, name: `copy-${file.name}` }))];
  const { labels, duplicates } = await analyze(files);
  assert.equal(labels.length, 10);
  assert.equal(duplicates.length, 3);
  const excluded = new Set(duplicates.map(pair => pair.duplicate.key));
  const output = await buildFourInOnePdf(files.map((file, fileIndex) => ({ ...file, pageIndices: excluded.has(`${fileIndex}:0`) ? [] : [0] })));
  assert.equal(output.slipCount, 7);
  assert.equal(output.pageCount, 2);
  const combined = await PDFDocument.create();
  for (const file of files) {
    const source = await PDFDocument.load(file.bytes);
    const [page] = await combined.copyPages(source, [0]);
    combined.addPage(page);
  }
  const multiPage = await analyze([{ name: "ten-meesho-labels.pdf", bytes: await combined.save({ useObjectStreams: false }) }]);
  assert.equal(multiPage.labels.length, 10);
  assert.equal(multiPage.duplicates.length, 3);
});
