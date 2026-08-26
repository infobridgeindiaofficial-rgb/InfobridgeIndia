import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatHrMoney, hrSetupDefaults, payrollForCountryEmployee, prepareEmployeeRecord, resolveHrCountryConfig } from "../src/hr-payroll/country.js";
import { sharedHrEmployees } from "../src/sales/employees.js";

const createId = () => "EMP-STABLE-AE-1";

test("AE HR resolves AED and UAE employment configuration", () => {
  const config = resolveHrCountryConfig({ country: "AE" });
  assert.equal(config.currency, "AED");
  assert.equal(config.locationLabel, "Work location / Emirate");
  assert.match(formatHrMoney(12500, { country: "AE" }), /AED/);
  assert.ok(config.employmentTypes.some(([value]) => value === "limited"));
});

test("UAE employee records save and reload without India statutory fields", async () => {
  const input = { employeeId: "EMP-001", firstName: "Mariam", lastName: "Ali", departmentId: "DEP-SALES", designation: "Sales Manager", joiningDate: "2026-01-01", employmentType: "limited", workLocation: "Dubai", nationality: "Emirati", basicSalary: "10000", allowances: "2500", deductions: "900", overtimeRate: "100", pan: "ABCDE1234F", uan: "PF-1", esi: "ESI-1", emiratesId: "784-0000-0000000-0", emiratesIdExpiry: "2028-01-01", passportNumber: "P123", passportExpiry: "2029-01-01", visaNumber: "V123", visaExpiry: "2027-01-01", workPermitNumber: "WP123", bankName: "Bank", bankAccount: "001", iban: "AE070000000000000000001", emergencyContactName: "Ali", emergencyContactPhone: "+971500000000" };
  const saved = prepareEmployeeRecord({}, input, { country: "AE" }, createId);
  assert.equal(saved.id, "EMP-STABLE-AE-1");
  assert.equal(saved.currency, "AED");
  assert.equal(saved.deductions, 0);
  assert.equal(saved.overtimeRate, 0);
  for (const field of ["pan", "uan", "esi", "ifsc"]) assert.equal(field in saved, false);
  const rows = new Map([[saved.id, structuredClone(saved)]]);
  assert.deepEqual(rows.get(saved.id), saved);
  const edited = prepareEmployeeRecord(saved, { ...saved, designation: "Senior Sales Manager" }, { country: "AE" }, () => "SHOULD-NOT-BE-USED");
  assert.equal(edited.id, saved.id);
  rows.set(edited.id, edited);
  assert.equal(rows.size, 1);
});

test("AE payroll uses shared salary math without India deductions or unimplemented overtime", () => {
  const employee = { id: "E1", employeeId: "EMP-001", firstName: "Mariam", lastName: "Ali", basicSalary: 10000, allowances: 2500, deductions: 900, overtimeRate: 100, weeklyOffDays: ["Sunday"] };
  const result = payrollForCountryEmployee(employee, { from: "2026-08-03", to: "2026-08-03", attendance: [{ employeeId: "E1", date: "2026-08-03", status: "present", hours: 8, overtimeHours: 2 }], settings: { weeklyOff: "Sunday" } }, { country: "AE" });
  assert.equal(result.gross, 12500);
  assert.equal(result.deductions, 0);
  assert.equal(result.otPay, 0);
  assert.doesNotMatch(result.issues.join(" "), /Overtime rate/);
});

test("Sales lookup keeps stable UAE Employee ID and deduplicates cloud/cache copies", async () => {
  const employee = prepareEmployeeRecord({}, { employeeId: "EMP-001", firstName: "Mariam", lastName: "Ali", departmentId: "DEP-SALES", designation: "Sales Manager", basicSalary: 10000 }, { country: "AE" }, createId);
  const storage = { getItem: () => JSON.stringify({ employees: [employee] }) };
  const rows = await sharedHrEmployees({ store: { all: async () => [employee] }, storage, userId: "U1", companyId: "C1" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "EMP-STABLE-AE-1");
  assert.equal(rows[0].employeeId, "EMP-001");
});

test("IN HR retains INR, India defaults and legacy employee fields", () => {
  const config = resolveHrCountryConfig({ country: "IN" });
  assert.equal(config.currency, "INR");
  assert.match(formatHrMoney(30000, { country: "IN" }), /₹|INR/);
  assert.deepEqual(hrSetupDefaults({ country: "IN", gstin: "27ABCDE1234F1Z5" }), { country: "IN", currency: "INR", tan: "", gstin: "27ABCDE1234F1Z5", pfNumber: "", esiNumber: "", professionalTax: "" });
  const legacy = prepareEmployeeRecord({ id: "E-INDIA", createdAt: "2020-01-01" }, { employeeId: "EMP-OLD", firstName: "Asha", lastName: "Sharma", basicSalary: "30000", allowances: "2000", deductions: "500", overtimeRate: "100", pan: "ABCDE1234F", uan: "UAN-1", esi: "ESI-1" }, { country: "IN" }, createId);
  assert.equal(legacy.id, "E-INDIA");
  assert.equal(legacy.pan, "ABCDE1234F");
  assert.equal(legacy.deductions, 500);
});

test("actual UAE employee UI excludes India-only statutory controls", () => {
  const source = readFileSync(new URL("../src/hr-payroll/app.js", import.meta.url), "utf8");
  assert.match(source, /if\(c\.country==="IN"\)return/);
  assert.match(source, /Labour \/ Work Permit Number/);
  assert.match(source, /Visa Expiry Date/);
  assert.match(source, /Basic Salary \(AED\)/);
  assert.match(source, /Basic Salary \(INR\)/);
  assert.match(source, /prepareEmployeeRecord/);
});
