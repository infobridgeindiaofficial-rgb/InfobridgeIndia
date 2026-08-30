import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasModuleAccess, MODULE_ACCESS_ROUTES, requiredModuleForRoute } from "../src/auth/module-access.js";
import { ACTIONS, MODULES, bootstrap, defaultState, saveDepartmentDefaultAccess } from "../src/administration/core.js";
import { ensureDefaultDepartments } from "../src/administration/departments.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const gate = read("../src/scripts/auth-gate.js");
const client = read("../src/supabase/client.js");
const sql = read("../supabase/company-member-appointments.sql");

// Reproduces link_pending_company_member()'s permission-seeding SELECT 1:1
// (`d -> (case when is_department_head then 'headPermissions' else 'memberPermissions' end)`)
// -- a verbatim JSON object copy, no key renaming -- so the full Default Access -> saved
// company_members.permissions -> profile.accessPermissions -> guard pipeline can be proven
// end-to-end with real values, without touching a live database.
function seedDepartmentAccess(moduleGrants, { isDepartmentHead = true } = {}) {
  let state = ensureDefaultDepartments(bootstrap(defaultState()));
  const department = { id: "DEP-OPERATIONS", companyId: state.currentCompanyId, name: "Operations", code: "OPS", active: true };
  state.departments.push(department);
  const permissions = Object.fromEntries(MODULES.map((m) => [m, Object.fromEntries(ACTIONS.map((a) => [a, false]))]));
  for (const [module, actions] of Object.entries(moduleGrants)) for (const action of actions) permissions[module][action] = true;
  const { state: nextState } = saveDepartmentDefaultAccess(state, department.id, isDepartmentHead ? "head" : "member", permissions);
  const stored = nextState.departmentDefaultAccess.find((x) => x.departmentId === department.id);
  return isDepartmentHead ? stored.headPermissions : stored.memberPermissions;
}

// ---- URL -> module mapping uses only the module names already defined by the
// Administration Module Access system, never invented keys ----

test("HR & Payroll, Finance, Sales, Purchases, Inventory and Administration routes map to their exact defined module names", () => {
  assert.equal(requiredModuleForRoute("/hr-payroll/index.html"), "HR & Payroll");
  assert.equal(requiredModuleForRoute("/app/hr/index.html"), "HR & Payroll");
  assert.equal(requiredModuleForRoute("/app/hr/payroll.html"), "HR & Payroll");
  assert.equal(requiredModuleForRoute("/app/finance.html"), "Finance & Accounting");
  assert.equal(requiredModuleForRoute("/app/sales.html"), "Sales & CRM");
  assert.equal(requiredModuleForRoute("/app/purchases.html"), "Purchases & Procurement");
  assert.equal(requiredModuleForRoute("/inventory/index.html"), "Inventory & Warehouse");
  assert.equal(requiredModuleForRoute("/app/inventory.html"), "Inventory & Warehouse");
  assert.equal(requiredModuleForRoute("/app/admin.html"), "Administration");
});

test("routes with no defined Administration module are left ungated rather than inventing a new permission key", () => {
  assert.equal(requiredModuleForRoute("/app/settings.html"), null);
  assert.equal(requiredModuleForRoute("/app/import-export.html"), null);
  assert.equal(requiredModuleForRoute("/app/gst/index.html"), null);
  assert.doesNotMatch(Object.values(MODULE_ACCESS_ROUTES).join("|"), /Settings|Import|GST/);
});

// ---- 2 & 3: hasModuleAccess reads public.company_members.permissions -- present via
// companyToProfile().accessPermissions -- and requires the "View" action for that module ----

