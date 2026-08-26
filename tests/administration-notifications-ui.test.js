import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/administration/app.js");
const core = read("src/administration/core.js");
const services = read("src/administration/services.js");
const repository = read("src/administration/repository.js");
const company = read("src/administration/company.js");

test("Administration hides Notifications and redirects its stale view to Dashboard", () => {
  const nav = app.match(/const nav\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  assert.doesNotMatch(nav, /Notifications/);
  assert.match(app, /view\s*===\s*"Notifications"\s*\?\s*dashboard\(\)/);
});

test("notification infrastructure, persistence, and reusable UI remain intact", () => {
  assert.match(core, /notificationSettings/);
  assert.match(core, /Low stock alert/);
  assert.match(core, /Approval overdue/);
  assert.match(services, /notificationService/);
  assert.match(repository, /"notificationSettings"/);
  assert.match(company, /"notificationSettings"/);
  assert.match(app, /function notifications\(\)/);
  assert.match(app, /data-notify/);
});
