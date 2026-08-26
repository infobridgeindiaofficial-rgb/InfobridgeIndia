import { formatCountryMoney, resolveCountryConfig } from "../country/registry.js";
import { payrollForEmployee as sharedPayrollForEmployee } from "./core.js";

export const COMMON_EMPLOYMENT_TYPES = Object.freeze([
  ["permanent", "Permanent"], ["fixed-term", "Fixed Term"], ["contract", "Contract"],
  ["probation", "Probation"], ["temporary", "Temporary"], ["intern", "Intern"],
  ["part-time", "Part-time"], ["full-time", "Full-time"], ["limited", "Fixed-term employment"],
  ["unlimited", "Unlimited-term employment"], ["flexible", "Flexible employment"],
]);
export const UAE_EMPLOYMENT_TYPES = COMMON_EMPLOYMENT_TYPES;
export const INDIA_EMPLOYMENT_TYPES = COMMON_EMPLOYMENT_TYPES;

export const employeeCountryCode = (employee = {}, fallback = "IN") => {
  const explicit = String(employee.countryCode || employee.country || "").toUpperCase();
  if (["IN", "AE"].includes(explicit)) return explicit;
  if (employee.currency === "AED" || employee.emiratesId || employee.iban || employee.workPermitNumber) return "AE";
  if (employee.currency === "INR" || employee.pan || employee.uan || employee.ifsc) return "IN";
  const safeFallback = String(fallback?.country || fallback || "IN").toUpperCase();
  return ["IN", "AE"].includes(safeFallback) ? safeFallback : "IN";
};

export function resolveEmployeeCountryConfig(country = "IN") {
  const code = employeeCountryCode(typeof country === "object" ? country : { country }, "IN");
  const resolved = resolveCountryConfig(code);
  return Object.freeze({
    ...resolved,
    employmentTypes: COMMON_EMPLOYMENT_TYPES,
    locationLabel: code === "AE" ? "Work Location / Emirate" : "Work Location",
    salaryLabel: code === "AE" ? "Basic Salary (AED)" : "Basic Salary (INR)",
  });
}

export function resolveHrCountryConfig(company) {
  const country = resolveCountryConfig(globalThis.InfoBridgeCompany?.country ?? company?.country);
  return Object.freeze({
    ...country,
    employmentTypes: country.country === "AE" ? UAE_EMPLOYMENT_TYPES : INDIA_EMPLOYMENT_TYPES,
    locationLabel: country.country === "AE" ? "Work location / Emirate" : "Work location",
    salaryLabel: country.country === "AE" ? "Basic salary (AED)" : "Basic salary",
  });
}

export function formatHrMoney(value, company) {
  const config = resolveEmployeeCountryConfig(company);
  return formatCountryMoney(value, config.country);
}

export function prepareEmployeeRecord(existing, values, company, createId) {
  const code = employeeCountryCode(values, employeeCountryCode(existing, company));
  const config = resolveEmployeeCountryConfig(code);
  const record = {
    ...existing,
    ...values,
    id: existing?.id || createId(),
    basicSalary: Number(values.basicSalary || 0),
    hra: Number(values.hra || 0),
    housingAllowance: Number(values.housingAllowance || 0),
    transportAllowance: Number(values.transportAllowance || 0),
    otherAllowances: Number(values.otherAllowances ?? values.allowances ?? 0),
    allowances: Number(values.hra || 0) + Number(values.housingAllowance || 0) + Number(values.transportAllowance || 0) + Number(values.otherAllowances ?? values.allowances ?? 0),
    deductions: Number(values.deductions || 0),
    overtimeRate: Number(values.overtimeRate || 0),
    active: existing?.active !== false,
    updatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  record.grossSalary = record.basicSalary + record.allowances;
  record.country = record.countryCode = code;
  record.currency = config.currency;
  if (config.country === "AE") {
    record.deductions = 0;
    record.overtimeRate = 0;
    for (const field of ["pan", "uan", "esi", "pfApplicable", "esiApplicable", "professionalTaxApplicable", "ifsc"]) delete record[field];
  } else {
    for (const field of ["emiratesId", "visaNumber", "visaExpiry", "workPermitNumber", "workPermitExpiry", "iban"]) delete record[field];
  }
  return record;
}

export function hrSetupDefaults(company) {
  const config = resolveHrCountryConfig(company);
  const base = { country: config.country, currency: config.currency };
  return config.country === "IN"
    ? { ...base, tan: "", gstin: company?.gstin || "", pfNumber: "", esiNumber: "", professionalTax: "" }
    : base;
}

export function payrollForCountryEmployee(employee, inputs, company) {
  const config = resolveHrCountryConfig(company);
  if (config.country === "IN") return sharedPayrollForEmployee(employee, inputs);
  const attendance = (inputs.attendance || []).map((row) => ({ ...row, overtimeHours: 0 }));
  return sharedPayrollForEmployee({ ...employee, deductions: 0, overtimeRate: 0 }, { ...inputs, attendance, settings: { ...inputs.settings, overtimeRate: 0 } });
}
