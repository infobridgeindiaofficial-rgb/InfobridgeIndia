import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { employeeImportErrorRows, employeeTemplateHeaders, employeeTemplateWorkbookData, validateEmployeeImportRows } from "../src/hr-payroll/employee-import.js";
import { eligibleSalesEmployees } from "../src/sales/employees.js";

const departments = [{ id: "DEP-SALES", name: "Sales & CRM" }, { id: "DEP-HR", name: "Human Resources" }];
const aeRow = (id = "EMP-001") => ({
  "Employee ID": id, "Joining date": "2026-08-01", "First name": "Ahmed", "Last name": "Khan",
  Email: `${id.toLowerCase()}@example.com`, Mobile: "+971500000000", Designation: "Sales Manager",
  Department: "Sales & CRM", "Employment type": "Fixed-term employment", "Basic salary (AED)": "12000",
  Allowances: "2000", "Work location / Emirate": "Dubai", Nationality: "Indian", "Employment status": "Active",
  "Salary payment method": "Bank transfer", "Bank name": "Example Bank", "Bank account": "001", IBAN: "AE070000000000000000001",
  "Emirates ID": "784-0000-0000000-0", "Emirates ID expiry": "2028-01-01", "Passport number": "P123",
  "Passport expiry": "2029-01-01", "Visa / residence details": "V123", "Visa expiry": "2027-01-01",
  "Labour / work permit details": "WP123", "Work permit expiry": "2027-01-01", "Emergency contact name": "Ali",
  "Emergency contact mobile": "+971511111111", "Weekly-off type": "One day per week", "Weekly-off days": "Sunday",
  "Custom fields (JSON)": "{}",
});
const validate = (rows, extra = {}) => validateEmployeeImportRows(rows, { company: { country: "AE" }, departments, existingEmployees: [], createId: (() => { let id = 0; return () => `EMP-STABLE-${++id}`; })(), ...extra });

test("country-aware employee template data contains only the blank Employees sheet", () => {
  const uae = employeeTemplateWorkbookData({ country: "AE" }, departments);
  assert.deepEqual(Object.keys(uae), ["employees"]);
  assert.ok(uae.employees[0].includes("Basic salary (AED)"));
  assert.ok(uae.employees[0].includes("Emirates ID"));
  for (const field of ["PAN", "UAN / PF", "ESI number", "IFSC"]) assert.ok(!uae.employees[0].includes(field));
  assert.equal(uae.employees.length, 1);
  assert.equal("instructions" in uae, false);
  assert.equal("options" in uae, false);
  const india = employeeTemplateHeaders({ country: "IN" });
  for (const field of ["Basic salary", "PAN", "UAN / PF", "ESI number", "IFSC"]) assert.ok(india.includes(field));
  assert.ok(!india.includes("Emirates ID"));
});

test("downloaded workbook creates exactly one worksheet named Employees", () => {
  const source = readFileSync(new URL("../src/hr-payroll/app.js", import.meta.url), "utf8");
  const templateFunction = source.match(/function downloadEmployeeTemplate\(\)\{[^\n]+/u)?.[0] || "";
  assert.equal((templateFunction.match(/book_append_sheet/g) || []).length, 1);
  assert.match(templateFunction, /book_append_sheet\(book,XLSX\.utils\.aoa_to_sheet\(data\.employees\),"Employees"\)/);
  assert.doesNotMatch(templateFunction, /Instructions|Options|README|Summary|Help/);
});

test("valid UAE employee import prepares the normal employee record", () => {
  const [result] = validate([aeRow()]);
  assert.equal(result.valid, true);
  assert.equal(result.record.id, "EMP-STABLE-1");
  assert.equal(result.record.employeeId, "EMP-001");
  assert.equal(result.record.departmentId, "DEP-SALES");
  assert.equal(result.record.currency, "AED");
});

test("invalid rows report duplicate ID, department, salary, date and JSON errors", () => {
  const bad = aeRow("EMP-EXISTING");
  bad.Department = "Kitchen ABC";
  bad["Basic salary (AED)"] = "twelve thousand";
  bad["Joining date"] = "2026-99-40";
  bad["Custom fields (JSON)"] = "{bad";
  const [result] = validate([bad], { existingEmployees: [{ id: "OLD", employeeId: "EMP-EXISTING" }] });
  assert.equal(result.valid, false);
  const messages = result.errors.map((error) => error.message).join(" ");
  assert.match(messages, /already exists/);
  assert.match(messages, /does not exist/);
  assert.match(messages, /non-negative number/);
  assert.match(messages, /valid YYYY-MM-DD/);
  assert.match(messages, /valid JSON/);
  const report = employeeImportErrorRows([result]);
  assert.ok(report.every((row) => row["Original row"] === 2 && row["Employee ID"] === "EMP-EXISTING"));
});

test("country-specific UAE validation rejects invalid emirate and employment values", () => {
  const bad = aeRow(); bad["Work location / Emirate"] = "Kerala"; bad["Employment type"] = "Full-time"; bad["Employment status"] = "Unknown";
  const [result] = validate([bad]);
  assert.equal(result.valid, false);
  assert.match(result.errors.map((error) => error.message).join(" "), /Emirate.*invalid|Employment type.*invalid|Employment status.*invalid/);
});

test("duplicate Employee IDs inside one file are rejected", () => {
  const results = validate([aeRow("EMP-009"), aeRow("EMP-009")]);
  assert.equal(results[0].valid, true);
  assert.equal(results[1].valid, false);
  assert.match(results[1].errors[0].message, /duplicated in this file/);
});

test("90 valid rows import without duplicates and remain visible to HR and Sales", () => {
  const results = validate(Array.from({ length: 90 }, (_, index) => aeRow(`EMP-${String(index + 1).padStart(3, "0")}`)));
  assert.equal(results.filter((row) => row.valid).length, 90);
  const records = results.map((row) => row.record), saved = new Map(records.map((employee) => [employee.id, employee]));
  assert.equal(saved.size, 90);
  assert.equal(new Set(records.map((employee) => employee.employeeId)).size, 90);
  assert.equal(eligibleSalesEmployees(records, departments).length, 90);
});
