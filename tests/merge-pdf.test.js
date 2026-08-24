import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { isPdfFile, hasPdfSignature, formatSize, classifyPdfLoadError } from "../src/merge-pdf/core.js";

async function makePdf(labels) { const pdf = await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica); for (const label of labels) { const page = pdf.addPage([300, 200]); page.drawText(label, { x: 30, y: 100, size: 20, font, color: rgb(0, 0, 0) }); } return pdf.save(); }
async function merge(inputs) { const output = await PDFDocument.create(); for (const bytes of inputs) { const source = await PDFDocument.load(bytes); const pages = await output.copyPages(source, source.getPageIndices()); pages.forEach((page) => output.addPage(page)); } return output.save(); }

test("accepts PDF files and rejects unsupported files", () => { assert.equal(isPdfFile({ name: "one.PDF", type: "" }), true); assert.equal(isPdfFile({ name: "one.pdf", type: "application/pdf" }), true); assert.equal(isPdfFile({ name: "one.txt", type: "text/plain" }), false); });
test("validates the PDF signature", () => { assert.equal(hasPdfSignature(new TextEncoder().encode("%PDF-1.7")), true); assert.equal(hasPdfSignature(new TextEncoder().encode("not pdf")), false); });
test("classifies encrypted errors separately", () => { assert.equal(classifyPdfLoadError(new Error("Input document is encrypted")), "ENCRYPTED"); assert.equal(classifyPdfLoadError(new Error("Invalid PDF structure")), "CORRUPTED"); });
test("formats file sizes", () => assert.equal(formatSize(3 * 1024 * 1024), "3.00 MB"));
test("merges two PDFs while preserving every page", async () => { const output = await PDFDocument.load(await merge([await makePdf(["A1", "A2"]), await makePdf(["B1"])])); assert.equal(output.getPageCount(), 3); });
test("merges three PDFs in displayed file order", async () => { const first = await makePdf(["FIRST"]), second = await makePdf(["SECOND-1", "SECOND-2"]), third = await makePdf(["THIRD"]); const output = await PDFDocument.load(await merge([third, first, second])); assert.equal(output.getPageCount(), 4); assert.deepEqual(output.getPages().map((page) => page.getSize()), [{ width: 300, height: 200 }, { width: 300, height: 200 }, { width: 300, height: 200 }, { width: 300, height: 200 }]); });
