import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("HR startup awaits persisted workspace hydration before rendering",()=>{
  const hr=read("src/hr-payroll/app.js"),workspace=read("src/supabase/workspace.js");
  assert.match(hr,/async function openDb\(\)\{store=await createWorkspaceStore\("hr-payroll"\)\}/);
  assert.match(hr,/await openDb\(\);await recoverPersistedFallback\(\);await migrateDepartments\(\);await load\(\);await ensureHrSettings\(\);await repairStoredDraftPayrollPeriods\(\);render\(\)/);
  assert.doesNotMatch(hr,/Promise\.race\(\[createWorkspaceStore\("hr-payroll"\)/);
  assert.match(workspace,/await client\.from\("workspace_records"\)\.select\("collection, record_id, data"\)/);
  assert.match(workspace,/if \(initialError\) throw initialError;/);
});

test("refresh hydration includes persisted employees and attendance without empty-state replacement",()=>{
  const workspace=read("src/supabase/workspace.js");
  const queryIndex=workspace.indexOf('select("collection, record_id, data")');
  const cacheIndex=workspace.indexOf("const collections = new Map()",queryIndex);
  const returnIndex=workspace.indexOf("return {",cacheIndex);
  assert.ok(queryIndex>=0&&cacheIndex>queryIndex&&returnIndex>cacheIndex,"cloud rows must hydrate the cache before the store is exposed");
  assert.match(workspace,/collectionCache\(collection\)\.set\(String\(value\.id\), value\)/);
  assert.doesNotMatch(workspace,/initialRows\s*=\s*\[\]/);
});

test("an unloaded or failed company read cannot be treated as an empty new company",()=>{
  const gate=read("src/scripts/auth-gate.js");
  const errorCheck=gate.indexOf("isProtectedRoute(safePath) && companyLoadError");
  const setupRedirect=gate.indexOf("isProtectedRoute(safePath) && !profile");
  assert.ok(errorCheck>=0&&setupRedirect>errorCheck,"company read errors must stop before setup/default routing");
  assert.match(gate,/Nothing was reset or overwritten/);
});

test("rapid workspace state saves are serialized per company record",()=>{
  const workspace=read("src/supabase/workspace.js");
  assert.match(workspace,/const previous = pending\.get\(key\) \|\| Promise\.resolve\(\)/);
  assert.match(workspace,/previous\.catch\(\(\) => \{\}\)\.then/);
  assert.match(workspace,/if \(pending\.get\(key\) === operation\) pending\.delete\(key\)/);
});
