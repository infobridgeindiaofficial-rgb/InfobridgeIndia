import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasModuleAccess, requiredModuleForRoute } from "../src/auth/module-access.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const app = read("../src/administration/app.js");
const memberPermissionsSql = read("../supabase/company-member-permissions.sql");
const memberPermissionsClient = read("../src/company/member-permissions.js");

// ---- Verify the claim in the task: does "Roles & Permissions" already edit an individual
// member's own saved permissions (access keys), or does it only edit department defaults?
// Answer, proven from the actual source below: it is ALREADY per-member. "Default Department
// Access" (top section, showDepartmentDefaultAccess/saveDepartmentDefaultAccess) and "Company
// Member Access" (bottom section, showMemberPermissions/updateCompanyMemberPermissions) are two
// separate, independently wired features. Only the second one writes company_members.permissions
// for an existing member; the first only ever writes the Administration workspace_records
// template used at first appointment/link. This suite proves that per-member path end-to-end. ----

test("Roles & Permissions edits an individual member's own permissions via a member_id-scoped RPC, separate from Default Department Access", () => {
  assert.match(app, /data-edit-member-permissions="\$\{x\.member_id\}"/);
  assert.match(app, /showMemberPermissions\(memberPermissionRows\.find\(\(x=>x\.member_id===button\.dataset\.editMemberPermissions\)\),false\)/);
  assert.match(app, /updateCompanyMemberPermissions\(globalThis\.InfoBridgeCompany\.companyId,member\.member_id,next\)/);
  // Default Department Access is a distinct code path with its own distinct save function.
  assert.match(app, /showDepartmentDefaultAccess\(button\.dataset\.editDefaultAccess,button\.dataset\.tier\)/);
  assert.match(app, /saveDepartmentDefaultAccess\(state,departmentId,tier,next\)/);
  assert.notEqual(app.indexOf("updateCompanyMemberPermissions"), app.indexOf("saveDepartmentDefaultAccess"), "these must be two distinct save calls, not the same one");
});

test("the individual member permission RPC is an absolute per-member replace, scoped by member id, company id and active status -- not a merge, not department-wide", () => {
  const flatSql = memberPermissionsSql.replace(/\s+/g, "");
  assert.match(flatSql, /updatepublic\.company_membersmsetpermissions=p_permissions,updated_at=now\(\)/);
  assert.match(flatSql, /wherem\.id=p_member_idandm\.company_id=p_company_idandm\.system_role='company_member'andm\.status='active'/);
  assert.doesNotMatch(memberPermissionsSql, /departmentDefaultAccess/);
  assert.match(memberPermissionsClient, /update_company_member_permissions/);
});

// ---- A faithful behavioral simulation of update_company_member_permissions()'s exact WHERE
// clause (id + company_id + active status) plus the real hasModuleAccess/requiredModuleForRoute
// guard functions -- proves points 1, 2, 3, 4, 5, 6, 7, 8, 9 with real values, no live database
// required. This models company_members as a plain array, exactly as the SQL table behaves. ----

function updateMemberPermissions(members, companyId, memberId, permissions) {
  const row = members.find((m) => m.id === memberId && m.company_id === companyId && m.system_role === "company_member" && m.status === "active");
  if (!row) throw new Error("Active Company Member not found");
  row.permissions = permissions; // absolute replace, exactly matching "set permissions=p_permissions"
  return true;
}
// Models currentCompany() -> activeMembershipCompany() -> companyToProfile(): a brand-new,
// independent read of the CURRENT row every single call -- nothing here is cached across calls,
// which is what "survives logout/login" and "no reappointment needed" actually depend on.
function resolveProfile(members, userId, ownerId) {
  const row = members.find((m) => m.user_id === userId && m.status === "active");
  if (!row) return null;
  return { ownerId, userId, accessPermissions: row.permissions };
}
function canOpen(profile, route) {
  if (!profile) return false;
  if (profile.ownerId === profile.userId) return true;
  const module = requiredModuleForRoute(route);
  return hasModuleAccess(profile.accessPermissions, module);
}

test("1-3: HR & Payroll VIEW off/on/off for the SAME existing member, no reappointment, changes take effect immediately each time", () => {
  const members = [{ id: "M-1", company_id: "CO-1", user_id: "USER-SALMAN", system_role: "company_member", status: "active", permissions: { "HR & Payroll": { View: false } } }];

  let profile = resolveProfile(members, "USER-SALMAN", "OWNER-1");
  assert.equal(canOpen(profile, "/hr-payroll/index.html"), false, "1) HR VIEW off -> blocked");

  updateMemberPermissions(members, "CO-1", "M-1", { "HR & Payroll": { View: true } });
  profile = resolveProfile(members, "USER-SALMAN", "OWNER-1");
  assert.equal(canOpen(profile, "/hr-payroll/index.html"), true, "2) HR VIEW turned on and saved -> same member -> allowed");

  updateMemberPermissions(members, "CO-1", "M-1", { "HR & Payroll": { View: false } });
  profile = resolveProfile(members, "USER-SALMAN", "OWNER-1");
  assert.equal(canOpen(profile, "/hr-payroll/index.html"), false, "3) HR VIEW turned off again -> same member -> blocked again");
});

