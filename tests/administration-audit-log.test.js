import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { companyAuditRows, exportAuditCsv, formatAuditTimestamp, legacyAuditRecord } from "../src/administration/audit.js";
import { bootstrap, defaultState, saveDepartment, setModule } from "../src/administration/core.js";

const sql = readFileSync(new URL("../supabase/company-audit-log.sql", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/administration/app.js", import.meta.url), "utf8");

test("database audit captures stable authenticated actor snapshots", () => {
  assert.match(sql, /actor_id uuid not null references auth\.users/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /raw_user_meta_data->>'full_name'/);
  assert.match(sql, /'Company Owner'.*'Company Admin'/s);
  assert.doesNotMatch(sql, /password|access_token|refresh_token|session_token/i);
});

test("database access is company isolated and immutable to normal clients", () => {
  assert.match(sql, /where a\.company_id=p_company_id/);
  assert.match(sql, /private\.can_view_company_audit\(company_id\)/);
  assert.match(sql, /permissions->'Administration'->>'View Audit'/);
  assert.match(sql, /revoke all on table public\.company_audit_log from public,anon,authenticated/);
  assert.match(sql, /grant select on table public\.company_audit_log to authenticated/);
  assert.doesNotMatch(sql, /grant (insert|update|delete).*company_audit_log/i);
});

test("required successful Administration events are transactionally audited", () => {
  for (const action of ["Member invited", "Member invitation resent", "Member invitation cancelled", "Member accepted invitation", "Member permission changed", "Member role changed", "Module enabled", "Module disabled", "Financial year locked", "India GST settings changed", "UAE VAT settings changed"]) assert.match(sql, new RegExp(action));
  assert.match(sql, /'documentSequences','Document Numbering','Document numbering'/);
  assert.match(sql, /after update of data on public\.workspace_records/);
  assert.match(sql, /after insert or update on private\.company_member_invitations/);
  assert.match(sql, /after update of permissions,system_role on public\.company_members/);
});

test("failed local operations do not create misleading success history", () => {
  const state = bootstrap(defaultState()), before = state.audit.length;
  assert.throws(() => saveDepartment(state, { name: "", code: "" }));
  assert.equal(state.audit.length, before);
  assert.throws(() => setModule(state, "Administration", false));
  assert.equal(state.audit.length, before);
});

test("company filtering and CSV export cannot leak another company", () => {
  const rows = companyAuditRows([
    { id: 1, companyId: "A", timestamp: "2026-08-25T00:00:00Z", action: "Module enabled", entityType: "Module", entityName: "Finance", actorName: "Owner A" },
    { id: 2, companyId: "B", timestamp: "2026-08-25T00:00:00Z", action: "Module disabled", entityType: "Module", entityName: "Sales", actorName: "Owner B" },
  ], [], "A");
  assert.equal(rows.length, 1);
  const csv = exportAuditCsv(rows);
  assert.match(csv, /Owner A/);
  assert.doesNotMatch(csv, /Owner B|Sales/);
  assert.match(csv, /"Actor Email","Actor Role","Reason","Change Details"/);
});

test("legacy records stay readable and timestamps are human friendly", () => {
  const row = legacyAuditRecord({ id: "old", companyId: "A", timestamp: "2026-08-24T21:35:49.599Z", action: "Company edited", entity: "Company", actorName: "Current account" });
  assert.equal(row.actorName, "Current account");
  assert.equal(row.legacy, true);
  assert.doesNotMatch(formatAuditTimestamp(row.timestamp, "en-GB"), /T|\.599Z/);
  assert.match(app, /Not provided/);
  assert.match(app, /data-audit-search/);
  assert.match(app, /data-audit-from/);
  assert.match(app, /data-audit-action/);
  assert.match(app, /data-audit-actor/);
});
