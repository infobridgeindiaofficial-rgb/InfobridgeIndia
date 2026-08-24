import { resolveCountryConfig } from "../country/registry.js";
import { payrollForEmployee as sharedPayrollForEmployee } from "./core.js";

export const UAE_EMPLOYMENT_TYPES = Object.freeze([
  ["unlimited", "Unlimited-term employment"],
  ["limited", "Fixed-term employment"],
  ["part-time", "Part-time employment"],
  ["temporary", "Temporary employment"],
  ["flexible", "Flexible employment"],
]);

export const INDIA_EMPLOYMENT_TYPES = Object.freeze([
  ["full-time", "Full-time"],
  ["part-time", "Part-time"],
  ["contract", "Contract"],
]);

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
  const config = resolveHrCountryConfig(company);
  return new Intl.NumberFormat(config.defaults.locale, { style: "currency", currency: config.currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

export function prepareEmployeeRecord(existing, values, company, createId) {
  const config = resolveHrCountryConfig(company);
  const record = {
    ...existing,
    ...values,
    id: existing?.id || createId(),
    basicSalary: Number(values.basicSalary || 0),
    allowances: Number(values.allowances || 0),
    deductions: Number(values.deductions || 0),
    overtimeRate: Number(values.overtimeRate || 0),
    active: existing?.active !== false,
    updatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  if (config.country === "AE") {
    record.country = "AE";
    record.currency = "AED";
    record.deductions = 0;
    record.overtimeRate = 0;
    for (const field of ["pan", "uan", "esi", "ifsc"]) delete record[field];
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
