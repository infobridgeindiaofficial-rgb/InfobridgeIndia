import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import vm from "node:vm";
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { buildFourInOnePdf, getPageCount } from "../src/shipping-label-4in1/core.js";
import { extractLabelIdentities, findDuplicateLabels } from "../src/shipping-label-4in1/duplicates.js";
import { shippingLabel4in1PageHtml } from "../src/pages/marketing/shipping-label-4in1.js";
import { courierCounts, compareCouriers, UNKNOWN_COURIER } from "../src/shipping-label-4in1/couriers.js";

class Element {
  constructor() {
    this.style = {};
    this.dataset = {};
    this.listeners = {};
    this.classList = { add() {}, remove() {} };
    this.textContent = "";
  }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  removeAttribute(name) { delete this[name]; }
  click() { return this.listeners.click?.({ target: this }); }
  remove() {}
  focus() {}
  set innerHTML(html) {
    this.html = html;
    this.buttons = [...html.matchAll(/<button\b([^>]*)>/g)].map(match => {
      const element = new Element();
      for (const data of match[1].matchAll(/data-([\w-]+)="([^"]*)"/g)) element.dataset[data[1]] = data[2];
      return element;
    });
  }
  get innerHTML() { return this.html || ""; }
  querySelectorAll(selector) {
    return (this.buttons || []).filter(button => selector === "[data-duplicate]" ? button.dataset.duplicate !== undefined : button.dataset.id !== undefined);
  }
}

async function harness({ failIdentityExtraction = false, grouped = false } = {}) {
  const elements = new Map([...shippingLabel4in1PageHtml().matchAll(/id="(sl4-[^"]+)"/g)].map(match => [match[1], new Element()]));
  const blobs = new Map();
  const downloads = [];
  class LocalURL extends URL {
    static createObjectURL(blob) { const url = `blob:test-${blobs.size}`; blobs.set(url, blob); return url; }
    static revokeObjectURL() {}
  }
  const source = (await readFile(new URL("../src/shipping-label-4in1/app.js", import.meta.url), "utf8")).replace(/^import .*;\r?\n/gm, "");
  const controller = vm.runInNewContext(source + "\n({ addFiles, removeItem, resetAll, generate, totals, getItems: () => items, getPreview: () => previewBlobUrl, getResult: () => resultBlobUrl, previewReady: () => !$(\"sl4-preview-frame\").hidden })", {
    document: { getElementById: id => { assert.ok(elements.has(id), id); return elements.get(id); }, createElement: tag => { const element = new Element(); if (tag === "a") downloads.push(element); return element; }, body: { appendChild() {} } },
    URL: LocalURL, Blob, console, Uint8Array,
    buildFourInOnePdf, getPageCount, findDuplicateLabels, courierCounts, compareCouriers, UNKNOWN_COURIER,
    extractLabelIdentities: bytes => {
      if (failIdentityExtraction) throw new Error("Simulated identifier extraction failure");
      return extractLabelIdentities(bytes, pdfjs);
    },
  });
  if (!grouped) elements.get("sl4-sort-order").value = "original";
  return { controller, elements, blobs, downloads };
}

async function upload(name, labels) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const label of labels) {
    const page = document.addPage([300, 400]);
    page.drawText(`Meesho\nOrder ID: 316139989473624768\nSub Order ID: 316139989473624768_${label}\nAWB: VL1234567890${label}`, { x: 10, y: 350, size: 10, font });
  }
  const bytes = await document.save({ useObjectStreams: false });
  return { name, size: bytes.length, type: "application/pdf", arrayBuffer: async () => bytes.slice().buffer };
}

async function previewReady(controller, blobs, expectedCount) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const blob = blobs.get(controller.getPreview());
    if (blob && controller.previewReady() && await getPageCount(await blob.arrayBuffer()) === Math.ceil(expectedCount / 4)) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail("Preview did not finish");
}

