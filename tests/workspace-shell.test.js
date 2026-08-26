import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared workspace chrome covers every protected product family", async () => {
  const source = await read("src/scripts/workspace-sidebar.js");
  for (const name of ["Finance & Accounting", "Sales & CRM", "Purchases & Procurement", "Inventory & Warehouse", "HR & Payroll", "Projects & Operations", "Documents", "Internal Requests", "Banking", "Reports & Analytics", "Administration", "GST Workspace"]) assert.match(source, new RegExp(name.replace(/[&]/g, "\\&")));
  assert.match(source, /brand\.replaceWith\(replacement\)/);
  assert.match(source, /Back to main page/);
  assert.match(source, /href="\/index\.html"/);
  assert.match(source, /Company profile incomplete/);
});

test("build injects the shared workspace chrome into protected outputs", async () => {
  const build = await read("build.js");
  assert.match(build, /withWorkspaceChrome\(html\)/);
  assert.match(build, /withWorkspaceChrome\(inventoryWorkspacePage\(\)\)/);
  assert.match(build, /withWorkspaceChrome\(hrPayrollWorkspacePage\(\)/);
  assert.match(build, /src\/country/);
  assert.match(build, /src\/export/);
});

test("Administration catches module graph startup failures instead of spinning forever", async () => {
  const source = await read("src/pages/app/administration-workspace.js");
  assert.match(source, /import\("\/administration-workspace\/app\.js"\)\.catch\(showAdministrationError\)/);
  assert.match(source, /Administration could not load/);
});

test("workspace startup preloads one owner-scoped module result instead of querying every collection", async () => {
  const source = await read("src/supabase/workspace.js");
  const context = await read("src/company/context.js");
  assert.match(source, /select\("collection, record_id, data"\)/);
  assert.match(source, /return \[\.\.\.collectionCache\(collection\)\.values\(\)\]/);
  assert.doesNotMatch(source, /base\(\)\.eq\("collection"/);
  assert.match(source, /resolveCurrentCompanyContext\(\)/);
  assert.match(context, /globalThis\.InfoBridgeUser/);
  assert.match(context, /globalThis\.InfoBridgeCompany/);
});

test("Projects and Documents render non-interactive sidebar brands in source", async () => {
  const projects = await read("src/pages/app/modules.js");
  const documents = await read("src/pages/app/documents-workspace.js");
  assert.match(projects, /<div class="projects-brand" data-workspace-brand/);
  assert.match(documents, /<div class="documents-brand" data-workspace-brand/);
  assert.doesNotMatch(documents, /documents-brand" href=/);
});

test("long workspace navigation scrolls without pushing the shared footer off screen", async () => {
  const styles = await read("src/styles/workspace-sidebar.css");
  assert.match(styles, />nav\{min-height:0;overflow-y:auto/);
  assert.match(styles, /\.workspace-sidebar-footer\{position:relative;z-index:2;flex:none;margin-top:auto/);
});
