import { normalizeCountryCode } from "../country/registry.js";
import { companyProfileCountryModel, normalizeCompanyProfileInput } from "../company/profile.js";

export const INTENDED_KEY = "infobridgeindia.auth.intended.v1";
export const LAST_WORKSPACE_KEY = "infobridgeindia.auth.last-workspace.v1";
export const HOME_ROUTE = "/index.html";

export const PROTECTED_ROUTES = [
  "/app/finance.html", "/app/sales.html", "/app/purchases.html", "/inventory/index.html", "/hr-payroll/index.html",
  "/app/projects.html", "/app/documents.html", "/app/approvals.html", "/app/banking.html", "/app/reports.html",
  "/app/admin.html", "/app/inventory.html", "/app/import-export.html",
  "/app/settings.html", "/app/hr/index.html", "/app/hr/payroll.html",
];

export const PUBLIC_TOOL_ROUTES = [
  "/app/gst/index.html", "/app/gst/gstr-1.html",
  "/gst-calculator.html", "/gst-interest-calculator.html", "/gst-late-fee-calculator.html", "/marketplace-profit-calculator.html",
  "/gst-invoice-generator.html", "/quotation-generator.html", "/pdf-to-word.html", "/word-to-pdf.html", "/shipping-label-4in1.html",
];

const defaultTemporaryStorage = () => globalThis.sessionStorage;

export function normalizePath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "";
  try { const url = new URL(value, "https://local.infobridgeindia.invalid"); return url.origin === "https://local.infobridgeindia.invalid" ? `${url.pathname}${url.search}${url.hash}` : ""; }
  catch { return ""; }
}

export function isProtectedRoute(value) {
  const safe = normalizePath(value); if (!safe) return false;
  const path = safe.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  return PROTECTED_ROUTES.some((route) => path === route || path === route.replace(/\/index\.html$/, ""));
}
export function isPublicToolRoute(value) { return PUBLIC_TOOL_ROUTES.includes(normalizePath(value).split(/[?#]/)[0]); }

export function saveIntendedDestination(value, storage = defaultTemporaryStorage()) { const safe = normalizePath(value); if (!safe || !isProtectedRoute(safe)) return ""; storage.setItem(INTENDED_KEY, safe); return safe; }
export function consumeIntendedDestination(storage = defaultTemporaryStorage()) { const safe = normalizePath(storage.getItem(INTENDED_KEY) || ""); storage.removeItem(INTENDED_KEY); return safe && isProtectedRoute(safe) ? safe : ""; }
export function setLastWorkspace(value, storage = defaultTemporaryStorage()) { const safe = normalizePath(value); if (!safe || !isProtectedRoute(safe)) return ""; storage.setItem(LAST_WORKSPACE_KEY, safe); return safe; }
export function getLastWorkspace(storage = defaultTemporaryStorage()) { const safe = normalizePath(storage.getItem(LAST_WORKSPACE_KEY) || ""); return safe && isProtectedRoute(safe) ? safe : ""; }
export function clearTemporaryNavigation(storage = defaultTemporaryStorage()) { storage.removeItem(INTENDED_KEY); storage.removeItem(LAST_WORKSPACE_KEY); }
export function destinationAfterAuth(storage = defaultTemporaryStorage()) { consumeIntendedDestination(storage); return HOME_ROUTE; }
export function destinationAfterSetup(storage = defaultTemporaryStorage()) { return destinationAfterAuth(storage); }

export function readableEmailName(email = "") {
  const local = String(email).split("@")[0].trim();
  if (!local) return "Account";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function profileDisplayName(company, user) {
  return String(company?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.display_name || readableEmailName(user?.email)).trim();
}

export function currentIndianFinancialYear(date = new Date()) { const year = date.getFullYear(), start = date.getMonth() >= 3 ? year : year - 1; return `${start}-${String(start + 1).slice(-2)}`; }
export function isValidGstin(value) { return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(value || "").trim().toUpperCase()); }
export function normalizeCountry(value) { return normalizeCountryCode(value); }
export function isValidTrn(value) { return /^\d{15}$/.test(String(value || "").trim()); }
export function validateCompanyProfile(input) {
  const normalized = normalizeCompanyProfileInput(input), model = companyProfileCountryModel(normalized.country);
  const data = { ...normalized, name: String(input.name || "").trim(), businessType: String(input.businessType || "").trim(), address: String(input.address || "").trim(), logo: String(input.logo || ""), dateFormat: String(input.dateFormat || "DD/MM/YYYY"), financialYear: String(input.financialYear || currentIndianFinancialYear()), invoicePrefix: String(input.invoicePrefix || "INV").trim().toUpperCase(), quotationPrefix: String(input.quotationPrefix || "QUO").trim().toUpperCase() };
  if (!data.name) throw new Error("Enter the company name.");
  if (!data.businessType) throw new Error("Select a business type.");
  if (!data.state) throw new Error(`Select ${model.regionLabel === "State" ? "a state or union territory" : `an ${model.regionLabel.toLowerCase()}`}.`);
  const registered = data.gstRegistered || data.vatRegistered;
  if (registered && !model.config.tax.validateIdentifier(data.taxNumber)) throw new Error(model.config.tax.identifier === "TRN" ? "TRN must contain exactly 15 digits." : "Enter a valid GSTIN format.");
  return data;
}