test("compact right-side review: keep clears actions, remove hides the duplicate card and updates preview/export", async () => {
  const { controller, elements, blobs } = await harness();
  await controller.addFiles([await upload("original.pdf", [1, 2, 3, 4]), await upload("copy<test>.pdf", [1])]);
  assert.equal(controller.totals().slipCount, 5);
  assert.equal(elements.get("sl4-generate-btn").disabled, true);
  assert.match(elements.get("sl4-duplicate-summary").textContent, /1 duplicate found · 1 awaiting review/);
  assert.match(elements.get("sl4-file-list").innerHTML, /copy&lt;test&gt;\.pdf/);
  const cards = [...elements.get("sl4-file-list").innerHTML.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(match => match[1]);
  assert.doesNotMatch(cards[0], /sl4-duplicate-badge/);
  assert.match(cards[0], /Original label · Page 1/);
  assert.match(cards[1], /sl4-duplicate-badge/);
  assert.match(cards[1], /Meesho/);
  assert.match(cards[1], /Order ID: 316139989473624768/);
  assert.match(cards[1], /Original: original\.pdf · Page 1/);
  assert.match(cards[1], /sl4-card-review[\s\S]*?>Remove<\/button>[\s\S]*?>Keep<\/button>/);
  assert.doesNotMatch(cards[1], /Sub Order ID:|AWB \/ Tracking:|Choose whether/);
  await controller.generate();
  assert.equal(controller.getResult(), null);
  const keep = elements.get("sl4-file-list").buttons.find(button => button.dataset.choice === "keep");
  keep.click();
  assert.equal(controller.totals().slipCount, 5);
  assert.equal(elements.get("sl4-generate-btn").disabled, false);
  assert.match(elements.get("sl4-duplicate-summary").textContent, /0 awaiting review/);
  assert.doesNotMatch(elements.get("sl4-file-list").innerHTML, /sl4-duplicate-badge/);
  assert.equal(elements.get("sl4-file-list").buttons.filter(button => button.dataset.choice).length, 0);
  await controller.generate();
  assert.equal(await getPageCount(await blobs.get(controller.getResult()).arrayBuffer()), 2);
  await controller.addFiles([await upload("remove-this.pdf", [2])]);
  const remove = elements.get("sl4-file-list").buttons.find(button => button.dataset.choice === "remove");
  remove.click();
  assert.equal(controller.getResult(), null);
  assert.equal(controller.totals().slipCount, 5);
  assert.equal(controller.totals().fileCount, 2);
  assert.doesNotMatch(elements.get("sl4-file-list").innerHTML, /remove-this\.pdf/);
  assert.equal(elements.get("sl4-summary-slips").textContent, "5");
  assert.equal(elements.get("sl4-summary-pages").textContent, "2");
  assert.equal(elements.get("sl4-preview-count").textContent, "5 labels");
  await previewReady(controller, blobs, 5);
  await controller.generate();
  assert.equal(await getPageCount(await blobs.get(controller.getResult()).arrayBuffer()), 2);
  assert.match(elements.get("sl4-success-meta").textContent, /5 shipping slips arranged onto 2 A4 pages/);
});

test("removing the original file reselects the surviving copy; new uploads and reset do not inherit stale decisions", async () => {
  const { controller, elements } = await harness();
  await controller.addFiles([await upload("original.pdf", [1]), await upload("copy.pdf", [1])]);
  elements.get("sl4-file-list").buttons.find(button => button.dataset.choice === "remove").click();
  assert.equal(controller.totals().slipCount, 1);
  controller.removeItem(controller.getItems()[0].id);
  assert.equal(controller.totals().slipCount, 1);
  assert.match(elements.get("sl4-duplicate-summary").textContent, /0 duplicates found/);
  await controller.addFiles([await upload("another.pdf", [1])]);
  assert.equal(elements.get("sl4-generate-btn").disabled, true);
  assert.equal(controller.totals().slipCount, 2);
  controller.resetAll();
  assert.equal(controller.totals().slipCount, 0);
});

test("multi-page duplicate cards: three inline warnings, only duplicate pages excluded, original pages retained", async () => {
  const { controller, elements, blobs } = await harness();
  await controller.addFiles([await upload("originals.pdf", [1, 2]), await upload("mixed.pdf", [1, 3, 2, 4, 1])]);
  assert.equal(controller.totals().slipCount, 7);
  assert.equal(elements.get("sl4-duplicate-summary").textContent, "3 duplicates found · 3 awaiting review");
  const cards = [...elements.get("sl4-file-list").innerHTML.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(match => match[1]);
  assert.doesNotMatch(cards[0], /sl4-duplicate-badge/);
  assert.equal((cards[1].match(/class="sl4-duplicate-info/g) || []).length, 3);
  for (let index = 0; index < 3; index++) {
    elements.get("sl4-file-list").buttons.find(button => button.dataset.choice === "remove" && button.dataset.duplicate === String(index)).click();
  }
  assert.equal(controller.totals().slipCount, 4);
  assert.equal(controller.getItems().length, 2);
  assert.equal(controller.getItems()[1].pageCount, 5);
  assert.match(elements.get("sl4-file-list").innerHTML, /mixed\.pdf/);
  assert.match(elements.get("sl4-file-list").innerHTML, /2 shipping slips selected/);
  assert.doesNotMatch(elements.get("sl4-file-list").innerHTML, /sl4-duplicate-badge/);
  assert.equal(elements.get("sl4-duplicate-summary").textContent, "3 duplicates found · 0 awaiting review · 3 excluded");
  await previewReady(controller, blobs, 4);
  await controller.generate();
  const exported = await pdfjs.getDocument({ data: new Uint8Array(await blobs.get(controller.getResult()).arrayBuffer()), verbosity: 0 }).promise;
  const text = (await (await exported.getPage(1)).getTextContent()).items.map(item => item.str).join(" ");
  for (const label of [1, 2, 3, 4]) assert.equal((text.match(new RegExp(`VL1234567890${label}`, "g")) || []).length, 1);
  assert.equal(exported.numPages, 1);
  await exported.destroy();
});

test("duplicates within one PDF identify the original page and warn only on repeated pages", async () => {
  const { controller, elements } = await harness();
  await controller.addFiles([await upload("same-file.pdf", [1, 1, 2])]);
  const html = elements.get("sl4-file-list").innerHTML;
  assert.match(html, /Original label · Page 1/);
  assert.match(html, /Duplicate · Page 2/);
  assert.match(html, /Original: same-file\.pdf · Page 1/);
  elements.get("sl4-file-list").buttons.find(button => button.dataset.choice === "remove").click();
  assert.equal(controller.totals().slipCount, 2);
});

async function exactFlipkartUpload(name = "shipping-label-cropped (1).pdf") {
  const bytes = new Uint8Array(await readFile(new URL("./fixtures/shipping-labels/flipkart-real/shipping-label-cropped (1).pdf", import.meta.url)));
  return { name, size: bytes.length, type: "application/pdf", arrayBuffer: async () => bytes.slice().buffer };
}

async function verifyFlipkartOutput(blob) {
  const document = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), verbosity: 0 }).promise;
  try {
    assert.equal(document.numPages, 1);
    const page = await document.getPage(1);
    const text = (await page.getTextContent()).items.map(item => item.str).join(" ");
    assert.match(text, /FMPC6624574588/);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context, viewport }).promise;
    const pixels = context.getImageData(0, 0, Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)).data;
    let darkPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] < 100 && pixels[index + 1] < 100 && pixels[index + 2] < 100) darkPixels++;
    }
    assert.ok(darkPixels > 500, `Expected visible label/barcode content in the first A4 slot, found ${darkPixels} dark pixels`);
  } finally {
    await document.destroy();
  }
}

