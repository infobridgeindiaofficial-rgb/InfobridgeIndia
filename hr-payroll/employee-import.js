import { validateWeeklyOff } from "./core.js";
import { prepareEmployeeRecord, resolveHrCountryConfig } from "./country.js";

const COMMON_COLUMNS = [
  ["Employee ID", "employeeId"], ["Joining date", "joiningDate"], ["First name", "firstName"],
  ["Last name", "lastName"], ["Email", "email"], ["Mobile", "phone"],
  ["Designation", "designation"], ["Department", "department"], ["Employment type", "employmentType"],
];
const SALARY_COLUMNS = [["Allowances", "allowances"]];
const WEEKLY_COLUMNS = [["Weekly-off type", "weeklyOffType"], ["Weekly-off days", "weeklyOffDays"], ["Custom fields (JSON)", "customFields"]];
const INDIA_COLUMNS = [
  ["Basic salary", "basicSalary"], ...SALARY_COLUMNS, ["Default deductions", "deductions"],
  ["Overtime rate / hour", "overtimeRate"], ["Bank account", "bankAccount"], ["IFSC", "ifsc"],
  ["UAN / PF", "uan"], ["ESI number", "esi"], ["PAN", "pan"], ...WEEKLY_COLUMNS,
];
const UAE_COLUMNS = [
  ["Basic salary (AED)", "basicSalary"], ...SALARY_COLUMNS, ["Work location / Emirate", "workLocation"],
  ["Nationality", "nationality"], ["Employment status", "employmentStatus"],
  ["Salary payment method", "salaryPaymentMethod"], ["Bank name", "bankName"],
  ["Bank account", "bankAccount"], ["IBAN", "iban"], ["Emirates ID", "emiratesId"],
  ["Emirates ID expiry", "emiratesIdExpiry"], ["Passport number", "passportNumber"],
  ["Passport expiry", "passportExpiry"], ["Visa / residence details", "visaNumber"],
  ["Visa expiry", "visaExpiry"], ["Labour / work permit details", "workPermitNumber"],
  ["Work permit expiry", "workPermitExpiry"], ["Emergency contact name", "emergencyContactName"],
  ["Emergency contact mobile", "emergencyContactPhone"], ...WEEKLY_COLUMNS,
];

export const employeeImportColumns = (company) => [...COMMON_COLUMNS, ...(resolveHrCountryConfig(company).country === "AE" ? UAE_COLUMNS : INDIA_COLUMNS)];
export const employeeTemplateHeaders = (company) => employeeImportColumns(company).map(([header]) => header);

export function employeeTemplateWorkbookData(company) {
  return { employees: [employeeTemplateHeaders(company)] };
}

const normalizedHeader = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
const dateFields = ["joiningDate", "emiratesIdExpiry", "passportExpiry", "visaExpiry", "workPermitExpiry"];
const dateValue = (value) => {
  const text = String(value || "").trim();
  if (/^\d{5}(\.\d+)?$/.test(text)) return new Date(Date.UTC(1899, 11, 30) + Number(text) * 86400000).toISOString().slice(0, 10);
  return text;
};
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const slug = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "-");

export function mapEmployeeImportRow(row, company) {
  const lookup = new Map(Object.entries(row).map(([key, value]) => [normalizedHeader(key), value]));
  const values = Object.fromEntries(employeeImportColumns(company).map(([header, key]) => [key, lookup.get(normalizedHeader(header)) ?? ""]));
  for (const field of dateFields) values[field] = dateValue(values[field]);
  values.employeeId = String(values.employeeId).trim();
  values.department = String(values.department).trim();
  values.weeklyOffDays = String(values.weeklyOffDays || "Sunday").split(/[,/|]+/).map((day) => day.trim()).filter(Boolean);
  values.weeklyOffType = ({ "one-day-per-week": "one", "two-days-per-week": "two", custom: "custom", one: "one", two: "two" })[slug(values.weeklyOffType)] || slug(values.weeklyOffType || "one");
  values.employmentStatus = slug(values.employmentStatus || "active");
  values.salaryPaymentMethod = slug(values.salaryPaymentMethod || "bank-transfer");
  return values;
}

