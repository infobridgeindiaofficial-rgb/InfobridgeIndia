import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const flat = (text) => text.replace(/\s+/g, "");

const sql = read("../supabase/company-master-key-recovery.sql");
const flatSql = flat(sql);
const securityClient = read("../src/security/client.js");
const companySecurityJs = read("../src/scripts/company-security.js");
const companyPage = read("../src/pages/marketing/company.js");
const companySecuritySql = read("../supabase/company-security.sql");
const deletionSql = read("../supabase/company-deletion.sql");
const migrationSql = read("../supabase/migration.sql");

// ---- 1 & 2: only the Company Owner can request or complete recovery, enforced in SQL ----

test("both recovery RPCs re-verify Company Owner ownership server-side, not just a frontend check", () => {
  assert.match(flatSql, /createorreplacefunctionpublic\.request_master_key_recovery\(p_company_iduuid\)/);
  const requestFn = sql.slice(sql.indexOf("function public.request_master_key_recovery"), sql.indexOf("function public.reset_master_key_after_recovery"));
  assert.match(requestFn, /if not private\.is_company_owner\(p_company_id\) then raise exception 'Not authorized'/);
  const resetFn = sql.slice(sql.indexOf("function public.reset_master_key_after_recovery"));
  assert.match(resetFn, /if not private\.is_company_owner\(p_company_id\) then raise exception 'Not authorized'/);
});

// ---- 3 & 4: only the authenticated owner's own session email is ever used; no email field
// exists anywhere in the recovery UI for the user to type an arbitrary address into ----