test("exact cropped Flipkart sample: unique label renders in live preview/export, copy uses compact remove/keep review", async () => {
  const { controller, elements, blobs, downloads } = await harness();
  await controller.addFiles([await exactFlipkartUpload()]);
  assert.equal(controller.totals().slipCount, 1);
  assert.equal(controller.getItems()[0].error, null);
  assert.equal(controller.getItems()[0].identities[0].orderId, "OD338884057853775100");
  assert.equal(elements.get("sl4-generate-btn").disabled, false);
  await previewReady(controller, blobs, 1);
  await verifyFlipkartOutput(blobs.get(controller.getPreview()));
  await controller.generate();
  await verifyFlipkartOutput(blobs.get(controller.getResult()));
  elements.get("sl4-download-btn").click();
  assert.equal(downloads.at(-1).href, controller.getResult());
  assert.equal(downloads.at(-1).download, "Shipping-Labels-4-in-1.pdf");
  await controller.addFiles([await exactFlipkartUpload("copy.pdf")]);
  assert.match(elements.get("sl4-duplicate-summary").textContent, /1 duplicate found/);
  assert.match(elements.get("sl4-file-list").innerHTML, /sl4-card-review/);
  elements.get("sl4-file-list").buttons.find(button => button.dataset.choice === "remove").click();
  assert.doesNotMatch(elements.get("sl4-file-list").innerHTML, />copy\.pdf</);
  assert.equal(controller.totals().slipCount, 1);
  await controller.generate();
  await verifyFlipkartOutput(blobs.get(controller.getResult()));
});

