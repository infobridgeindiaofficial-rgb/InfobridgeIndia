import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../src/administration/app.js", import.meta.url), "utf8");
const core = fs.readFileSync(new URL("../src/administration/core.js", import.meta.url), "utf8");
const services = fs.readFileSync(new URL("../src/administration/services.js", import.meta.url), "utf8");
const repository = fs.readFileSync(new URL("../src/administration/repository.js", import.meta.url), "utf8");

test("Shared Masters is absent from Administration navigation and stale view falls back to Dashboard", () => {
  const nav = app.match(/const nav\s*=\s*\[([\s\S]*?)\];/)?.[1] || "";
  assert.doesNotMatch(nav, /Shared Masters/);
  assert.match(app, /view\s*===\s*"Shared Masters"[\s\S]*?\?\s*dashboard\(\)/);
});

test("master records APIs services and backup inclusion remain intact", () => {
  assert.match(core, /sharedMasters/);
  assert.match(core, /export function saveMaster/);
  assert.match(services, /masterService/);
  assert.match(repository, /"sharedMasters"/);
  assert.match(app, /function masters\(/);
});