test("the recovery email is always the authenticated session's own email, never a typed-in address", () => {
  assert.match(companySecurityJs, /signInWithOtp\(\{email:user\.email,/);
  assert.doesNotMatch(companyPage.slice(companyPage.indexOf("data-master-key-recovery-panel"), companyPage.indexOf("data-master-key-recovery-form")), /<input[^>]*name="email"/);
  assert.doesNotMatch(companySecurityJs, /recoveryForm\.elements\.email|values\.email/);
});

test("the request RPC never accepts or stores an email parameter at all -- it is audit-only and takes only the company id", () => {
  const requestFn = sql.slice(sql.indexOf("function public.request_master_key_recovery"), sql.indexOf("function public.reset_master_key_after_recovery"));
  assert.doesNotMatch(requestFn, /email/i);
});

// ---- 5 & 6: invalid or expired verification cannot reset the key ----

test("a missing or expired email verification is rejected before any key change is attempted", () => {
  const resetFn = sql.slice(sql.indexOf("function public.reset_master_key_after_recovery"));
  const checkPos = resetFn.indexOf("v_otp_ts is null");
  const updatePos = resetFn.indexOf("insert into private.company_security");
  assert.ok(checkPos !== -1 && checkPos < updatePos, "the freshness check must run before the key is ever replaced");
  assert.match(resetFn, /to_timestamp\(\(e->>'timestamp'\)::numeric\) > now\(\) - interval '10 minutes'/);
  assert.match(resetFn, /raise exception 'Recovery verification has expired or was not completed/);
});

test("the freshness proof comes from Supabase's own signed JWT (amr), not a value the browser could fabricate", () => {
  const resetFn = sql.slice(sql.indexOf("function public.reset_master_key_after_recovery"));
  assert.match(resetFn, /auth\.jwt\(\)->'amr'/);
  assert.match(resetFn, /e->>'method' in \('otp','magiclink'\)/);
});

// ---- 7: a used verification cannot be reused ----

test("each verification event can be consumed exactly once, enforced by a database uniqueness constraint, not application logic alone", () => {
  assert.match(flatSql, /createtableifnotexistsprivate\.company_master_key_recovery_used\(/);
  assert.match(flatSql, /primarykey\(company_id,owner_id,otp_issued_at\)/);
  const resetFn = sql.slice(sql.indexOf("function public.reset_master_key_after_recovery"));
  assert.match(resetFn, /exception when unique_violation then/);
  assert.match(resetFn, /raise exception 'This recovery verification has already been used/);
});

// ---- 8: cannot be used to reset a different company's key ----

test("recovery cannot cross companies: owner_id is unique to one company by schema, and the used-token table is scoped by company_id too", () => {
  assert.match(flat(migrationSql), /owner_iduuidnotnulluniquereferencesauth\.users\(id\)/, "one auth user can own at most one company, so an owner's own verification cannot apply to a company they do not own");
  const usedTable = sql.slice(sql.indexOf("create table if not exists private.company_master_key_recovery_used"), sql.indexOf("revoke all on table private.company_master_key_recovery_used"));
  assert.match(usedTable, /company_id uuid not null references public\.companies\(id\) on delete cascade/);
  assert.match(usedTable, /owner_id uuid not null references auth\.users\(id\) on delete cascade/);
  const resetFn = sql.slice(sql.indexOf("function public.reset_master_key_after_recovery"));
  assert.match(resetFn, /insert into private\.company_master_key_recovery_used\(company_id, owner_id, otp_issued_at\)\s*values \(p_company_id, auth\.uid\(\), v_otp_ts::bigint\)/);
});

// ---- 9 & 10: the new key works, the old key stops working (hash is replaced, not added to) ----

test("the reset RPC replaces the stored Master Key hash using the exact same hashing as configure/change Master Key", () => {
  const resetFn = sql.slice(sql.indexOf("function public.reset_master_key_after_recovery"));
  assert.match(resetFn, /extensions\.crypt\(p_new_key, extensions\.gen_salt\('bf',12\)\)/);
  assert.match(resetFn, /on conflict \(company_id\) do update\s*set master_key_hash = excluded\.master_key_hash/);
  assert.match(companySecuritySql, /extensions\.crypt\(p_new_key,extensions\.gen_salt\('bf',12\)\)/, "configure/change Master Key use the same hashing function");
});

// ---- 11: the normal "know the current key" Change Master Key flow is untouched ----

test("the existing Change Master Key flow (knowing the current key) is completely unmodified", () => {
  assert.match(companySecurityJs, /if\(wasConfigured\)\{await changeMasterKey\(company\.companyId,values\.currentKey,values\.newKey\);masterForm\.reset\(\);message\("Master Key changed\. Department Reset Keys remain valid\."\);await refresh\(\)\}else\{await configureMasterKey\(company\.companyId,values\.newKey\);location\.replace\(destinationAfterAuth\(sessionStorage\)\)\}/);
  assert.match(companySecuritySql, /create or replace function public\.change_company_master_key/);
});

// ---- 12: Delete Company is untouched and still requires a valid Master Key ----

test("Delete Company still requires private.check_master_key and was not weakened by this feature", () => {
  assert.match(deletionSql, /if not private\.check_master_key\(p_company_id, p_master_key\) then/);
  assert.doesNotMatch(deletionSql, /recovery/i);
});

// ---- 13: Supabase Auth user accounts are never touched by any of this ----

test("no SQL in this feature ever reads, writes, or deletes auth.users, and the Master Key hash is never selected back out", () => {
  const resetFn = sql.slice(sql.indexOf("function public.reset_master_key_after_recovery"), sql.lastIndexOf("$$;"));
  assert.doesNotMatch(resetFn, /auth\.users/);
  assert.doesNotMatch(sql, /delete from auth\.users|update auth\.users/);
  assert.doesNotMatch(sql, /select[^;]*master_key_hash[^;]*;/is);
});

// ---- 14: no privileged secrets in frontend code; only the public Supabase client is used ----

test("no email/API secrets are hard-coded in the frontend, and only the standard publishable Supabase client sends the recovery email", () => {
  for (const source of [companySecurityJs, securityClient]) {
    assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE|smtp|SMTP|apiKey\s*[:=]\s*["'][A-Za-z0-9]/);
  }
  assert.match(companySecurityJs, /requireSupabase\(\)\.auth\.signInWithOtp/);
  assert.doesNotMatch(companySecurityJs, /fetch\(.*smtp|fetch\(.*sendgrid|fetch\(.*resend/i);
});

// ---- Security definer hardening, consistent with the rest of the Company Security system ----

test("both recovery functions are locked down with a controlled search_path and no public/anon execute", () => {
  assert.match(sql, /set search_path = pg_catalog, public, private/);
  assert.match(flatSql, /revokeallonfunctionpublic\.request_master_key_recovery\(uuid\),public\.reset_master_key_after_recovery\(uuid,text\)frompublic,anon;/);
  assert.match(flatSql, /grantexecuteonfunctionpublic\.request_master_key_recovery\(uuid\),public\.reset_master_key_after_recovery\(uuid,text\)toauthenticated;/);
});

// ---- Audit trail: recorded events, and no sensitive values ever logged ----

test("recovery request and successful reset are both audited, and no plaintext key/OTP is ever recorded", () => {
  assert.match(sql, /audit_security\(p_company_id,'master_key_recovery_requested'\)/);
  assert.match(sql, /audit_security\(p_company_id,'master_key_reset_via_recovery'\)/);
  assert.doesNotMatch(sql, /audit_security\([^)]*p_new_key/);
});

// ---- UI: added inside the existing Change Master Key section, page is not redesigned ----

test("Forgot Master Key is added inside the existing Company Master Key card, not a new page or a redesign", () => {
  assert.match(companyPage, /Forgot Master Key\?/);
  assert.match(companyPage, /For your security, we'll send a verification link to your registered email address/);
  assert.match(companyPage, /data-recovery-masked-email/);
  assert.doesNotMatch(companyPage, /Reset Entire Company — Unavailable.*Forgot Master Key/s, "must not be placed inside the untouched Danger Zone");
});

test("the masked email helper never displays the full address", () => {
  assert.match(companySecurityJs, /function maskEmail\(emailValue\)\{const\[local,domain\]=String\(emailValue\|\|""\)\.split\("@"\);return domain\?`\$\{local\[0\]\|\|""\}\*\*\*\*\*@\$\{domain\}`:emailValue\|\|""\}/);
});