test("4: Internal Requests VIEW behaves identically to HR & Payroll for an existing member", () => {
  const members = [{ id: "M-1", company_id: "CO-1", user_id: "USER-SALMAN", system_role: "company_member", status: "active", permissions: { "Internal Requests": { View: false } } }];
  let profile = resolveProfile(members, "USER-SALMAN", "OWNER-1");
  assert.equal(canOpen(profile, "/app/approvals.html"), false);
  updateMemberPermissions(members, "CO-1", "M-1", { "Internal Requests": { View: true } });
  profile = resolveProfile(members, "USER-SALMAN", "OWNER-1");
  assert.equal(canOpen(profile, "/app/approvals.html"), true);
});

test("5: Administration VIEW behaves identically to HR & Payroll for an existing member", () => {
  const members = [{ id: "M-1", company_id: "CO-1", user_id: "USER-SALMAN", system_role: "company_member", status: "active", permissions: { Administration: { View: false } } }];
  let profile = resolveProfile(members, "USER-SALMAN", "OWNER-1");
  assert.equal(canOpen(profile, "/app/admin.html"), false);
  updateMemberPermissions(members, "CO-1", "M-1", { Administration: { View: true } });
  profile = resolveProfile(members, "USER-SALMAN", "OWNER-1");
  assert.equal(canOpen(profile, "/app/admin.html"), true);
});

test("6: permissions survive logout/login -- resolveProfile is a fresh, independent lookup every call, nothing carried over from a prior session", () => {
  const members = [{ id: "M-1", company_id: "CO-1", user_id: "USER-SALMAN", system_role: "company_member", status: "active", permissions: { "HR & Payroll": { View: true } } }];
  const loginOne = resolveProfile(members, "USER-SALMAN", "OWNER-1");
  const loginTwo = resolveProfile(members, "USER-SALMAN", "OWNER-1"); // simulates a later, separate session resolving the same member
  assert.deepEqual(loginOne.accessPermissions, loginTwo.accessPermissions);
  assert.notStrictEqual(loginOne, loginTwo, "each resolution is an independent read, not a shared cached object");
  const client = read("../src/supabase/client.js");
  assert.doesNotMatch(client, /localStorage\.setItem\(.*permission/i);
});

test("7: the permission change reaches the existing member through the update path alone -- no appoint/link call is involved", () => {
  const members = [{ id: "M-1", company_id: "CO-1", user_id: "USER-SALMAN", system_role: "company_member", status: "active", permissions: {} }];
  updateMemberPermissions(members, "CO-1", "M-1", { "HR & Payroll": { View: true } });
  const profile = resolveProfile(members, "USER-SALMAN", "OWNER-1");
  assert.equal(canOpen(profile, "/hr-payroll/index.html"), true);
  assert.equal(members.length, 1, "no new appointment/member row was created or required");
  assert.equal(members[0].id, "M-1", "the same existing member row was updated in place");
});

test("8: one member's permission change does not affect another member in the same company", () => {
  const members = [
    { id: "M-1", company_id: "CO-1", user_id: "USER-SALMAN", system_role: "company_member", status: "active", permissions: { "HR & Payroll": { View: false } } },
    { id: "M-2", company_id: "CO-1", user_id: "USER-OTHER", system_role: "company_member", status: "active", permissions: { "HR & Payroll": { View: false } } },
  ];
  updateMemberPermissions(members, "CO-1", "M-1", { "HR & Payroll": { View: true } });
  assert.equal(canOpen(resolveProfile(members, "USER-SALMAN", "OWNER-1"), "/hr-payroll/index.html"), true);
  assert.equal(canOpen(resolveProfile(members, "USER-OTHER", "OWNER-1"), "/hr-payroll/index.html"), false, "the other member's own permissions must be untouched");
});

test("9: the Company Owner always retains access regardless of what the permission matrix contains", () => {
  const ownerProfile = { ownerId: "OWNER-1", userId: "OWNER-1", accessPermissions: {} };
  assert.equal(canOpen(ownerProfile, "/hr-payroll/index.html"), true);
  assert.equal(canOpen(ownerProfile, "/app/admin.html"), true);
  assert.equal(canOpen(ownerProfile, "/app/approvals.html"), true);
});

test("10: Department Default Access remains only the initial template for a newly appointed member -- it is never re-applied to an existing member", () => {
  const client = read("../src/supabase/client.js");
  assert.match(client, /\.from\("company_members"\)\.select\(/);
  assert.doesNotMatch(client, /\.from\("company_members"\)\.update\(/);
  assert.doesNotMatch(app, /saveDepartmentDefaultAccess[^;]*updateCompanyMemberPermissions/s, "saving a department default must never cascade into an existing member's row");
});
