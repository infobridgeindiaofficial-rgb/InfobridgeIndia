// Central URL -> required-Administration-module mapping for company-member workspace
// authorization. Uses the exact module names already defined by the Administration
// Module Access system (src/administration/core.js MODULES / company_members.permissions
// keys) -- no new permission keys are invented here. Routes with no defined module
// (e.g. /app/settings.html, /app/import-export.html) and public GST tool routes are
// intentionally left unmapped and are not gated by company-member permissions.
export const MODULE_ACCESS_ROUTES = Object.freeze({
  "/app/finance.html": "Finance & Accounting",
  "/app/sales.html": "Sales & CRM",
  "/app/purchases.html": "Purchases & Procurement",
  "/inventory/index.html": "Inventory & Warehouse",
  "/app/inventory.html": "Inventory & Warehouse",
  "/hr-payroll/index.html": "HR & Payroll",
  "/app/hr/index.html": "HR & Payroll",
  "/app/hr/payroll.html": "HR & Payroll",
  "/app/projects.html": "Projects & Operations",
  "/app/documents.html": "Documents",
  "/app/approvals.html": "Internal Requests",
  "/app/banking.html": "Banking",
  "/app/reports.html": "Reports & Analytics",
  "/app/admin.html": "Administration",
});

export function requiredModuleForRoute(value) {
  const path = String(value || "").split(/[?#]/)[0].replace(/\/$/, "") || "/";
  return MODULE_ACCESS_ROUTES[path] || MODULE_ACCESS_ROUTES[`${path}/index.html`] || null;
}

// Company Owner authorization is decided by the caller (profile.ownerId === authenticated
// user id) -- this function only evaluates the saved company_members.permissions for a
// non-owner member, read fresh from the current company profile on every page load.
export function hasModuleAccess(accessPermissions, moduleName) {
  if (!moduleName) return true;
  return Boolean(accessPermissions?.[moduleName]?.View);
}
