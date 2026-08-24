import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Supabase migration enables ownership RLS and denies anonymous table access", async () => {
  const sql = await read("supabase/migration.sql");
  assert.match(sql, /alter table public\.companies enable row level security/i);
  assert.match(sql, /alter table public\.workspace_records enable row level security/i);
  assert.match(sql, /auth\.uid\(\).*owner_id/is);
  assert.match(sql, /revoke all on public\.companies, public\.workspace_records from anon/i);
  assert.match(sql, /profile_complete boolean not null default true/i);
  assert.match(sql, /vat_registered boolean not null default false/i);
  assert.match(sql, /trade_license_number text/i);
  assert.match(sql, /tax_system text/i);
  assert.match(sql, /update public\.companies set country = 'IN'/i);
  assert.match(sql, /notify pgrst, 'reload schema'/i);
  assert.doesNotMatch(sql, /drop table public\.workspace_records/i);
});

test("every Company Setup upsert column exists in the companies migration", async () => {
  const sql = await read("supabase/migration.sql");
  const client = await read("src/supabase/client.js");
  const row = client.match(/const row = \{([\s\S]*?)\n  \};/)?.[1] || "";
  const writtenColumns = [...row.matchAll(/^\s{4}([a-z][a-z0-9_]*):/gm)].map((match) => match[1]);
  for (const column of writtenColumns) assert.match(sql, new RegExp(`\\b${column}\\b`, "i"), `companies migration must define ${column}`);
});

test("workspace persistence scopes every query to authenticated owner and company", async () => {
  const source = await read("src/supabase/workspace.js");
  assert.match(source, /\.eq\("owner_id", user\.id\)/);
  assert.match(source, /\.eq\("company_id", company\.id\)/);
  assert.match(source, /company\.owner_id !== user\.id/);
});

test("major business workspaces use Supabase-backed persistence", async () => {
  const paths = [
    "src/hr-payroll/app.js",
    "src/inventory/app.js",
    "src/gst/app.js",
    "src/scripts/projects.js",
    "src/scripts/documents.js",
    "src/sales/app.js",
    "src/purchases/app.js",
    "src/finance/app.js",
    "src/banking/app.js",
    "src/approvals/app.js",
    "src/administration/app.js",
  ];
  for (const path of paths) {
    assert.match(await read(path), /supabase\/workspace\.js/, `${path} must use the shared Supabase workspace store`);
  }
});
