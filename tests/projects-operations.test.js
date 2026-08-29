import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatCountryMoney } from "../src/country/registry.js";
import { projectSummary } from "../src/scripts/projects-core.js";

const source = readFileSync(new URL("../src/scripts/projects.js", import.meta.url), "utf8");

test("project creation keeps one top-right action and removes starter templates", () => {
  assert.equal((source.match(/\+ New Project/g) || []).length, 1);
  assert.doesNotMatch(source, /Optional starter template|Blank Project|Office \/ Branch Setup|Event Project/);
  assert.doesNotMatch(source, /templates\[v\.template\]/);
});

test("Projects reuses shared action, form and semantic status component classes", () => {
  assert.match(source, /tone==="primary"\?"btn-accent"/);
  assert.match(source, /tone==="danger"\?"btn-secondary danger-button"/);
  assert.match(source, /button\("\+ New Project","data-new-project","primary",""\)/);
  assert.match(source, /button\("Open",`data-open=.*,"primary"\)/);
  assert.match(source, /data-edit-project=.*button\("Export"/);
  assert.match(source, /data-archive=.*"ghost"/);
  assert.match(source, /class="badge badge-/);
  assert.match(source, /"In Progress"\?"brand":"neutral"/);
  assert.match(source, /class="input project-input"/);
  assert.match(source, /button\("Delete",`data-delete-task=.*,"danger"\)/);
  assert.doesNotMatch(source, /btn-primary/);
});

test("project form retains custom project type and required operational fields", () => {
  for (const field of ["Project Name", "Project Code", "Client / Customer", "Project Type", "Responsible Person", "Start Date", "Target Completion Date", "Budget", "Currency", "Status", "Description / Notes"]) {
    assert.match(source, new RegExp(field.replace("/", "\\/")));
  }
  assert.match(source, /field\("type","Project Type","text",p\.type\)/);
});

test("UAE project money formatting is valid and keeps two decimal places", () => {
  assert.equal(formatCountryMoney(15750, { country: "AE" }), "AED 15,750.00");
  assert.doesNotMatch(source, /formatCountryMoney\([^\n]+maximumFractionDigits:0/);
});

test("operational workspace exposes overview, team, timeline, costs and tasks", () => {
  for (const heading of ["Project Overview", "Team", "Timeline / Progress", "Project Cost Tracking", "+ Add Task"]) assert.match(source, new RegExp(heading.replace("+", "\\+")));
  assert.match(source, /\["Not Started","In Progress","Completed","On Hold"\]/);
});

test("project summary tracks completed, pending, on-hold and UAE costs", () => {
  const summary = projectSummary({ budget: 20000, dueDate: "2026-09-30", status: "In Progress" }, [
    { status: "Completed", progress: 100, actualCost: 5000 },
    { status: "On Hold", progress: 20, actualCost: 2500 },
  ], "2026-08-29");
  assert.equal(summary.completed, 1);
  assert.equal(summary.onHold, 1);
  assert.equal(summary.progress, 60);
  assert.equal(summary.actual, 7500);
  assert.equal(summary.remaining, 12500);
});
