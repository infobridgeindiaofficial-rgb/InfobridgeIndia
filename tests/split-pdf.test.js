import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { isPdfFile, hasPdfSignature, parseExtractPages, parseSplitRanges } from "../src/split-pdf/core.js";

async function makePdf(count) { const pdf = await PDFDocument.create(); for (let page = 1; page <= count; page++) pdf.addPage([200 + page, 300 + page]); return pdf.save(); }
async function extract(bytes, pages) { const source = await PDFDocument.load(bytes), output = await PDFDocument.create(); const copied = await output.copyPages(source, pages.map((page) => page - 1)); copied.forEach((page) => output.addPage(page)); return output.save(); }

test("accepts only PDF files and validates the signature", () => { assert.equal(isPdfFile({ name: "file.pdf", type: "application/pdf" }), true); assert.equal(isPdfFile({ name: "file.txt", type: "text/plain" }), false); assert.equal(hasPdfSignature(new TextEncoder().encode("%PDF-1.7")), true); assert.equal(hasPdfSignature(new TextEncoder().encode("hello")), false); });
test("parses extract page 1", () => assert.deepEqual(parseExtractPages("1", 5), [1]));
test("parses extract list 1,3,5", () => assert.deepEqual(parseExtractPages("1,3,5", 5), [1, 3, 5]));
test("parses extract range 1-3", () => assert.deepEqual(parseExtractPages("1-3", 5), [1, 2, 3]));
test("parses combined ranges in requested order", () => assert.deepEqual(parseExtractPages("1-3,5,8-10", 10), [1, 2, 3, 5, 8, 9, 10]));
test("rejects empty, invalid, reversed and out-of-bounds selections", () => { assert.throws(() => parseExtractPages("", 10), /Enter/); assert.throws(() => parseExtractPages("x", 10), /valid page/); assert.throws(() => parseExtractPages("8-3", 10), /first page/); assert.throws(() => parseExtractPages("11", 10), /higher/); });
test("parses separate ranges and filenames", () => assert.deepEqual(parseSplitRanges("1-3,4-7,8-10", 10).map(({ start, end, filename }) => ({ start, end, filename })), [{ start: 1, end: 3, filename: "pages-1-3.pdf" }, { start: 4, end: 7, filename: "pages-4-7.pdf" }, { start: 8, end: 10, filename: "pages-8-10.pdf" }]));
test("rejects an invalid split range", () => { assert.throws(() => parseSplitRanges("3", 10), /valid range/); assert.throws(() => parseSplitRanges("8-3", 10), /first page/); });
test("extracts one page into a valid reopenable PDF", async () => { const output = await PDFDocument.load(await extract(await makePdf(1), [1])); assert.equal(output.getPageCount(), 1); });
test("extracts selected pages into a valid PDF in requested order", async () => { const output = await PDFDocument.load(await extract(await makePdf(5), [5, 1, 3])); assert.deepEqual(output.getPages().map((page) => page.getWidth()), [205, 201, 203]); });
test("split every page creates valid individual PDFs", async () => { const source = await makePdf(4); for (let page = 1; page <= 4; page++) { const output = await PDFDocument.load(await extract(source, [page])); assert.equal(output.getPageCount(), 1); assert.equal(output.getPage(0).getWidth(), 200 + page); } });
test("split by multiple ranges creates valid PDFs with correct page order", async () => { const source = await makePdf(10), ranges = parseSplitRanges("1-3,4-7,8-10", 10); const outputs = await Promise.all(ranges.map((range) => extract(source, range.pages).then((bytes) => PDFDocument.load(bytes)))); assert.deepEqual(outputs.map((pdf) => pdf.getPageCount()), [3, 4, 3]); assert.deepEqual(outputs[1].getPages().map((page) => page.getWidth()), [204, 205, 206, 207]); });
