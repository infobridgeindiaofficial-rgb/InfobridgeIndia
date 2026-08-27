import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const flat = (text) => text.replace(/\s+/g, "");

const sql = read("../supabase/company-deletion.sql");
const flatSql = flat(sql);
const securityClient = read("../src/security/client.js");
const companySecurityJs = read("../src/scripts/company-security.js");
const companyPage = read("../src/pages/marketing/company.js");
const migrationSql = read("../supabase/migration.sql");
const companyAdminSql = read("../supabase/company-admin-invitations.sql");
const companySecuritySql = read("../supabase/company-security.sql");
const auditSql = read("../supabase/company-audit-log.sql");
const appointmentsSql = read("../supabase/company-member-appointments.sql");

// ---- 1: non-owner cannot delete ----
test("delete_company rejects a caller who is not the company's owner", () => {
  assert.match(flatSql, /ifauth\.uid\(\)isnullthen/);
  assert.match(flatSql, /ifv_company\.owner_id<>auth\.uid\(\)thenraiseexception'Notauthorized'/);
  // enforced a second time at the point of deletion, never trusting the earlier check alone
  assert.match(flatSql, /deletefrompublic\.companieswhereid=p_company_idandowner_id=auth\.uid\(\);/);
});

// ---- 2: incorrect Master Key cannot delete ----
test("delete_company requires Master Key verification via the existing secure mechanism before deleting anything", () => {
  assert.match(flatSql, /ifnotprivate\.check_master_key\(p_company_id,p_master_key\)thenraiseexception'MasterKeyverificationfailed';endif;/);
  const beforeCheck = sql.slice(0, sql.indexOf("check_master_key"));
  assert.doesNotMatch(beforeCheck, /delete from public\.companies/, "no deletion may occur before Master Key verification");
  assert.doesNotMatch(sql, /master_key_hash/, "the stored key hash itself must never be read back out or exposed by this function");
});

// ---- 3: owner + correct Master Key + correct confirmation can delete ----
test("delete_company also requires typing the exact company name before deleting, and performs the actual delete", () => {
  assert.match(flatSql, /iftrim\(coalesce\(p_confirm_name,''\)\)<>v_company\.namethenraiseexception'Companynameconfirmationdoesnotmatch'/);
  assert.match(sql, /returns boolean/);
  assert.match(flatSql, /returntrue;/);
});

// ---- 4 & 5: company-owned records and memberships are removed via cascade, not manual per-table deletes ----
test("every company-scoped table in the schema cascades from public.companies, so one delete removes all company data and memberships", () => {
  const cascadeTables = [
    { file: migrationSql, name: "workspace_records (all module business data)" },
    { file: companyAdminSql, name: "company_members" },
    { file: appointmentsSql, name: "company_member_appointments" },
    { file: companySecuritySql, name: "company_security / department_reset_keys / company_security_audit" },
    { file: auditSql, name: "company_audit_log" },
  ];
  for (const { file, name } of cascadeTables) {
    assert.match(flat(file), /referencespublic\.companies\(id\)ondeletecascade/, `${name} must cascade from public.companies`);
  }
  // delete_company itself does not manually enumerate tables -- a single statement is
  // the whole deletion, which is what makes it atomic and all-or-nothing.
  assert.equal((sql.match(/delete from/gi) || []).length, 1, "exactly one DELETE statement -- everything else is cascade, not manual per-table cleanup");
});

// ---- 6: Supabase Auth users are never deleted ----
test("delete_company never deletes or touches auth.users, and the schema's cascade direction cannot reach it", () => {
  const functionBody = sql.slice(sql.indexOf("as $$"), sql.lastIndexOf("$$;"));
  assert.doesNotMatch(functionBody, /auth\.users/, "the function body itself must never read or write auth.users -- only the explanatory header comments may mention it");
  assert.doesNotMatch(flatSql, /deletefromauth\.users/);
  // companies.owner_id and company_members.user_id reference auth.users -- cascade only
  // flows FROM auth.users TO these tables, never the reverse, so deleting a company can
  // never cascade into deleting anyone's login account.
  assert.match(flat(migrationSql), /owner_iduuidnotnulluniquereferencesauth\.users\(id\)ondeletecascade/);
  assert.match(flat(companyAdminSql), /user_iduuidnotnullreferencesauth\.users\(id\)ondeletecascade/);
});