test("member WITH HR & Payroll access is granted; member WITHOUT it is denied", () => {
  assert.equal(hasModuleAccess({ "HR & Payroll": { View: true, Create: true } }, "HR & Payroll"), true);
  assert.equal(hasModuleAccess({}, "HR & Payroll"), false);
  assert.equal(hasModuleAccess({ "Finance & Accounting": { View: true } }, "HR & Payroll"), false);
  assert.equal(hasModuleAccess(null, "HR & Payroll"), false);
  assert.equal(hasModuleAccess(undefined, "HR & Payroll"), false);
});

test("Administration access is decided by the actual saved Administration permission, not a hard-coded email or department name", () => {
  assert.equal(hasModuleAccess({ Administration: { View: true } }, "Administration"), true);
  assert.equal(hasModuleAccess({ Administration: { "Manage Users": true } }, "Administration"), false, "Manage Users alone is a separate elevated permission, not general module access");
  assert.doesNotMatch(gate, /mohamedsalman|@gmail\.com/i);
  assert.doesNotMatch(gate, /department\s*===|departmentName\s*===/i);
});

// ---- 1: Owner bypass ----

test("Company Owner is never subjected to the module permission check", () => {
  assert.match(gate, /const requiredModule = user && profile && !isOwner \? requiredModuleForRoute\(safePath\) : null;/);
  assert.match(gate, /const isOwner = Boolean\(user && profile && profile\.ownerId === user\.id\);/);
});

// ---- 4: route guard fires before the workspace is ever allowed to render, independent of
// sidebar/menu visibility, and blocks direct URL navigation ----

