import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shared = readFileSync(new URL("../src/styles/workspace-sidebar.css", import.meta.url), "utf8");
const hr = readFileSync(new URL("../src/hr-payroll/styles.css", import.meta.url), "utf8");
const components = readFileSync(new URL("../src/styles/components.css", import.meta.url), "utf8");

test("shared authenticated sidebars use the current HR desktop width", () => {
  assert.match(hr, /--sidebar:248px/);
  assert.match(shared, /--workspace-sidebar-width:248px/);
  assert.match(shared, /flex:0 0 var\(--workspace-sidebar-width\)/);
  assert.doesNotMatch(shared, /245px/);
  assert.match(shared, /@media\(max-width:820px\)\{:root\{--workspace-sidebar-width:260px\}\}/);
  assert.match(shared, /@media\(min-width:821px\)\{\.app-sidebar\{position:sticky;left:auto;transform:none\}\}/);
});

test("authenticated sidebar links neutralize the generic 68px nav-link height", () => {
  assert.match(components, /\.nav-link\s*\{[^}]*height:\s*var\(--header-h\)/);
  assert.match(shared, />nav :is\(\.nav-link,\.side-link\)\{[^}]*height:auto;min-height:38px/);
});

test("shared sidebar header, title, and navigation metrics match HR", () => {
  for (const metric of ["height:70px", "padding:8px 20px", "height:48px", "padding:18px 20px 12px", "min-height:38px", "gap:11px", "padding:10px 12px", "border-radius:8px", "margin:2px 0", "font-size:14px", "line-height:18px", "width:18px", "height:18px"]) {
    assert.match(shared, new RegExp(metric.replace(/[()]/g, "\\$&")), metric);
  }
});

test("HR glyph icons and module SVG icons occupy the same 18px alignment slot", () => {
  assert.match(shared, />span:first-child\{width:18px;height:18px;display:grid;place-items:center;flex:none;line-height:18px;text-align:center\}/);
  assert.match(shared, /:is\(\.nav-link,\.side-link\) svg\{width:18px;height:18px;flex:none/);
});

test("wrapped module labels retain HR line height without horizontal clipping", () => {
  assert.match(shared, />svg\+span\{min-width:0;line-height:18px;overflow-wrap:anywhere\}/);
  assert.match(shared, />nav\{[^}]*overflow-y:auto;overflow-x:hidden/);
});

test("long sidebars scroll only their navigation area and retain a stable footer", () => {
  assert.match(shared, />nav\{min-height:0;overflow-y:auto;overflow-x:hidden/);
  assert.match(shared, /scrollbar-gutter:stable/);
  assert.match(shared, /\.workspace-sidebar-footer\{[^}]*flex:none/);
  assert.match(shared, /\.workspace-standard-page \.projects-workspace-main,.workspace-standard-page \.documents-main\{margin-left:var\(--workspace-sidebar-width\)\}/);
});

test("all authenticated sidebar shapes are covered by the shared selectors", () => {
  assert.match(shared, /:is\(\.sidebar,\.gst-sidebar,\.app-sidebar,\.workspace-sidebar\)/);
  assert.match(shared, /:is\(\.nav-link,\.side-link\)/);
});