export function validateEmployeeImportRows(rows, { company, departments = [], existingEmployees = [], createId = () => crypto.randomUUID() } = {}) {
  const config = resolveHrCountryConfig(company), existingIds = new Set(existingEmployees.map((employee) => String(employee.employeeId).trim().toLowerCase())), batchIds = new Set();
  const departmentMap = new Map(departments.flatMap((department) => [[String(department.id).toLowerCase(), department], [String(department.name).trim().toLowerCase(), department]]));
  const employmentMap = new Map(config.employmentTypes.flatMap(([value, label]) => [[value.toLowerCase(), value], [label.toLowerCase(), value]]));
  return rows.map((source, index) => {
    const rowNumber = index + 2, values = mapEmployeeImportRow(source, company), errors = [], add = (field, message) => errors.push({ rowNumber, employeeId: values.employeeId, field, message });
    for (const [field, label] of [["employeeId", "Employee ID"], ["joiningDate", "Joining date"], ["firstName", "First name"], ["lastName", "Last name"], ["email", "Email"], ["designation", "Designation"], ["department", "Department"], ["employmentType", "Employment type"], ["basicSalary", "Basic salary"]]) if (!String(values[field] ?? "").trim()) add(label, `${label} is required.`);
    const id = values.employeeId.toLowerCase();
    if (id && existingIds.has(id)) add("Employee ID", `Employee ID ${values.employeeId} already exists.`);
    if (id && batchIds.has(id)) add("Employee ID", `Employee ID ${values.employeeId} is duplicated in this file.`);
    if (id) batchIds.add(id);
    const department = departmentMap.get(values.department.toLowerCase());
    if (values.department && !department) add("Department", `Department “${values.department}” does not exist.`);
    const employmentType = employmentMap.get(String(values.employmentType).trim().toLowerCase());
    if (values.employmentType && !employmentType) add("Employment type", `Employment type “${values.employmentType}” is invalid.`);
    for (const [field, label] of [["basicSalary", "Basic salary"], ["allowances", "Allowances"], ["deductions", "Default deductions"], ["overtimeRate", "Overtime rate"]]) if (values[field] != null && values[field] !== "" && (!Number.isFinite(Number(values[field])) || Number(values[field]) < 0)) add(label, `${label} must be a non-negative number.`);
    for (const field of dateFields) if (values[field] && !validDate(values[field])) add(field, `${field} must use a valid YYYY-MM-DD date.`);
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) add("Email", "Email is invalid.");
    if (config.country === "AE") {
      if (!values.workLocation) add("Work location / Emirate", "Work location / Emirate is required.");
      if (values.workLocation && !config.jurisdictions.includes(values.workLocation)) add("Work location / Emirate", `Emirate “${values.workLocation}” is invalid.`);
      if (!["active", "probation", "notice-period", "inactive"].includes(values.employmentStatus)) add("Employment status", "Employment status is invalid.");
      if (!["bank-transfer", "cash", "cheque"].includes(values.salaryPaymentMethod)) add("Salary payment method", "Salary payment method is invalid.");
    }
    const weekly = validateWeeklyOff(values.weeklyOffType, values.weeklyOffDays);
    for (const message of weekly.errors) add("Weekly-off days", message);
    try { JSON.parse(values.customFields || "{}"); } catch { add("Custom fields (JSON)", "Custom fields must contain valid JSON."); }
    const normalized = { ...values, departmentId: department?.id || "", departmentName: department?.name || values.department, employmentType: employmentType || values.employmentType, weeklyOffDays: weekly.days };
    const record = errors.length ? null : prepareEmployeeRecord({}, normalized, company, createId);
    return { rowNumber, source, values: normalized, record, errors, valid: errors.length === 0 };
  });
}

export function employeeImportErrorRows(results) {
  return results.flatMap((result) => result.errors.map((error) => ({ "Original row": error.rowNumber, "Employee ID": error.employeeId, Field: error.field, "Validation error": error.message })));
}