test("direct URL navigation to a protected route is blocked before rendering when module access is denied", () => {
  const posGuard = gate.indexOf('} else if (isProtectedRoute(safePath) && moduleAccessDenied) {');
  const posRenderElse = gate.indexOf("} else {\n  if (isProtectedRoute(safePath)) setLastWorkspace(safePath, temporary);");
  assert.ok(posGuard !== -1, "the moduleAccessDenied branch must exist");
  assert.ok(posRenderElse !== -1, "the normal-render branch must exist");
  assert.ok(posGuard < posRenderElse, "the guard must run before the page is allowed to render");
  assert.match(gate, /location\.replace\(`\$\{HOME_ROUTE\}\?accessDenied=\$\{encodeURIComponent\(requiredModule\)\}`\);/);
  assert.match(gate, /You don't have access to \$\{deniedModule\}\./);
});

test("navigation visibility alone is not treated as the enforcement mechanism -- the guard exists independently of the sidebar-hiding code", () => {
  const guardBlock = gate.slice(gate.indexOf("if (isProtectedRoute(safePath) && companyLoadError)"), gate.indexOf("} else {\n  if (isProtectedRoute(safePath)) setLastWorkspace"));
  assert.match(guardBlock, /moduleAccessDenied/);
  assert.doesNotMatch(guardBlock, /side-link|app-sidebar/);
  assert.match(gate, /function applyModuleAccessRestrictions/);
  assert.match(gate, /route guard above is what actually\s*\n?\s*\/\/ enforces access/);
});

// ---- 5: permissions are read fresh from the current company_members row on every page
// load, never from a stale appointment-time snapshot or localStorage ----

test("member permissions come from a fresh company_members query every time, never a cached/local value", () => {
  assert.match(client, /access_permissions:data\.permissions\|\|\{\}/);
  const moduleAccessSource = readFileSync(new URL("../src/auth/module-access.js", import.meta.url), "utf8");
  assert.doesNotMatch(moduleAccessSource, /localStorage|sessionStorage/);
  assert.match(gate, /profile\.accessPermissions/);
  assert.doesNotMatch(gate.slice(gate.indexOf("const moduleAccessDenied"), gate.indexOf("const moduleAccessDenied") + 200), /localStorage|sessionStorage/);
});

// ---- Full pipeline: Default Access UI -> saved workspace_records -> link_pending_company_member
// (reproduced) -> company_members.permissions -> profile.accessPermissions -> auth-gate.js guard.
// Proves "Internal Requests" and "Administration" survive as exact, unrenamed keys at every
// layer, and that the guard's final boolean matches what was actually granted. ----

test("Internal Requests: View granted in Default Access flows through to an allowed guard result", () => {
  const permissions = seedDepartmentAccess({ "Internal Requests": ["View", "Approve"] });
  assert.equal(permissions["Internal Requests"].View, true, "saved default access must keep the exact 'Internal Requests' key");
  const requiredModule = requiredModuleForRoute("/app/approvals.html");
  assert.equal(requiredModule, "Internal Requests");
  assert.equal(hasModuleAccess(permissions, requiredModule), true);
});

test("Internal Requests: View NOT granted in Default Access flows through to a denied guard result", () => {
  const permissions = seedDepartmentAccess({ "Internal Requests": ["Approve"] });
  assert.equal(permissions["Internal Requests"].View, false);
  const requiredModule = requiredModuleForRoute("/app/approvals.html");
  assert.equal(hasModuleAccess(permissions, requiredModule), false);
});

test("Administration: View granted/absent produces the same allowed/denied guard result as Internal Requests -- one mechanism for both", () => {
  const granted = seedDepartmentAccess({ Administration: ["View"] });
  assert.equal(hasModuleAccess(granted, requiredModuleForRoute("/app/admin.html")), true);
  const denied = seedDepartmentAccess({ Administration: ["Manage Users"] });
  assert.equal(hasModuleAccess(denied, requiredModuleForRoute("/app/admin.html")), false);
});

test("the SQL permission-seeding step copies the whole headPermissions/memberPermissions object verbatim -- no per-module key transformation exists to lose or rename Internal Requests", () => {
  const fn = sql.slice(sql.indexOf("function public.link_pending_company_member"), sql.indexOf("function public.company_member_directory"));
  assert.match(fn.replace(/\s+/g, ""), /d->\(casewhenv_appt\.is_department_headthen'headPermissions'else'memberPermissions'end\)/);
  assert.doesNotMatch(fn, /Internal Requests|internal_requests|internal-requests/i, "the SQL never references module names literally -- it copies the whole object, which is why key names never drift here");
});

// ---- Documents the real architecture the user asked to be checked: editing Default
// Department Access after a member is already linked does NOT retroactively update that
// member's stored company_members.permissions. This is why a permission change can "save
// successfully" yet have no visible effect on an already-active member -- it is not a guard
// or module-key bug. The immediate, already-working remedy for an existing member is the
// individual "Company Member Access" override (updateCompanyMemberPermissions), which writes
// company_members.permissions directly and takes effect on that member's next page load. ----

test("Default Department Access changes are not retroactively pushed into already-linked members (architectural fact, not a bug in this guard)", () => {
  assert.match(client, /client\.from\("company_members"\)\.select\(/, "the frontend only ever reads company_members for an authenticated session, never writes permissions to it");
  assert.doesNotMatch(client, /\.from\("company_members"\)\.update\(/);
  const memberPermissionsSql = read("../supabase/company-member-permissions.sql");
  assert.match(memberPermissionsSql.replace(/\s+/g, ""), /updatepublic\.company_membersmsetpermissions=p_permissions/, "the only immediate, per-member permission update path is the individual override RPC");
  assert.doesNotMatch(memberPermissionsSql, /departmentDefaultAccess/);
  assert.doesNotMatch(sql, /update public\.company_members[^;]*permissions[^;]*where[^;]*status='active'[^;]*;/s, "nothing re-syncs an already-active member's permissions from departmentDefaultAccess");
});

test("this is the single, central authorization implementation -- no second permission system was introduced", () => {
  const guardFiles = ["../src/administration/app.js", "../src/hr-payroll/app.js", "../src/finance/app.js", "../src/sales/app.js"].map(read);
  for (const source of guardFiles) assert.doesNotMatch(source, /requiredModuleForRoute|MODULE_ACCESS_ROUTES/, "module page scripts must not duplicate the route->module guard");
});
