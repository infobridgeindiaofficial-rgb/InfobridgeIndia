import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootstrap, defaultState, saveDepartmentDefaultAccess, departmentDefaultAccessFor } from "../src/administration/core.js";
import { ensureDefaultDepartments, DEPARTMENT_MODULE_BY_CODE } from "../src/administration/departments.js";

const root = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
// SQL is pretty-printed (real newlines/indentation), so structural checks below match
// against whitespace-stripped text -- immune to reformatting, since both sides of the
// comparison have every run of whitespace removed the same way.
const flat = (text) => text.replace(/\s+/g, "");

const sql = read("../supabase/company-member-appointments.sql");
const cleanupSql = read("../supabase/cleanup-old-invitation-system.sql");
const app = read("../src/administration/app.js");
const api = read("../src/company/member-appointments.js");
const client = read("../src/supabase/client.js");
const authUi = read("../src/scripts/auth-ui.js");
const companyPage = read("../src/pages/marketing/company.js");
const companyProfileScript = read("../src/scripts/company-profile.js");
const buildJs = read("../build.js");

// ---- SQL: appointment creation is token-less, permission-gated, and never grants ownership ----

test("appoint_company_member requires can_manage_company_members and never generates a token", () => {
  assert.match(sql, /create or replace function public\.appoint_company_member\(/);
  assert.match(flat(sql), /ifnotprivate\.can_manage_company_members\(p_company_id\)thenraiseexception'Notauthorized'/);
  assert.doesNotMatch(flat(sql.slice(sql.indexOf("function public.appoint_company_member"), sql.indexOf("function public.cancel_company_member_appointment"))), /gen_random_bytes|token_hash/);
});

test("can_manage_company_members is permission-driven: owner, OR legacy company_admin, OR Administration -> Manage Users -- never Position/Designation", () => {
  const fn = flat(sql.slice(sql.indexOf("function private.can_manage_company_members"), sql.indexOf("function public.appoint_company_member")));
  assert.match(fn, /private\.is_company_owner\(p_company_id\)/);
  assert.match(fn, /system_role='company_admin'/);
  assert.match(fn, /permissions->'Administration'->>'ManageUsers'/);
  assert.doesNotMatch(fn.toLowerCase(), /position/);
});

test("appointment validates the department against the real company Department Master (workspace_records), not a hardcoded list", () => {
  const fn = flat(sql.slice(sql.indexOf("function public.appoint_company_member"), sql.indexOf("function public.cancel_company_member_appointment")));
  assert.match(fn, /jsonb_array_elements\(coalesce\(wr\.data->'departments'/);
  assert.match(fn, /wr\.module='administration'/);
  assert.match(fn, /d->>'companyId'=p_company_id::text/);
});

test("appointment status model has no token/expiry fields; pending/linked/revoked only, one pending per email", () => {
  assert.match(sql, /create table if not exists private\.company_member_appointments/);
  assert.match(flat(sql), /statusin\('pending','linked','revoked'\)/);
  assert.doesNotMatch(flat(sql), /company_member_appointments[\s\S]{0,600}token_hash/);
  assert.match(sql, /company_one_pending_appointment_per_email/);
});

// ---- SQL: linking trusts only the server-verified JWT email, never a frontend value ----

test("link_pending_company_member takes no email argument and derives it only from auth.jwt()->>'email'", () => {
  assert.match(sql, /create or replace function public\.link_pending_company_member\(\)/);
  const fn = flat(sql.slice(sql.indexOf("function public.link_pending_company_member"), sql.indexOf("function public.company_member_directory")));
  assert.match(fn, /auth\.jwt\(\)->>'email'/);
  assert.doesNotMatch(fn, /p_email/);
});

test("linking always creates system_role='company_member' -- ownership can never be granted through this flow", () => {
  const fn = flat(sql.slice(sql.indexOf("function public.link_pending_company_member"), sql.indexOf("function public.company_member_directory")));
  assert.match(fn, /'company_member','active'/);
  assert.doesNotMatch(fn, /'owner'/);
});

test("linking seeds permissions from the department's Member or Head default access template depending on is_department_head", () => {
  const fn = flat(sql.slice(sql.indexOf("function public.link_pending_company_member"), sql.indexOf("function public.company_member_directory")));
  assert.match(fn, /is_department_headthen'headPermissions'else'memberPermissions'/);
  assert.match(fn, /wr\.data->'departmentDefaultAccess'/);
});

// ---- SQL: directory, roles, and cleanup ----

test("company_member_directory unions active/inactive company_members with pending appointments", () => {
  const fn = flat(sql.slice(sql.indexOf("function public.company_member_directory"), sql.indexOf("function public.company_role_directory")));
  assert.match(fn, /frompublic\.company_membersmwherem\.company_id=p_company_idandm\.system_role='company_member'/);
  assert.match(fn, /fromprivate\.company_member_appointmentsawherea\.company_id=p_company_idanda\.status='pending'/);
  assert.match(fn, /'pending'/);
});

test("company_role_directory reads department and head status directly off company_members (no fragile lateral join to a retiring invitation table)", () => {
  const flatSql = flat(sql), start = flatSql.indexOf("dropfunctionifexistspublic.company_role_directory");
  const fn = flatSql.slice(start, flatSql.indexOf("revokeallonfunction", start));
  assert.match(fn, /coalesce\(m\.department_name,''\),m\.is_department_head/);
  assert.doesNotMatch(fn, /company_member_invitations/);
});

test("the cleanup migration is clearly marked manual-review-only and is not referenced anywhere the app would run it automatically", () => {
  assert.match(cleanupSql, /REVIEW BEFORE RUNNING/);
  assert.match(cleanupSql, /DO NOT RUN AUTOMATICALLY/);
  assert.match(cleanupSql, /drop table if exists private\.company_admin_invitations/);
  assert.match(cleanupSql, /drop table if exists private\.company_member_invitations/);
  assert.doesNotMatch(cleanupSql, /drop table if exists public\.company_members/);
  assert.doesNotMatch(buildJs, /cleanup-old-invitation-system/);
  assert.doesNotMatch(app, /cleanup-old-invitation-system/);
});

test("the cleanup migration never touches companies, workspace_records, or the shared owner/member RLS helpers", () => {
  assert.doesNotMatch(cleanupSql, /drop table if exists public\.companies/);
  assert.doesNotMatch(cleanupSql, /drop table if exists public\.workspace_records/);
  assert.doesNotMatch(cleanupSql, /drop function if exists private\.is_company_owner/);
  assert.doesNotMatch(cleanupSql, /drop function if exists private\.active_company_member/);
});

// ---- Administration workspace: the loaded state's company/department identity must be
// reconciled to the authenticated Supabase company synchronously, not inside a
// DOMContentLoaded listener registered after the async workspace-storage bootstrap (that
// event has always already fired by then, so the listener never runs and department rows
// keep the local placeholder companyId forever -- causing "Select an active department
// belonging to this company" for every department and email). ----

test("Administration state is reconciled to the authenticated company synchronously, not inside a dead DOMContentLoaded listener", () => {
  const posStorageAwait = app.indexOf("await Promise.race([createWorkspaceStateStorage()");
  const posStateLoad = app.indexOf("let state=repo.load()");
  const posReconcile = app.indexOf("reconcileAdministrationCompany(state,globalThis.InfoBridgeCompany)");
  assert.ok(posStorageAwait !== -1 && posStateLoad !== -1 && posReconcile !== -1, "expected bootstrap markers to be present");
  assert.ok(posStorageAwait < posStateLoad, "workspace storage must resolve before state loads");
  assert.ok(posReconcile > posStateLoad, "reconciliation must run only after state is loaded");
  const reconcileStatement = app.slice(posReconcile - 40, posReconcile + 40);
  assert.doesNotMatch(reconcileStatement, /addEventListener\("DOMContentLoaded"/, "reconciliation must not be gated behind a DOMContentLoaded listener registered after an async await");
  assert.match(app, /if\(globalThis\.InfoBridgeCompany\)\{reconcileAdministrationCompany\(state,globalThis\.InfoBridgeCompany\);reconcileCompanyHeadOffice\(state,state\.companies\.find\(\(x=>x\.id===state\.currentCompanyId\)\)\);repo\.save\(state\)\}/);
});

// ---- JS client wrapper: no token plumbing ----

test("the JS appointment client has no token, resend, or acceptance-URL concepts", () => {
  assert.match(api, /export async function appointCompanyMember/);
  assert.match(api, /export const cancelCompanyMemberAppointment/);
  for (const gone of ["invitation_token", "acceptanceUrl", "resendCompanyMember", "signInWithOtp", "memberInvitationUrl"]) assert.doesNotMatch(api, new RegExp(gone));
});

// ---- src/supabase/client.js: email-linking fallback, never a security weakening ----

test("currentCompany() tries link_pending_company_member only as a fallback when no owned/active company is found, and never sends a frontend email to the RPC", () => {
  assert.match(client, /link_pending_company_member/);
  const fn = client.slice(client.indexOf("async function linkPendingAppointmentIfAny"), client.indexOf("export async function currentCompany"));
  assert.doesNotMatch(fn, /email/i);
  assert.match(client, /if\(!company&&await linkPendingAppointmentIfAny\(client\)\)company=await activeMembershipCompany\(client,user\.id\)/);
});

test("link_pending_company_member RPC errors are never silently swallowed into a false 'no company' result", () => {
  const fn = client.slice(client.indexOf("async function linkPendingAppointmentIfAny"), client.indexOf("export async function currentCompany"));
  assert.doesNotMatch(fn, /catch/);
  assert.match(fn, /if\(error\)throw error/);
});

test("auth-gate.js surfaces a real company-resolution error on the post-auth landing page instead of misrouting an appointed member to company-setup", () => {
  const gate = readFileSync(new URL("../src/scripts/auth-gate.js", import.meta.url), "utf8");
  const posError = gate.indexOf("} else if (companyLoadError) {");
  const posAuthRoute = gate.indexOf('} else if (authRoute && user) {');
  assert.ok(posError !== -1 && posAuthRoute !== -1 && posError < posAuthRoute, "companyLoadError must be checked before the authRoute && user branch decides company-setup vs. workspace");
  assert.match(gate, /throw new Error\(`Saved company data could not be loaded\. Nothing was reset or overwritten\. \$\{companyLoadError\.message\}`\);/);
});

test("normal onboarding for a user with no appointment is unaffected: currentCompany still resolves owner first, and returns null when nothing matches", () => {
  assert.match(client, /const owned=await ownedCompany\(\);\s*\n\s*if\(owned\)return\{\.\.\.owned,access_role:"owner"/);
});

// ---- Administration app.js: Appoint Member UI ----

test("Users & Members is now Appoint Member / Company Members, not Invite Member / Send Invite", () => {
  const view = app.slice(app.indexOf("function members()"), app.indexOf("function roles()"));
  assert.match(view, />Appoint Member</);
  assert.match(view, /<h2>Company Members<\/h2>/);
  for (const gone of ["Send Invite", "Invited Members", "data-resend-member", "data-copy-member-url", "acceptanceUrl"]) assert.doesNotMatch(view, new RegExp(gone));
});

test("the Appoint Member form collects First Name, Last Name, Email, Position/Designation, Department, and an optional Department Head toggle", () => {
  const view = app.slice(app.indexOf("function members()"), app.indexOf("function roles()"));
  assert.match(view, /field\("firstName","First Name \*"/);
  assert.match(view, /field\("lastName","Last Name \*"/);
  assert.match(view, /field\("email","Email ID \*"/);
  assert.match(view, /field\("position","Position \/ Designation \*"/);
  assert.match(view, /name="departmentId"/);
  assert.match(view, /name="isDepartmentHead"/);
  assert.match(view, /Appoint as Department Head/);
});

test("Company Members list shows Pending Account / Active / Inactive statuses", () => {
  const view = app.slice(app.indexOf("function members()"), app.indexOf("function roles()"));
  assert.match(view, /pending:"Pending Account",active:"Active",inactive:"Inactive"/);
});

test("appointment submission calls appointCompanyMember with isDepartmentHead, and a pending row can be cancelled", () => {
  const view = app.slice(app.indexOf("function members()"), app.indexOf("function roles()"));
  assert.match(view, /appointCompanyMember\(profile\.companyId,\{firstName:values\.firstName,lastName:values\.lastName,email:values\.email,position:values\.position,departmentId:values\.departmentId,isDepartmentHead:form\.elements\.isDepartmentHead\?\.checked\}\)/);
  assert.match(view, /cancelCompanyMemberAppointment\(profile\.companyId,button\.dataset\.cancelAppointment\)/);
});

test("Appoint Member is visible to the Owner and to anyone whose effective permissions include Administration Manage Users, not merely by Position", () => {
  const view = app.slice(app.indexOf("function members()"), app.indexOf("function roles()"));
  assert.match(view, /canManage=access==="owner"\|\|access==="company_admin"\|\|Boolean\(profile\.accessPermissions\?\.Administration\?\.\["Manage Users"\]\)/);
});

// ---- Administration app.js: Roles & Permissions two sections ----

test("Roles & Permissions has a Default Department Access section (Member + Head columns) above Company Member Access", () => {
  const view = app.slice(app.indexOf("function roles()"), app.indexOf("function moduleAccess()"));
  assert.match(view, /<h2>Default Department Access<\/h2>/);
  assert.match(view, /Member Access.*Head Access/s);
  assert.match(view, /<h2>Company Member Access<\/h2>/);
  assert.match(view, /Position \/ Designation never controls this/);
});

test("editing default access for a department opens a Member or Head permission matrix and saves via saveDepartmentDefaultAccess (local Administration state, not a live RPC)", () => {
  assert.match(app, /function showDepartmentDefaultAccess\(departmentId,tier\)/);
  assert.match(app, /saveDepartmentDefaultAccess\(state,departmentId,tier,next\)/);
  assert.match(app, /data-edit-default-access/);
});

test("Company Member Access retains View / Edit Permissions / Remove Access for individual override, unchanged from the existing mechanism", () => {
  const view = app.slice(app.indexOf("function roles()"), app.indexOf("function moduleAccess()"));
  assert.match(view, /data-view-member-permissions/);
  assert.match(view, /data-edit-member-permissions/);
  assert.match(view, /data-remove-member-access/);
});

// ---- core.js: department default access data model ----

test("saveDepartmentDefaultAccess validates the department belongs to the current company and the tier is member or head", () => {
  const state = { ...defaultState(), currentCompanyId: "CO-1", departments: [{ id: "DEP-1", companyId: "CO-1" }] };
  assert.throws(() => saveDepartmentDefaultAccess(state, "DEP-MISSING", "member", {}), /Department not found/);
  assert.throws(() => saveDepartmentDefaultAccess(state, "DEP-1", "manager", {}), /Invalid access tier/);
  const result = saveDepartmentDefaultAccess(state, "DEP-1", "head", { "HR & Payroll": { View: true } });
  assert.deepEqual(result.record.headPermissions, { "HR & Payroll": { View: true } });
  assert.deepEqual(result.record.memberPermissions, {});
});

test("saveDepartmentDefaultAccess edits member and head tiers independently without clobbering each other", () => {
  let state = { ...defaultState(), currentCompanyId: "CO-1", departments: [{ id: "DEP-1", companyId: "CO-1" }] };
  state = saveDepartmentDefaultAccess(state, "DEP-1", "member", { "Sales & CRM": { View: true } }).state;
  state = saveDepartmentDefaultAccess(state, "DEP-1", "head", { "Sales & CRM": { View: true, Approve: true } }).state;
  const access = departmentDefaultAccessFor(state, "DEP-1");
  assert.deepEqual(access.memberPermissions, { "Sales & CRM": { View: true } });
  assert.deepEqual(access.headPermissions, { "Sales & CRM": { View: true, Approve: true } });
});

test("departmentDefaultAccessFor returns an empty-but-valid template for a department with no configured access yet", () => {
  const state = defaultState();
  const access = departmentDefaultAccessFor(state, "DEP-UNKNOWN");
  assert.deepEqual(access.memberPermissions, {});
  assert.deepEqual(access.headPermissions, {});
});

// ---- departments.js: organization membership and module permissions stay separate ----

test("an empty company receives neither application-module departments nor automatic access", () => {
  const state = { departments: [], departmentDefaultAccess: [], companies: [{ id: "CO-1" }], currentCompanyId: "CO-1" };
  ensureDefaultDepartments(state, ["CO-1"]);
  assert.deepEqual(state.departments, []);
  assert.deepEqual(state.departmentDefaultAccess, []);
  assert.deepEqual(DEPARTMENT_MODULE_BY_CODE, {});
});

test("an Owner can explicitly configure different Member and Head access for a real department", () => {
  let state = { ...defaultState(), currentCompanyId: "CO-1", companies: [{ id: "CO-1" }], departments: [{ id: "DEP-HK", companyId: "CO-1", name: "Housekeeping", code: "HK", active: true }] };
  state = saveDepartmentDefaultAccess(state, "DEP-HK", "member", { Documents: { View: true } }).state;
  state = saveDepartmentDefaultAccess(state, "DEP-HK", "head", { Documents: { View: true, Approve: true } }).state;
  const access = departmentDefaultAccessFor(state, "DEP-HK");
  assert.equal(access.memberPermissions.Documents.Approve, undefined);
  assert.equal(access.headPermissions.Documents.Approve, true);
});

test("department reconciliation preserves explicitly configured access without creating more", () => {
  const state = { departments: [{ id: "DEP-HK", companyId: "CO-1", name: "Housekeeping", code: "HK", active: true }], departmentDefaultAccess: [{ id: "DDA-1", companyId: "CO-1", departmentId: "DEP-HK", memberPermissions: { Custom: { View: true } }, headPermissions: {} }], companies: [{ id: "CO-1" }], currentCompanyId: "CO-1" };
  ensureDefaultDepartments(state, ["CO-1"]);
  ensureDefaultDepartments(state, ["CO-1"]);
  assert.equal(state.departmentDefaultAccess.length, 1);
  assert.deepEqual(state.departmentDefaultAccess[0].memberPermissions, { Custom: { View: true } });
});

test("a custom (non-system) department gets no automatic module access -- the Owner must configure it explicitly", () => {
  const state = { departments: [{ id: "DEP-CUSTOM", companyId: "CO-1", name: "Housekeeping", code: "HOUSE", active: true, isSystem: false }], companies: [{ id: "CO-1" }], currentCompanyId: "CO-1" };
  ensureDefaultDepartments(state, ["CO-1"]);
  assert.equal(state.departmentDefaultAccess.some((a) => a.departmentId === "DEP-CUSTOM"), false);
});

// ---- auth-ui.js: no more invitation-token redirect plumbing ----

test("auth-ui.js no longer has invite/memberInvite token redirect handling", () => {
  for (const gone of ["invitationToken", "memberInvitationToken", "invitationDestination", "invitationQuery", "company-admin-invite.html", "company-member-invite.html"]) assert.doesNotMatch(authUi, new RegExp(gone));
});

test("normal login/signup redirect logic is otherwise unchanged: login goes to company-setup, the mandatory Master Key step, or the workspace, signup goes to accountCreated", () => {
  assert.match(authUi, /location\.replace\("\/login\.html\?accountCreated=1"\)/);
  assert.match(authUi, /if \(!profile\) \{ location\.replace\("\/company-setup\.html"\); return; \}/);
  assert.match(authUi, /location\.replace\(masterKeyRequired \? "\/company-security\.html" : destinationAfterAuth\(sessionStorage\)\)/);
});

// ---- Removed feature: files, page registrations, and profile-page wiring ----

test("the old Company Admin invitation feature files are deleted, not just unlinked", () => {
  for (const gone of ["../src/company/admin-invitations.js", "../src/scripts/company-admin-invite.js", "../src/company/member-invitations.js", "../src/scripts/company-member-invite.js"]) {
    assert.equal(existsSync(root(gone)), false, `${gone} should have been deleted`);
  }
});

test("company.js no longer exports the admin/member invite acceptance pages or the Company Administration section", () => {
  for (const gone of ["companyAdminInvitePage", "companyMemberInvitePage", "data-company-administration", "Invite Company Admin", "data-invite-admin"]) assert.doesNotMatch(companyPage, new RegExp(gone));
});

test("build.js no longer registers the two removed invite-acceptance routes", () => {
  assert.doesNotMatch(buildJs, /companyAdminInvitePage/);
  assert.doesNotMatch(buildJs, /companyMemberInvitePage/);
});

test("company-profile.js no longer wires the Company Admin invite panel", () => {
  for (const gone of ["initializeCompanyAdministration", "inviteFirstCompanyAdmin", "resendFirstCompanyAdminInvitation", "revokeFirstCompanyAdminInvitation", "company-admin-status", "company-admin-invitation-created"]) assert.doesNotMatch(companyProfileScript, new RegExp(gone));
});

// ---- Existing Company Owner flow is untouched ----

test("the Company Owner's own setup/save flow in company-profile.js is untouched", () => {
  assert.match(companyProfileScript, /form\?\.addEventListener\("submit", async \(event\) => \{/);
  assert.match(companyProfileScript, /saveOwnedCompany/);
  assert.match(companyProfileScript, /destinationAfterSetup/);
});

test("Company Security remains fully separate and owner-gated, untouched by this change", () => {
  assert.match(companyPage, /companySecurityPage/);
  assert.match(companyPage, /data-company-security/);
});
