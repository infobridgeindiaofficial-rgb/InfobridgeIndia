import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EMPLOYEE_RESET_COLLECTIONS, resetEmployeeData, resetEmployeeDataEverywhere } from "../src/hr-payroll/employee-reset.js";

test("employee reset clears only company-scoped workforce collections", async () => {
  const cleared = [];
  const result = await resetEmployeeData({ clear: async (collection) => cleared.push(collection) });
  assert.deepEqual(cleared, [...EMPLOYEE_RESET_COLLECTIONS]);
  assert.deepEqual(result.cleared, [...EMPLOYEE_RESET_COLLECTIONS]);
  for (const collection of ["settings", "departments", "shifts", "leaveTypes"]) assert.ok(!cleared.includes(collection));
  for (const unrelated of ["companies", "sales", "finance", "purchases", "inventory", "banking", "projects", "documents", "workspace_records"]) assert.ok(!cleared.includes(unrelated));
});

test("employee reset covers employee-linked attendance leave and payroll data", () => {
  for (const collection of ["employees", "attendance", "attendanceImports", "attendanceMappings", "attendanceCorrections", "leaveBalances", "leaveTransactions", "payrollRuns", "payrollAdjustments", "payslips"]) assert.ok(EMPLOYEE_RESET_COLLECTIONS.includes(collection));
});

test("Settings danger zone requires the exact confirmation phrase", () => {
  const source = readFileSync(new URL("../src/hr-payroll/app.js", import.meta.url), "utf8");
  assert.match(source, /Danger Zone/);
  assert.match(source, /Reset all employee data\?/);
  assert.match(source, /values\.confirmation!=="RESET EMPLOYEES"/);
  assert.match(source, /button\.disabled=true/);
  assert.match(source, /button\.disabled=input\.value!=="RESET EMPLOYEES"/);
  assert.match(source, /Employee data reset successfully\./);
});

const scopedStore = (database, companyId, module = "hr-payroll", offline = false) => ({
  offline,
  async all(collection) { return [...(database.get(`${companyId}:${module}:${collection}`) || [])]; },
  async clear(collection) { database.set(`${companyId}:${module}:${collection}`, []); },
});

test("reset clears cloud and stale fallback, and repository reload stays empty", async () => {
  const cloud = new Map(), fallback = new Map();
  for (const collection of EMPLOYEE_RESET_COLLECTIONS) {
    cloud.set(`COMPANY-A:hr-payroll:${collection}`, [{ id: `CLOUD-${collection}`, employeeId: "E1" }]);
    fallback.set(`COMPANY-A:hr-payroll:${collection}`, [{ id: `LOCAL-${collection}`, employeeId: "E1" }]);
  }
  cloud.set("COMPANY-A:sales:leads", [{ id: "LEAD-1", assignedSalespersonId: "E1" }]);
  cloud.set("COMPANY-B:hr-payroll:employees", [{ id: "OTHER-EMPLOYEE" }]);
  const activeFallback = scopedStore(fallback, "COMPANY-A", "hr-payroll", true);
  await resetEmployeeDataEverywhere({
    activeStore: activeFallback,
    createCloudStore: async () => scopedStore(cloud, "COMPANY-A"),
    createFallbackStore: () => scopedStore(fallback, "COMPANY-A", "hr-payroll", true),
  });
  const cloudReload = scopedStore(cloud, "COMPANY-A"), fallbackReload = scopedStore(fallback, "COMPANY-A");
  for (const collection of EMPLOYEE_RESET_COLLECTIONS) {
    assert.deepEqual(await cloudReload.all(collection), []);
    assert.deepEqual(await fallbackReload.all(collection), []);
  }
  assert.deepEqual(cloud.get("COMPANY-A:sales:leads"), [{ id: "LEAD-1", assignedSalespersonId: "E1" }]);
  assert.deepEqual(cloud.get("COMPANY-B:hr-payroll:employees"), [{ id: "OTHER-EMPLOYEE" }]);
});

test("reset fails verification instead of claiming success when persisted rows survive", async () => {
  const stubborn = { offline: false, async clear() {}, async all(collection) { return collection === "employees" ? [{ id: "E1" }] : []; } };
  await assert.rejects(() => resetEmployeeDataEverywhere({ activeStore: stubborn, createCloudStore: async () => stubborn, createFallbackStore: () => ({ async clear() {}, async all() { return []; } }) }), /could not be verified.*employees/);
});
