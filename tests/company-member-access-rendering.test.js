import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const app = read("../src/administration/app.js");
const sql = read("../supabase/company-member-appointments.sql");
const client = read("../src/company/member-permissions.js");

// ---- Root cause: Company Member Access and Protected System Roles were both driven by the
// SAME single fetch (company_role_directory / roleRows / roleLoading / roleError). If that one
// combined RPC call ever failed, "Company Member Access" silently rendered as an EMPTY STRING
// (no rows, no error message) while "Protected System Roles" showed its own error banner --
// looking exactly like "Company Member Access is empty" even though active members like Salman
// existed and were already visible under Users & Members (a completely different RPC). ----

test("Company Member Access is now backed by its own independent RPC, decoupled from Protected System Roles", () => {
  assert.match(sql, /create or replace function public\.company_member_permission_directory\(/);
  const fn = sql.slice(sql.indexOf("function public.company_member_permission_directory"), sql.indexOf("-- 9. APPOINTMENT AUDIT"));
  assert.match(fn, /from public\.company_members m/);
  assert.doesNotMatch(fn, /auth\.users|public\.companies/, "must not depend on the Owner/auth.users join that Protected System Roles needs");
  assert.match(fn, /m\.status = 'active'/);
  assert.match(fn, /m\.system_role = 'company_member'/);
  assert.match(client, /companyMemberPermissionDirectory/);
  assert.match(app, /memberPermissionRows=await companyMemberPermissionDirectory\(globalThis\.InfoBridgeCompany\.companyId\)/);
});

test("Company Member Access has its own loading/error state, separate from roleLoading/roleError", () => {
  assert.match(app, /memberPermissionRows=\[\],memberPermissionLoading=false,memberPermissionError=""/);
  assert.match(app, /async function refreshMemberPermissions\(\)/);
  const memberTableExpr = app.slice(app.indexOf("memberTable=memberPermissionLoading"), app.indexOf("memberTable=memberPermissionLoading") + 400);
  assert.doesNotMatch(memberTableExpr, /roleLoading|roleError/, "Company Member Access rendering must not read Protected System Roles' loading/error flags");
});

test("a Protected System Roles failure cannot blank Company Member Access -- they are fetched by two independent functions", () => {
  assert.match(app, /async function refreshRoleDirectory\(\)\{if\(!globalThis\.InfoBridgeCompany\?\.companyId\)return;roleLoading=true;roleError="";/);
  assert.match(app, /async function refreshMemberPermissions\(\)\{if\(!globalThis\.InfoBridgeCompany\?\.companyId\)return;memberPermissionLoading=true;memberPermissionError="";/);
  assert.notEqual(app.indexOf("async function refreshRoleDirectory"), app.indexOf("async function refreshMemberPermissions"));
  assert.match(app, /if\(!roles\.loaded&&!roleLoading\)\{roles\.loaded=true;setTimeout\(refreshRoleDirectory\)\}if\(!roles\.memberPermissionsLoaded&&!memberPermissionLoading\)\{roles\.memberPermissionsLoaded=true;setTimeout\(refreshMemberPermissions\)\}/, "both fetches must be kicked off independently when the Roles & Permissions view first opens");
});

test("Company Member Access no longer surfaces silently as an empty string on error -- it shows its own message", () => {
  assert.match(app, /memberPermissionError\?`<div class="empty"><h3>Company Member Access is not available yet<\/h3><p>\$\{esc\(memberPermissionError\)\}<\/p><\/div>`/);
});

test("Edit Permissions / Remove Access / Save Permissions for a real member now read and refresh from the independent Company Member Access list", () => {
  assert.match(app, /showMemberPermissions\(memberPermissionRows\.find\(\(x=>x\.member_id===button\.dataset\.editMemberPermissions\)\),false\)/);
  assert.match(app, /const member=memberPermissionRows\.find\(\(x=>x\.member_id===button\.dataset\.removeMemberAccess\)\)/);
  assert.match(app, /toast\("Company Member access removed\."\);await refreshMemberPermissions\(\)/);
  assert.match(app, /toast\("Member permissions saved\."\);await refreshMemberPermissions\(\)/);
});

test("Save Permissions still persists directly to public.company_members.permissions via the existing, unchanged update RPC", () => {
  const flat = (text) => text.replace(/\s+/g, "");
  const memberPermissionsSql = flat(read("../supabase/company-member-permissions.sql"));
  assert.match(memberPermissionsSql, /setpermissions=p_permissions,updated_at=now\(\)/);
  assert.match(app, /updateCompanyMemberPermissions\(globalThis\.InfoBridgeCompany\.companyId,member\.member_id,next\)/);
});

test("Default Department Access is completely untouched by this change", () => {
  assert.match(app, /showDepartmentDefaultAccess\(button\.dataset\.editDefaultAccess,button\.dataset\.tier\)/);
  assert.match(app, /saveDepartmentDefaultAccess\(state,departmentId,tier,next\)/);
  assert.doesNotMatch(app.slice(app.indexOf("function showDepartmentDefaultAccess"), app.indexOf("function moduleAccess()")), /memberPermissionRows|refreshMemberPermissions/);
});

// ---- update_company_member_permissions lives in a DIFFERENT SQL file
// (company-member-permissions.sql) than the one that defines appointment/linking and the
// Company Member Access listing (company-member-appointments.sql). If only the appointments
// file has been applied to a given Supabase project, saving permissions fails with a
// "function not found" error -- this must be surfaced clearly, not swallowed. ----

// ---- The reported crash: "Cannot set properties of null (setting 'disabled')" at
// form.onsubmit. Root cause: modal()'s generated primary button had no explicit type
// attribute (`<button class="btn primary">${label}</button>`). A <button> inside a <form>
// defaults to submit BEHAVIOR without one, but `form.querySelector('[type="submit"]')` is an
// attribute selector -- it only matches an explicit type="submit" attribute, so it always
// returned null, and the very next line (submit.disabled=true) threw. ----

test("modal()'s primary button has an explicit type=\"submit\" attribute, so form.querySelector('[type=\"submit\"]') can actually find it", () => {
  assert.match(app, /<button type="submit" class="btn primary">\$\{label\}<\/button>/);
});

test("the Save Permissions handler never dereferences a null button -- disabled/type/onclick are only touched when the lookup actually found an element", () => {
  const fn = app.slice(app.indexOf("function showMemberPermissions"), app.indexOf("function companyForm"));
  assert.match(fn, /const form=\$\("#admin-modal form"\),submit=form\?\.querySelector\('\[type="submit"\]'\)\|\|null;/);
  assert.match(fn, /if\(readonly\|\|fixed\)\{if\(submit\)\{submit\.type="button";submit\.onclick=\(\)=>\$\("#admin-modal"\)\.innerHTML=""\}return\}/);
  assert.match(fn, /if\(submit\)submit\.disabled=true/);
  assert.match(fn, /if\(submit\)submit\.disabled=false/);
  assert.doesNotMatch(fn, /(?<!if\(submit\))submit\.disabled=/, "every submit.disabled write must be guarded");
});

test("Save Permissions reaches updateCompanyMemberPermissions() with the collected checkbox state, then refreshes and closes the modal only on success", () => {
  const fn = app.slice(app.indexOf("function showMemberPermissions"), app.indexOf("function companyForm"));
  const order = ["await updateCompanyMemberPermissions(globalThis.InfoBridgeCompany.companyId,member.member_id,next)", 'toast("Member permissions saved.")', "await refreshMemberPermissions()", '$("#admin-modal").innerHTML=""'];
  let cursor = -1;
  for (const step of order) { const at = fn.indexOf(step, cursor + 1); assert.ok(at > cursor, `expected "${step}" after position ${cursor}`); cursor = at; }
});

test("on failure the modal stays open, the real button is re-enabled, and the actual error is shown -- nothing is swallowed", () => {
  const fn = app.slice(app.indexOf("function showMemberPermissions"), app.indexOf("function companyForm"));
  const catchBlock = fn.slice(fn.indexOf("catch(error)"));
  assert.doesNotMatch(catchBlock, /\$\("#admin-modal"\)\.innerHTML=""/, "the modal must not be closed on failure");
  assert.match(catchBlock, /toast\(.*error\.message.*true\)/);
  assert.match(catchBlock, /if\(submit\)submit\.disabled=false/);
});

test("update_company_member_permissions is defined only in company-member-permissions.sql, not in company-member-appointments.sql", () => {
  const flat = (text) => text.replace(/\s+/g, "");
  const appointmentsSql = read("../supabase/company-member-appointments.sql");
  const memberPermissionsSql = read("../supabase/company-member-permissions.sql");
  assert.doesNotMatch(appointmentsSql, /function public\.update_company_member_permissions/);
  assert.match(flat(memberPermissionsSql), /createorreplacefunctionpublic\.update_company_member_permissions\(p_company_iduuid,p_member_iduuid,p_permissionsjsonb\)/);
});

test("a missing update_company_member_permissions function (schema-cache / not-found error) is surfaced with an actionable message, not a raw or swallowed error", () => {
  const fn = app.slice(app.indexOf("function showMemberPermissions"), app.indexOf("function companyForm"));
  const catchBlock = fn.slice(fn.indexOf("catch(error)"));
  assert.match(catchBlock, /toast\(\/update_company_member_permissions\|schema cache\/i\.test\(error\.message\|\|""\)\?"Apply the Company Member Permissions database migration \(supabase\/company-member-permissions\.sql\) before saving member permissions\."/);
  assert.doesNotMatch(catchBlock, /catch\(error\)\{\}/, "the error must never be swallowed");
});

test("appointment/linking, Master Key, Google OAuth, audit and Owner onboarding SQL sections are unmodified by this fix", () => {
  assert.match(sql, /create or replace function public\.appoint_company_member\(/);
  assert.match(sql, /create or replace function public\.link_pending_company_member\(\)/);
  assert.match(sql, /notify pgrst, 'reload schema';/);
});
