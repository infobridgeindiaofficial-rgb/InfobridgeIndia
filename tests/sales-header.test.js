import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/sales/app.js", import.meta.url), "utf8");
const sharedHeader = source.slice(source.indexOf("function shell(body)"), source.indexOf("const head="));

test("Sales shared header contains only navigation toggle and global search", () => {
  assert.match(sharedHeader, /data-menu/);
  assert.match(sharedHeader, /data-search/);
  assert.doesNotMatch(sharedHeader, /Add Lead|Create Invoice|data-new=/);
});

test("Sales page-specific actions remain available", () => {
  assert.match(source, /data-new="lead">Add Lead/);
  assert.match(source, /data-new="customer">Add Customer/);
  assert.match(source, /data-new="activity">Add Activity/);
  assert.match(source, /data-new="\$\{kind\}">Create \$\{kind\}/);
  assert.match(source, /orders:\["Sales Orders"/);
  assert.match(source, /data-new="service"/);
  assert.match(source, /data-quotation-country="AE">UAE Quotation/);
  assert.match(source, /data-quotation-country="IN">India Quotation/);
});