// ---- 7: unrelated companies are never affected -- every scoping is by this exact company_id ----
test("deletion is scoped to exactly the target company_id -- an unrelated company can never be affected", () => {
  assert.match(flatSql, /select\*intov_companyfrompublic\.companieswhereid=p_company_id;/);
  assert.doesNotMatch(sql, /company_id\s*<>|company_id\s*!=|where\s+true/i);
});

// ---- 8: a failed deletion cannot leave partial data ----
test("a single DELETE statement inside a SECURITY DEFINER function is atomic -- any failure rolls back the whole operation", () => {
  assert.match(sql, /language plpgsql/);
  assert.match(sql, /security definer/);
  assert.match(flatSql, /ifnotfoundthenraiseexception'Companynotfoundoralreadydeleted';endif;/);
});

// ---- RLS / privilege hardening ----
test("delete_company is locked down: controlled search_path, no public/anon execute", () => {
  assert.match(sql, /set search_path = pg_catalog, public, private/);
  assert.match(flatSql, /revokeallonfunctionpublic\.delete_company\(uuid,text,text\)frompublic,anon;/);
  assert.match(flatSql, /grantexecuteonfunctionpublic\.delete_company\(uuid,text,text\)toauthenticated;/);
});

// ---- storage / audit reporting is documented, not silently ignored ----
test("the migration documents that no Supabase Storage cleanup is needed and that per-company audit rows cannot survive deletion", () => {
  assert.match(sql, /No Supabase Storage usage exists anywhere in this codebase/);
  assert.match(sql, /no audit trail of "this company was deleted"/);
  assert.match(sql, /can survive the deletion itself/);
});

// ---- frontend: enabling the existing button, in the existing Danger Zone, existing style ----
test("the existing Delete Company button is enabled in place, Reset Entire Company remains disabled and untouched", () => {
  assert.match(companyPage, /Reset Entire Company — Unavailable/);
  assert.match(companyPage, /data-delete-company-open/);
  assert.doesNotMatch(companyPage, /Delete Company — Unavailable/);
  assert.match(companyPage, /Type the company name/);
  assert.match(companyPage, /Company Master Key/);
});

test("deleteCompany() calls the new RPC with the company id, master key and typed confirmation, never a stored/returned key", () => {
  assert.match(securityClient, /export const deleteCompany=\(companyId,masterKey,confirmName\)=>rpc\("delete_company",\{p_company_id:companyId,p_master_key:masterKey,p_confirm_name:confirmName\}\);/);
});

// ---- 9: frontend clears stale cached/local company state on success ----
test("on successful deletion the frontend clears cached Administration/module state and the in-memory company cache before navigating away", () => {
  assert.match(companySecurityJs, /ADMINISTRATION_KEY,\.\.\.ADMINISTRATION_MODULE_KEYS,"infobridgeindia\.auth\.session\.v1","infobridgeindia\.company\.profile\.v1"\]\.forEach\(key=>localStorage\.removeItem\(key\)\)/);
  assert.match(companySecurityJs, /clearCompanyCache\(\)/);
  assert.match(companySecurityJs, /import\{KEY as ADMINISTRATION_KEY,MODULE_KEYS as ADMINISTRATION_MODULE_KEYS\}from"\/administration-workspace\/repository\.js"/);
});

// ---- 10: owner reaches company setup after deletion, stays logged in, nothing auto-recreated ----
test("on success the owner is redirected to company setup without signing out, and nothing is auto-recreated", () => {
  const submitHandler = companySecurityJs.slice(companySecurityJs.indexOf('deleteForm?.addEventListener("submit"'));
  assert.match(submitHandler, /location\.replace\("\/company-setup\.html"\)/);
  assert.doesNotMatch(submitHandler, /signOut/);
});

// ---- failure path: keep the panel usable, show the real error, re-enable the button ----
test("on failure the panel stays open, the real error is shown, the button is re-enabled and relabeled -- nothing is swallowed", () => {
  const submitHandler = companySecurityJs.slice(companySecurityJs.indexOf('deleteForm?.addEventListener("submit"'));
  const catchBlock = submitHandler.slice(submitHandler.indexOf("catch(cause)"));
  assert.doesNotMatch(catchBlock, /deletePanel\.hidden=true/, "the confirmation panel must not be closed on failure");
  assert.match(catchBlock, /console\.error\("Delete Company failed:",cause\)/, "the real error must reach the browser console for debugging even when a friendlier message is shown");
  assert.match(catchBlock, /cause\.message\|\|"Unable to delete the company\."/);
  assert.match(catchBlock, /if\(submit\)\{submit\.disabled=false;submit\.textContent=originalLabel\}/);
});

