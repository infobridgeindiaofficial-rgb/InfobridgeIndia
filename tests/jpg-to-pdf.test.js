import test from "node:test";
import assert from "node:assert/strict";
import { isSupportedImage, formatSize, fitInside, detectImageFormat } from "../src/jpg-to-pdf/core.js";

test("accepts JPG, JPEG and PNG but rejects other files", () => {
  assert.equal(isSupportedImage({ name: "photo.JPG", type: "" }), true);
  assert.equal(isSupportedImage({ name: "photo.jpeg", type: "image/jpeg" }), true);
  assert.equal(isSupportedImage({ name: "logo.png", type: "image/png" }), true);
  assert.equal(isSupportedImage({ name: "notes.txt", type: "text/plain" }), false);
});

test("fits portrait and landscape images without changing aspect ratio", () => {
  const portrait = fitInside(1000, 2000, 190, 277);
  const landscape = fitInside(2000, 1000, 277, 190);
  assert.equal(portrait.width / portrait.height, 0.5);
  assert.equal(landscape.width / landscape.height, 2);
  assert.ok(portrait.width <= 190 && portrait.height <= 277);
  assert.ok(landscape.width <= 277 && landscape.height <= 190);
});

test("formats image sizes for the UI", () => assert.equal(formatSize(2 * 1024 * 1024), "2.00 MB"));

test("detects real PNG and JPEG bytes instead of trusting an extension", () => {
  assert.equal(detectImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "PNG");
  assert.equal(detectImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])), "JPEG");
  assert.equal(detectImageFormat(new Uint8Array([0x50, 0x44, 0x46, 0x2d, 0, 0, 0, 0])), null);
});