test("exact cropped Flipkart sample: failed identifier extraction keeps unique label selected and exportable", async () => {
  const { controller, elements, blobs } = await harness({ failIdentityExtraction: true });
  await controller.addFiles([await exactFlipkartUpload()]);
  assert.equal(controller.totals().slipCount, 1);
  assert.equal(controller.getItems()[0].error, null);
  assert.equal(elements.get("sl4-generate-btn").disabled, false);
  assert.match(elements.get("sl4-file-list").innerHTML, /review manually/);
  assert.doesNotMatch(elements.get("sl4-file-list").innerHTML, /sl4-duplicate-badge/);
  await previewReady(controller, blobs, 1);
  await verifyFlipkartOutput(blobs.get(controller.getPreview()));
  await controller.generate();
  await verifyFlipkartOutput(blobs.get(controller.getResult()));
});

test("courier badges/counts follow selected pages; grouping updates preview/export without changing duplicate choices", async () => {
  const { controller, elements, blobs } = await harness();
  const bytes = new Uint8Array(await readFile(new URL("./fixtures/shipping-labels/meesho-real/Sub_Order_Labels_0e8f7360-81b1-4986-b598-2011efc0c916.pdf", import.meta.url)));
  const shadowfax = { name: "shadowfax.pdf", size: bytes.length, type: "application/pdf", arrayBuffer: async () => bytes.slice().buffer };
  await controller.addFiles([shadowfax, await exactFlipkartUpload(), await exactFlipkartUpload("copy.pdf")]);
  assert.equal(elements.get("sl4-courier-summary").textContent, "Shadowfax: 1 · Ekart: 2");
  assert.match(elements.get("sl4-file-list").innerHTML, /sl4-courier-badge">Shadowfax/);
  elements.get("sl4-sort-order").value = "courier";
  elements.get("sl4-sort-order").listeners.change();
  assert.equal(elements.get("sl4-generate-btn").disabled, true);
  elements.get("sl4-file-list").buttons.find(button => button.dataset.choice === "remove").click();
  assert.equal(elements.get("sl4-courier-summary").textContent, "Shadowfax: 1 · Ekart: 1");
  assert.equal(controller.totals().slipCount, 2);
  await previewReady(controller, blobs, 2);
  await controller.generate();
  for (const url of [controller.getPreview(), controller.getResult()]) {
    const output = await pdfjs.getDocument({ data: new Uint8Array(await blobs.get(url).arrayBuffer()), verbosity: 0 }).promise;
    const text = (await (await output.getPage(1)).getTextContent()).items.map(item => item.str).join(" ");
    assert.ok(text.indexOf("SF4326461166FPL") < text.indexOf("FMPC6624574588"));
    await output.destroy();
  }
  controller.resetAll();
  assert.equal(elements.get("sl4-sort-order").value, "courier");
});

async function realCourierUploads() {
  const files = [];
  for (const folder of ["flipkart-real", "meesho-real", "amazon-real"]) {
    const directory = new URL(`./fixtures/shipping-labels/${folder}/`, import.meta.url);
    for (const name of (await readdir(directory)).filter(name => name.endsWith(".pdf")).sort().reverse()) {
      const bytes = new Uint8Array(await readFile(new URL(name, directory)));
      files.push({ name, bytes, size: bytes.length, type: "application/pdf", arrayBuffer: async () => bytes.slice().buffer });
    }
  }
  return files;
}

test("real samples: default list groups all labels in requested courier order, matching preview/export without blank group sheets", async () => {
  const { controller, elements, blobs } = await harness({ grouped: true });
  assert.equal(elements.get("sl4-sort-order").value, "courier");
  await controller.addFiles(await realCourierUploads());
  const html = elements.get("sl4-file-list").innerHTML;
  const headings = [...html.matchAll(/<h3>([^<]+) <span>(\d+) labels?<\/span><\/h3>/g)].map(match => [match[1], Number(match[2])]);
  assert.deepEqual(headings, [["XpressBees", 2], ["Valmo", 2], ["Shadowfax", 6], ["Delhivery", 1], ["Ekart", 5], ["Unknown Courier", 1]]);
  const expected = controller.getItems().map(item => ({ id: item.id, ...item.identities[0] })).sort((first, second) => compareCouriers(first.courier, second.courier));
  const visibleIds = [...html.matchAll(/<article\b[^>]*data-id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(visibleIds, Array.from(expected, label => label.id));
  await previewReady(controller, blobs, 17);
  await controller.generate();
  for (const url of [controller.getPreview(), controller.getResult()]) {
    const document = await pdfjs.getDocument({ data: new Uint8Array(await blobs.get(url).arrayBuffer()), verbosity: 0 }).promise;
    assert.equal(document.numPages, 5);
    const text = [];
    for (let index = 1; index <= document.numPages; index++) text.push((await (await document.getPage(index)).getTextContent()).items.map(item => item.str).join(" "));
    const combined = text.join(" ");
    const positions = Array.from(expected.filter(label => label.awb), label => combined.indexOf(label.awb));
    assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])));
    await document.destroy();
  }
  elements.get("sl4-sort-order").value = "original";
  elements.get("sl4-sort-order").listeners.change();
  assert.doesNotMatch(elements.get("sl4-file-list").innerHTML, /sl4-courier-group/);
  assert.deepEqual([...elements.get("sl4-file-list").innerHTML.matchAll(/<article\b[^>]*data-id="([^"]+)"/g)].map(match => match[1]), Array.from(controller.getItems(), item => item.id));
});