// ---- duplicate-submit protection and immediate visual feedback that the click was received ----
test("the submit button is disabled and relabeled to a processing state while the deletion request is in flight", () => {
  const start = companySecurityJs.indexOf('deleteForm?.addEventListener("submit"');
  const submitHandler = companySecurityJs.slice(start, companySecurityJs.indexOf("catch(cause)", start));
  assert.match(submitHandler, /if\(submit\)\{submit\.disabled=true;submit\.textContent="Deleting…"\}/);
});

// ---- Follow-up bug: a message shown while scrolled down to the Danger Zone (the last section
// on the page) was invisible above the fold -- looking exactly like "nothing happened" even
// though the DOM was updated correctly. Also: wrong name vs. wrong Master Key must be
// distinguishable, and a real "function not found" must never look identical to "wrong key". ----

test("every message() call scrolls the banner into view, so feedback is never invisible off-screen while scrolled down to the Danger Zone", () => {
  const messageFn = companySecurityJs.slice(companySecurityJs.indexOf("function message("), companySecurityJs.indexOf("function render("));
  assert.match(messageFn, /box\.hidden=false;box\.scrollIntoView\(\{behavior:"smooth",block:"center"\}\)/);
});

test("the entire delete submit handler -- including the company-name pre-check -- runs inside one try block, so no failure path can end silently", () => {
  const start = companySecurityJs.indexOf('deleteForm?.addEventListener("submit"');
  const submitHandler = companySecurityJs.slice(start, companySecurityJs.indexOf("});", companySecurityJs.indexOf("try{", start)));
  const tryPos = submitHandler.indexOf("try{");
  const nameCheckPos = submitHandler.indexOf("confirmName", tryPos);
  const disablePos = submitHandler.indexOf('submit.disabled=true;submit.textContent="Deleting…"');
  const rpcCallPos = submitHandler.indexOf("await deleteCompany(");
  assert.ok(tryPos !== -1 && tryPos < nameCheckPos, "the company-name check must be inside the try block, not before it");
  assert.ok(nameCheckPos < disablePos && disablePos < rpcCallPos, "the name check must throw before the button is disabled or the RPC is called");
  assert.match(submitHandler, /if\(String\(values\.confirmName\|\|""\)\.trim\(\)!==\(company\.name\|\|""\)\) throw new Error\(`Type the exact company name \(\$\{company\.name\}\) to confirm\.`\);/);
});

test("a wrong Master Key surfaces the server's own distinct 'Master Key verification failed' message via the normal catch path", () => {
  assert.match(flatSql, /raiseexception'MasterKeyverificationfailed';/);
  const start = companySecurityJs.indexOf('deleteForm?.addEventListener("submit"');
  const catchBlock = companySecurityJs.slice(companySecurityJs.indexOf("catch(cause)", start));
  assert.match(catchBlock, /cause\.message\|\|"Unable to delete the company\."/, "a real error message (e.g. 'Master Key verification failed') is passed through, not replaced with a generic one");
});

test("a missing delete_company function (unapplied migration / stale schema cache) is surfaced with an actionable message naming the migration file, not a raw or silent failure", () => {
  const start = companySecurityJs.indexOf('deleteForm?.addEventListener("submit"');
  const catchBlock = companySecurityJs.slice(companySecurityJs.indexOf("catch(cause)", start));
  assert.match(catchBlock, /\/delete_company\|schema cache\/i\.test\(cause\.message\|\|""\)\?"Apply the Company Deletion database migration \(supabase\/company-deletion\.sql\) before deleting a company\."/);
});

test("client-side and server-side company-name comparison use the same exact, case-sensitive, trimmed-input match -- an email or unrelated text can never satisfy it", () => {
  assert.match(companySecurityJs, /String\(values\.confirmName\|\|""\)\.trim\(\)!==\(company\.name\|\|""\)/);
  assert.match(flatSql, /iftrim\(coalesce\(p_confirm_name,''\)\)<>v_company\.namethen/);
});
