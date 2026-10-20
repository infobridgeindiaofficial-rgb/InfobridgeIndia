import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { identifyCourier, courierCounts } from "../src/shipping-label-4in1/couriers.js";
import { extractLabelIdentities } from "../src/shipping-label-4in1/duplicates.js";
import { buildFourInOnePdf } from "../src/shipping-label-4in1/core.js";

test("courier names normalize variations; ambiguous names and numeric tracking never become guesses", () => {
  for (const [text, expected] of [["VALMO", "Valmo"], ["Xpress Bees", "XpressBees"], ["XpressBees", "XpressBees"], ["Shadowfax", "Shadowfax"], ["Delhivery", "Delhivery"], ["Ecom Express", "Ecom Express"], ["E-Kart Logistics", "Ekart"], ["Ekart", "Ekart"]]) {
    assert.deepEqual(identifyCourier(text), { courier: expected, courierSource: "printed" });
  }
  assert.equal(identifyCourier("Delhivery", "FMPC6624574588").courier, "Delhivery");
  assert.equal(identifyCourier("", "FMPC6624574588").courier, "Ekart");
  assert.equal(identifyCourier("", "FMPP4315650301").courier, "Ekart");
  assert.equal(identifyCourier("", "VL0085834606660").courier, "Valmo");
  for (const value of ["1490842850354583", "SF4326461166FPL", "TBA123456789", "FMPC123", ""]) assert.equal(identifyCourier("", value).courier, "Unknown Courier");
  assert.equal(identifyCourier("Valmo / Delhivery", "VL0085834606660").courier, "Unknown Courier");
  assert.equal(identifyCourier("Product Details\nValmo toy", "").courier, "Unknown Courier");
});

test("real saved fixtures: all Meesho and Flipkart pages identify couriers; Amazon invoice stays unknown", async () => {
  const labels = [];
  for (const folder of ["meesho-real", "flipkart-real", "amazon-real"]) {
    const directory = new URL(`./fixtures/shipping-labels/${folder}/`, import.meta.url);
    for (const name of (await readdir(directory)).filter(name => name.endsWith(".pdf"))) {
      labels.push(...await extractLabelIdentities(new Uint8Array(await readFile(new URL(name, directory))), pdfjs));
    }
  }
  const counts = Object.fromEntries(courierCounts(labels));
  assert.deepEqual(counts, { Delhivery: 1, Ekart: 5, Shadowfax: 6, Valmo: 2, XpressBees: 2, "Unknown Courier": 1 });
});

test("multi-page mixed marketplaces: grouping is stable, unknowns retained, default order and original PDF bytes preserved", async () => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const input = [
    ["Amazon", "Shadowfax", "MARKER1"], ["Flipkart", "Ekart", "MARKER2"], ["Meesho", "Shadowfax", "MARKER3"],
    ["Amazon", "", "MARKER4"], ["Meesho", "Valmo", "MARKER5"], ["Flipkart", "Delhivery", "MARKER6"],
    ["Meesho", "Xpress Bees", "MARKER7"], ["Amazon", "Ecom Express", "MARKER8"],
  ];
  for (const [marketplace, courier, marker] of input) document.addPage([300, 420]).drawText(`${marketplace}\n${courier}\n${marker}`, { x: 20, y: 350, size: 12, font });
  const bytes = await document.save({ useObjectStreams: false });
  const before = bytes.slice();
  const labels = await extractLabelIdentities(bytes, pdfjs);
  assert.deepEqual(labels.map(label => label.courier), ["Shadowfax", "Ekart", "Shadowfax", "Unknown Courier", "Valmo", "Delhivery", "XpressBees", "Ecom Express"]);
  const files = [{ name: "mixed.pdf", bytes, couriers: labels.map(label => label.courier) }];
  async function markers(result) {
    const output = await pdfjs.getDocument({ data: result.bytes.slice(), verbosity: 0 }).promise;
    const text = [];
    for (let page = 1; page <= output.numPages; page++) text.push((await (await output.getPage(page)).getTextContent()).items.map(item => item.str).join(" "));
    await output.destroy();
    return text.join(" ").match(/MARKER\d/g);
  }
  assert.deepEqual(await markers(await buildFourInOnePdf(files)), ["MARKER1", "MARKER2", "MARKER3", "MARKER4", "MARKER5", "MARKER6", "MARKER7", "MARKER8"]);
  const grouped = await buildFourInOnePdf(files, { groupByCourier: true });
  assert.equal(grouped.slipCount, 8);
  assert.equal(grouped.pageCount, 2);
  assert.deepEqual(await markers(grouped), ["MARKER7", "MARKER5", "MARKER1", "MARKER3", "MARKER6", "MARKER2", "MARKER8", "MARKER4"]);
  const selected = await buildFourInOnePdf([{ ...files[0], pageIndices: [0, 1, 3] }], { groupByCourier: true });
  assert.deepEqual(await markers(selected), ["MARKER1", "MARKER2", "MARKER4"]);
  assert.deepEqual(bytes, before);
});