test("mixed-courier multi-page PDFs split into correctly grouped page cards with working duplicate actions", async () => {
  const originals = await realCourierUploads();
  const document = await PDFDocument.create();
  for (const file of originals) {
    const source = await PDFDocument.load(file.bytes);
    const [page] = await document.copyPages(source, [0]);
    document.addPage(page);
  }
  const bytes = await document.save({ useObjectStreams: false });
  const { controller, elements } = await harness({ grouped: true });
  const upload = name => ({ name, size: bytes.length, type: "application/pdf", arrayBuffer: async () => bytes.slice().buffer });
  await controller.addFiles([upload("mixed.pdf"), upload("copies.pdf")]);
  assert.equal(controller.totals().slipCount, 34);
  assert.equal((elements.get("sl4-file-list").innerHTML.match(/<article\b/g) || []).length, 34);
  assert.match(elements.get("sl4-duplicate-summary").textContent, /16 duplicates found/);
  const remove = elements.get("sl4-file-list").buttons.find(button => button.dataset.choice === "remove" && button.dataset.duplicate === "0");
  remove.click();
  assert.equal(controller.totals().slipCount, 33);
  assert.equal((elements.get("sl4-file-list").innerHTML.match(/<article\b/g) || []).length, 33);
  elements.get("sl4-file-list").buttons.find(button => button.dataset.choice === "keep").click();
  assert.equal(controller.totals().slipCount, 33);
  assert.match(elements.get("sl4-courier-summary").textContent, /Ekart: 9/);
});

