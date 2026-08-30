import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sidebarScrollStorageKey, visibleSidebarScrollTop } from "../src/scripts/workspace-sidebar-scroll.js";

test("active sidebar items already in view do not change scroll position", () => {
  assert.equal(visibleSidebarScrollTop(300, 500, 420, 44), 300);
});

test("active sidebar items outside the viewport move only enough to become visible", () => {
  assert.equal(visibleSidebarScrollTop(300, 500, 900, 44), 444);
  assert.equal(visibleSidebarScrollTop(300, 500, 120, 44), 120);
});

test("sidebar scroll state is isolated per workspace module", () => {
  assert.notEqual(sidebarScrollStorageKey("Finance & Accounting"), sidebarScrollStorageKey("Reports & Analytics"));
  assert.notEqual(sidebarScrollStorageKey("Import & Export"), sidebarScrollStorageKey("Settings"));
});

test("every authenticated product page loads the shared sidebar behavior", () => {
  const pages = ["finance", "sales", "purchases", "inventory", "hr/index", "hr/payroll", "banking", "reports", "projects", "documents", "approvals", "admin", "settings", "import-export"];
  for (const page of pages) {
    const source = readFileSync(new URL(`../app/${page}.html`, import.meta.url), "utf8");
    assert.match(source, /\/scripts\/workspace-sidebar\.js/, page);
  }
});

test("shared sidebar captures scroll and navigation before workspace rerenders", () => {
  const source = readFileSync(new URL("../src/scripts/workspace-sidebar.js", import.meta.url), "utf8");
  assert.match(source, /document\.addEventListener\("scroll"[\s\S]+true\)/);
  assert.match(source, /document\.addEventListener\("click"[\s\S]+true\)/);
  assert.match(source, /restoreSidebarScroll\(sidebar\)/);
  assert.doesNotMatch(source, /scrollIntoView/);
});
