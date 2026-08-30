import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../src/administration/styles.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/administration/app.js", import.meta.url), "utf8");

test("Edit Permissions header stays sticky inside its two-axis scroll container", () => {
  assert.match(styles, /\.permission-wrap\{overflow:auto;max-height:58vh\}/);
  assert.match(styles, /\.permission-table th\{position:sticky;top:0;z-index:3;background:#fafbfc\}/);
});

test("sticky Module corner remains above both header and first-column cells", () => {
  assert.match(styles, /\.permission-table th:first-child,.permission-table td:first-child\{[^}]*position:sticky;left:0;[^}]*z-index:2\}/);
  assert.match(styles, /\.permission-table th:first-child\{z-index:4;background:#fafbfc\}/);
});

test("permissions modal keeps the existing scroll wrapper and unchanged modal footer actions", () => {
  assert.match(app, /<div class="permission-wrap"><table class="permission-table">/);
  assert.match(app, /readonly\|\|fixed\?"Close":"Save Permissions"/);
  assert.match(app, /<button type="button" class="btn secondary" data-close>Cancel<\/button>/);
});
