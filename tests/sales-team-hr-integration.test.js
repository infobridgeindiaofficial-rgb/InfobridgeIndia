import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/sales/app.js", import.meta.url), "utf8");

test("Add Team Member selects from the shared HR & Payroll employee list instead of a typed name", () => {
  assert.match(app, /function teamModal\(\)/);
  assert.doesNotMatch(app, /field\("name","Name"/);
  assert.match(app, /const available=salesEmployees\.filter\(e=>!state\.team\.some\(m=>String\(m\.employeeId\)===String\(e\.id\)\)\)/);
  assert.match(app, /employeeOptionLabel\(e\)/);
  assert.match(app, /<label class="full">Employee<select name="employeeId" required>/);
});

test("Add Team Member reuses the same eligible Sales/Marketing employee list already used for Add Lead", () => {
  assert.match(app, /eligibleSalesEmployees\(employees,departments\)/);
  assert.match(app, /available=salesEmployees\.filter/);
  assert.doesNotMatch(app, /available=allHrEmployees\.filter/);
});

test("Add Team Member stores the stable HR employee ID via saveTeamMember instead of pushing a raw record", () => {
  assert.match(app, /const d=Object\.fromEntries\(fd\),r=saveTeamMember\(state,d\);persist\(r\.state\)/);
  assert.doesNotMatch(app, /state\.team\.push\(\{\.\.\.Object\.fromEntries\(fd\)/);
});

test("Branch resolves from the HR employee (or shared company branch) and is read-only, not manually typed", () => {
  assert.match(app, /<label class="full">Branch<input data-team-branch value="\$\{esc\(state\.settings\.branch\)\}" readonly>/);
  assert.match(app, /branchField\.value=employee\?\.branch\|\|employee\?\.branchName\|\|employee\?\.location\|\|state\.settings\.branch/);
});

test("Monthly sales target remains an editable field on the Add Team Member form", () => {
  assert.match(app, /field\("target","Monthly sales target","number",0,false,'min="0"'\)/);
});

test("Sales Team roster resolves employee name and designation live from HR records instead of a duplicated employee master", () => {
  assert.match(app, /function teamRoster\(\)\{return salesTeamRoster\(state,allHrEmployees\)\}/);
  const core = readFileSync(new URL("../src/sales/core.js", import.meta.url), "utf8");
  assert.match(core, /export function salesTeamRoster\(state,employees=\[\]\)/);
  assert.match(core, /const employee=member\.employeeId\?employees\.find\(e=>String\(e\.id\)===String\(member\.employeeId\)\):null/);
  assert.match(core, /name:employee\?employeeFullName\(employee\):member\.name\|\|"Unassigned"/);
  assert.match(core, /designation:employee\?\.designation\|\|""/);
});

test("Sales Team roster builder is shared with the Salesperson Performance report instead of being duplicated", () => {
  const reports = readFileSync(new URL("../src/sales/reports.js", import.meta.url), "utf8");
  assert.match(reports, /salesTeamRoster\(state,\s*employees\)/);
});

test("Sales Team metrics use salespersonMetrics (stable ID first, legacy name fallback) instead of hard-coded values", () => {
  assert.match(app, /salespersonMetrics\(state,\{employeeId:person\.employeeId,name:person\.name\}\)/);
  assert.doesNotMatch(app, /state\.invoices\.filter\(x=>x\.assignedSalesperson===n\)/);
  assert.doesNotMatch(app, /state\.payments\.filter\(x=>x\.assignedSalesperson===n/);
});

test("Legacy Sales Team records are reconciled to HR employee IDs on load without duplicating employee data", () => {
  assert.match(app, /resolveLegacyTeamEmployeeIds\(state,employees\)/);
  assert.match(app, /allHrEmployees=employees/);
});

test("Salesperson linkage across the connected chain is backfilled once at startup instead of relying only on names", () => {
  assert.match(app, /backfillSalespersonLinkage\(base\)/);
});
