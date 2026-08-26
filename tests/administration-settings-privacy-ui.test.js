import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/administration/app.js", import.meta.url), "utf8");
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end));

test("Settings and Privacy contains only normal workspace settings", () => {
  const settings = section("function settings()", "function page()");
  for (const expected of ["Language", "Date format", "Timezone", "Default branch", "Save settings"]) assert.match(settings, new RegExp(expected, "i"));
  assert.doesNotMatch(settings, /Data controls|Export all company data|Clear selected company data|data-clear-company|danger-zone/);
  assert.doesNotMatch(app, /data-clear-company/);
});

test("separate Backup and Restore functionality remains intact", () => {
  const backup = section("function backup()", "function auditTable");
  assert.match(backup, /Backup & Restore/);
  assert.match(backup, /Download company backup/);
  assert.match(backup, /Create backup/);
  assert.match(app, /function downloadBackup\(\)/);
  assert.match(app, /companyBackup\(state,\s*state\.currentCompanyId/);
});