test("18 selected labels: combined five-page download and five separate A4 downloads retain grouping, slots and final two labels", async () => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const couriers = ["Ekart", "Valmo", "Xpress Bees", "Shadowfax", "Delhivery", "Ecom Express"];
  for (const index of [...Array.from({ length: 18 }, (_, index) => index), 0]) {
    document.addPage([300, 420]).drawText(`Amazon\n${couriers[index % couriers.length]}\nAWB: TESTAWB${String(index).padStart(8, "0")}\nLABEL${String(index).padStart(3, "0")}`, { x: 15, y: 380, size: 10, font });
  }
  const bytes = await document.save({ useObjectStreams: false });
  const { controller, elements, blobs, downloads } = await harness({ grouped: true });
  await controller.addFiles([{ name: "nineteen-with-one-duplicate.pdf", type: "application/pdf", size: bytes.length, arrayBuffer: async () => bytes.slice().buffer }]);
  elements.get("sl4-file-list").buttons.find(button => button.dataset.choice === "remove").click();
  assert.equal(controller.totals().slipCount, 18);
  await controller.generate();
  assert.equal(elements.get("sl4-download-options").hidden, false);
  assert.equal((elements.get("sl4-download-page").innerHTML.match(/<option /g) || []).length, 5);
  elements.get("sl4-download-btn").click();
  assert.equal(downloads.at(-1).download, "Shipping-Labels-4-in-1.pdf");
  const combined = await pdfjs.getDocument({ data: new Uint8Array(await blobs.get(downloads.at(-1).href).arrayBuffer()), verbosity: 0 }).promise;
  assert.equal(combined.numPages, 5);
  const expected = [2, 8, 14, 1, 7, 13, 3, 9, 15, 4, 10, 16, 0, 6, 12, 5, 11, 17].map(index => `LABEL${String(index).padStart(3, "0")}`);
  for (let pageIndex = 1; pageIndex <= 5; pageIndex++) {
    elements.get("sl4-download-page").value = String(pageIndex);
    await elements.get("sl4-download-page-btn").click();
    const download = downloads.at(-1);
    assert.equal(download.download, `Shipping-Labels-4-in-1-Page-${pageIndex}.pdf`);
    const singleBytes = new Uint8Array(await blobs.get(download.href).arrayBuffer());
    assert.equal(await getPageCount(singleBytes), 1);
    const single = await pdfjs.getDocument({ data: singleBytes, verbosity: 0 }).promise;
    const originalPage = await combined.getPage(pageIndex);
    const singlePage = await single.getPage(1);
    assert.deepEqual(singlePage.view, originalPage.view);
    const originalItems = (await originalPage.getTextContent()).items.filter(item => item.str);
    const singleItems = (await singlePage.getTextContent()).items.filter(item => item.str);
    assert.deepEqual(singleItems.map(item => ({ text: item.str, transform: item.transform })), originalItems.map(item => ({ text: item.str, transform: item.transform })));
    const labels = singleItems.map(item => item.str).join(" ").match(/LABEL\d{3}/g);
    assert.deepEqual(labels, expected.slice((pageIndex - 1) * 4, pageIndex * 4));
    await single.destroy();
  }
  assert.equal(downloads.length, 6);
  await combined.destroy();
  elements.get("sl4-sort-order").value = "original";
  elements.get("sl4-sort-order").listeners.change();
  assert.equal(elements.get("sl4-download-options").hidden, true);
  const previous = downloads.length;
  await elements.get("sl4-download-page-btn").click();
  assert.equal(downloads.length, previous);
});
