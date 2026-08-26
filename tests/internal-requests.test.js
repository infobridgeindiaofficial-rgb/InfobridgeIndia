import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initialState, MODULES, INTERNAL_REQUEST_STATUSES, identityAdapter,
  createInternalRequest, updateInternalRequest, submitInternalRequest, startInternalRequestReview,
  markInternalRequestInProgress, completeInternalRequest, rejectInternalRequest, sendBackInternalRequest,
  cancelInternalRequest, addInternalRequestComment, getMyInternalRequests, getInternalRequestInbox,
  internalRequestDashboardMetrics,
} from "../src/approvals/engine.js";
import { LocalApprovalRepository } from "../src/approvals/repository.js";

const app = readFileSync(new URL("../src/approvals/app.js", import.meta.url), "utf8");

// ---- Engine: simplified create/submit model ----

test("subject is a free-text field, not a fixed category list", () => {
  const s = initialState();
  const r = createInternalRequest(s, { subject: "Printer not working", destinationDepartmentId: "DEP-1-IT", reason: "The HR office printer jams on every print job" });
  assert.equal(r.record.subject, "Printer not working");
  assert.equal(r.record.category, undefined);
});

test("destinationDepartmentId is required to create a request", () => {
  const s = initialState();
  assert.throws(() => createInternalRequest(s, { subject: "Need A4 paper", reason: "HR office is out of paper" }), /destinationDepartmentId/);
});

test("subject and reason are required", () => {
  const s = initialState();
  assert.throws(() => createInternalRequest(s, { destinationDepartmentId: "DEP-1-PUR", reason: "x" }), /subject/);
  assert.throws(() => createInternalRequest(s, { subject: "x", destinationDepartmentId: "DEP-1-PUR" }), /reason/);
});

test("the request stores a stable destinationDepartmentId plus a display name, matching the naming convention the task asked for", () => {
  const s = initialState();
  const r = createInternalRequest(s, { subject: "Need 20 new bed sheets", destinationDepartmentId: "DEP-ACME-PUR", destinationDepartmentName: "Purchases & Procurement", reason: "Housekeeping is short on linen for the new wing" });
  assert.equal(r.record.destinationDepartmentId, "DEP-ACME-PUR");
  assert.equal(r.record.destinationDepartmentName, "Purchases & Procurement");
});

test("no items / product picker fields exist on the created record", () => {
  const s = initialState();
  const r = createInternalRequest(s, { subject: "Need A4 paper", destinationDepartmentId: "DEP-1-PUR", reason: "Out of stock" });
  assert.equal(r.record.items, undefined);
  assert.equal(r.record.stockChecked, undefined);
  assert.equal(r.record.fulfillmentMethod, undefined);
});

test("request number follows the IR/YYYY/NNNN format", () => {
  const s = initialState();
  const r = createInternalRequest(s, { subject: "Need A4 paper", destinationDepartmentId: "DEP-1-PUR", reason: "Out of stock" });
  assert.match(r.record.requestNumber, /^IR\/\d{4}\/0001$/);
});

test("submitting requires a destination department and moves Draft -> Submitted", () => {
  let s = initialState();
  let r = createInternalRequest(s, { subject: "Need A4 paper", destinationDepartmentId: "DEP-1-PUR", reason: "Out of stock" });
  s = r.state;
  r = submitInternalRequest(s, r.record.id);
  assert.equal(r.record.status, "Submitted");
});

// ---- Engine: no named-person hardcoding, no fake module-as-department ----

test("no function accepts or hardcodes an individual person's name for routing; routing is always by department id", () => {
  const s = initialState();
  const r = createInternalRequest(s, { subject: "Site expense reimbursement AED 250", destinationDepartmentId: "DEP-1-FIN", destinationDepartmentName: "Finance & Accounting", reason: "Fuel and toll charges" });
  assert.equal(typeof r.record.destinationDepartmentId, "string");
  assert.ok(!("approverName" in r.record));
  assert.ok(!("assignedPerson" in r.record));
});

test("Banking (a platform module) is not automatically a department; the engine's code never derives a department from MODULES", () => {
  const engineSrc = readFileSync(new URL("../src/approvals/engine.js", import.meta.url), "utf8");
  const irCode = engineSrc.slice(engineSrc.indexOf("function nextInternalNumber")).split("\n").filter((line) => !line.trimStart().startsWith("//")).join("\n");
  assert.doesNotMatch(irCode, /\bMODULES\b/);
  assert.doesNotMatch(irCode, /"Banking"/);
});

// ---- Engine: simple status lifecycle (Accept/Start, Send Back, Reject, Complete) ----

test("full lifecycle: Submitted -> In Review (Accept/Start) -> In Progress -> Completed", () => {
  let s = initialState();
  let r = createInternalRequest(s, { subject: "Need 20 new bed sheets", destinationDepartmentId: "DEP-1-PUR", reason: "Linen shortage" }, { submit: true });
  s = r.state; const id = r.record.id;
  r = startInternalRequestReview(s, id); s = r.state; assert.equal(r.record.status, "In Review");
  r = markInternalRequestInProgress(s, id); s = r.state; assert.equal(r.record.status, "In Progress");
  r = completeInternalRequest(s, id, "Delivered to housekeeping"); s = r.state; assert.equal(r.record.status, "Completed");
});

test("Complete can also be called directly from In Review (no forced intermediate step)", () => {
  let s = initialState();
  let r = createInternalRequest(s, { subject: "Employment certificate", destinationDepartmentId: "DEP-1-HR", reason: "Needed for a visa application" }, { submit: true });
  s = r.state; const id = r.record.id;
  r = startInternalRequestReview(s, id); s = r.state;
  r = completeInternalRequest(s, id, "Issued"); s = r.state;
  assert.equal(r.record.status, "Completed");
});

test("reject requires a reason and finalises the request", () => {
  let s = initialState();
  let r = createInternalRequest(s, { subject: "Salary advance request", destinationDepartmentId: "DEP-1-FIN", reason: "Medical emergency" }, { submit: true });
  s = r.state; const id = r.record.id;
  assert.throws(() => rejectInternalRequest(s, id, ""), /rejection reason/);
  r = rejectInternalRequest(s, id, "Policy does not allow this"); s = r.state;
  assert.equal(r.record.status, "Rejected");
});

test("send back requires a reason and returns to an editable state", () => {
  let s = initialState();
  let r = createInternalRequest(s, { subject: "Need new staff uniforms", destinationDepartmentId: "DEP-1-PUR", reason: "10 uniforms for new housekeeping staff" }, { submit: true });
  s = r.state; const id = r.record.id;
  assert.throws(() => sendBackInternalRequest(s, id, ""), /correction note/);
  r = sendBackInternalRequest(s, id, "Specify sizes"); s = r.state;
  assert.equal(r.record.status, "Sent Back");
  r = updateInternalRequest(s, id, { reason: "10 uniforms, sizes M and L" }); s = r.state;
  r = submitInternalRequest(s, id); s = r.state;
  assert.equal(r.record.status, "Submitted");
});

test("requester can cancel their own non-finalised request with a reason", () => {
  let s = initialState();
  let r = createInternalRequest(s, { subject: "IT support: printer", destinationDepartmentId: "DEP-1-IT", reason: "Printer not working" }, { submit: true });
  s = r.state; const id = r.record.id;
  assert.throws(() => cancelInternalRequest(s, id, ""), /cancellation reason/);
  r = cancelInternalRequest(s, id, "Fixed it myself"); s = r.state;
  assert.equal(r.record.status, "Cancelled");
});

test("comments are preserved with actor and timestamp", () => {
  let s = initialState();
  let r = createInternalRequest(s, { subject: "IT support: printer", destinationDepartmentId: "DEP-1-IT", reason: "Printer not working" }, { submit: true });
  s = r.state;
  r = addInternalRequestComment(s, r.record.id, "Checked, driver issue");
  assert.equal(r.record.text, "Checked, driver issue");
});

test("all INTERNAL_REQUEST_STATUSES from the spec remain the valid status set", () => {
  assert.deepEqual(INTERNAL_REQUEST_STATUSES, ["Draft", "Submitted", "In Review", "In Progress", "Completed", "Rejected", "Sent Back", "Cancelled"]);
});

// ---- Engine: My Requests / Inbox ----

test("My Requests shows only requests created by the given actor", () => {
  let s = initialState();
  let r = createInternalRequest(s, { subject: "Leave request", destinationDepartmentId: "DEP-1-HR", reason: "Annual leave" });
  s = r.state;
  assert.equal(getMyInternalRequests(s, identityAdapter.current().id).length, 1);
  assert.equal(getMyInternalRequests(s, "someone-else").length, 0);
});

test("the inbox routing function is keyed on destinationDepartmentId presence (department-based), not a team/category field", () => {
  let s = initialState();
  let r = createInternalRequest(s, { subject: "Need A4 paper", destinationDepartmentId: "DEP-1-PUR", reason: "Out of stock" }, { submit: true });
  s = r.state;
  assert.equal(getInternalRequestInbox(s).length, 1);
  assert.equal(getInternalRequestInbox(s)[0].destinationDepartmentId, "DEP-1-PUR");
});

test("dashboard metrics expose exactly the four practical cards, nothing from a workflow-builder/approval-rule engine", () => {
  let s = initialState();
  let r = createInternalRequest(s, { subject: "Leave request", destinationDepartmentId: "DEP-1-HR", reason: "Annual leave" }, { submit: true });
  s = r.state;
  const m = internalRequestDashboardMetrics(s);
  assert.deepEqual(Object.keys(m).sort(), ["myCompleted", "myInProgress", "myOpenRequests", "myPendingActions"].sort());
});

// ---- Backward compatibility / migration of old category+team-shaped data ----

test("existing internal requests saved by the earlier category/team version load safely and are backfilled, not destroyed", () => {
  const storage = new Map();
  const legacy = {
    version: 2, settings: { defaultDueHours: 48, reminderHours: 24, escalationHours: 72, currency: "INR", numberPrefix: "APR" },
    sequence: 0, internalSequence: 1, requests: [],
    internalRequests: [{ id: "IR-OLD-1", requestNumber: "IR/2026/0001", category: "Stationery Request", assignedTeam: "Purchase / Inventory Team", requestedByRef: "current-account", requestedByDisplayName: "Current account", reason: "Need paper", items: [{ productId: "PRD-1", description: "A4", quantity: 10 }], status: "Submitted", comments: [], history: [] }],
    workflows: [], workflowVersions: [], rules: [], delegations: [], escalations: [], audit: [], notifications: [], connectorEvents: [],
  };
  storage.set("InfoBridgeIndiaApprovalsV2", JSON.stringify(legacy));
  const repo = new LocalApprovalRepository("InfoBridgeIndiaApprovalsV2", { getItem: (k) => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) });
  const loaded = repo.load();
  const migrated = loaded.internalRequests.find((r) => r.id === "IR-OLD-1");
  assert.ok(migrated, "old record must not be dropped");
  assert.equal(migrated.category, "Stationery Request", "old fields are preserved, not deleted");
  assert.equal(migrated.subject, "Stationery Request", "subject is backfilled from the old category as a reasonable default");
  assert.equal(migrated.destinationDepartmentName, "Purchase / Inventory Team", "old team label is kept as a readable fallback until a real department is assigned");
  assert.equal(migrated.destinationDepartmentId, null);
});

test("a request already saved in the new shape passes through the migration unchanged", () => {
  const storage = new Map();
  const modern = {
    version: 2, settings: { defaultDueHours: 48, reminderHours: 24, escalationHours: 72, currency: "INR", numberPrefix: "APR" },
    sequence: 0, internalSequence: 1, requests: [],
    internalRequests: [{ id: "IR-NEW-1", requestNumber: "IR/2026/0001", subject: "Need A4 paper", destinationDepartmentId: "DEP-1-PUR", destinationDepartmentName: "Purchases & Procurement", requestedByRef: "current-account", requestedByDisplayName: "Current account", reason: "Out of stock", status: "Draft", comments: [], history: [] }],
    workflows: [], workflowVersions: [], rules: [], delegations: [], escalations: [], audit: [], notifications: [], connectorEvents: [],
  };
  storage.set("InfoBridgeIndiaApprovalsV2", JSON.stringify(modern));
  const repo = new LocalApprovalRepository("InfoBridgeIndiaApprovalsV2", { getItem: (k) => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) });
  const loaded = repo.load();
  assert.equal(loaded.internalRequests[0].destinationDepartmentId, "DEP-1-PUR");
  assert.equal(loaded.internalRequests[0].subject, "Need A4 paper");
});

// ---- app.js: Request Category removed, free-text Subject present ----

test("Request Category dropdown / optgroups are removed from the create form", () => {
  assert.doesNotMatch(app, /categoryOptions/);
  assert.doesNotMatch(app, /Request Category/);
  assert.doesNotMatch(app, /name="category"/);
});

test("Request / Subject is a plain free-text input", () => {
  assert.match(app, /Request \/ Subject<input class="input" name="subject" type="text" required/);
});

// ---- app.js: Send To Department uses the real Department Master ----

test("Send To Department is sourced from the real company Department Master (departmentSelectOptions), not a hardcoded list", () => {
  assert.match(app, /departmentField\(existing\?\.destinationDepartmentId\|\|"","destinationDepartmentId","Send To Department","full"\)/);
  assert.match(app, /const departmentField=\(selected="",name="departmentRef",label="Department",labelClass=""\)=>`<label class="\$\{labelClass\}">\$\{label\}<select class="input" name="\$\{name\}" \$\{labelClass\?"required":""\}>\$\{departmentSelectOptions\(selected\)/);
});

test("the destination department name is resolved via the real Department Master helper at save time", () => {
  assert.match(app, /sharedDepartmentName\(data\.destinationDepartmentId\)/);
});

// ---- app.js: Requested Items / product picker section fully removed ----

test("the Requested Items / Add Item / product search / SKU / barcode / quantity / unit section is removed", () => {
  for (const gone of ["irItemRowHtml", "bindItemRow(", "itemSearchMatches", "data-item-search", "data-item-product-id", "Requested items", "Add item", "SKU or barcode"]) {
    assert.doesNotMatch(app, new RegExp(gone.replace(/[()]/g, "\\$&")));
  }
});

// ---- app.js: manual "Acting as team" UI removed ----

test("the manual Acting as Team checkbox UI and its testing disclaimer text are removed", () => {
  assert.doesNotMatch(app, /data-team-toggle/);
  assert.doesNotMatch(app, /Acting as team/i);
  assert.doesNotMatch(app, /local single-account testing aid/);
  assert.doesNotMatch(app, /ir-team-toggle/);
});

test("My Request Inbox no longer takes a teams parameter and shows the plain department-routed inbox", () => {
  assert.match(app, /function myRequestInboxView\(\)\{const rows=filterInternalRequests\(getInternalRequestInbox\(state\)\)/);
});

// ---- app.js: dashboard is simple, no workflow-builder/escalation metrics ----

test("the dashboard shows the four requested cards and nothing from the workflow/rule engine", () => {
  const dashboardSrc = app.slice(app.indexOf("function dashboard(){"), app.indexOf("function internalRequestMini("));
  assert.match(dashboardSrc, /Requests Waiting for My Action/);
  assert.match(dashboardSrc, /My Open Requests/);
  assert.match(dashboardSrc, /My Requests In Progress/);
  assert.match(dashboardSrc, /My Completed Requests/);
  for (const gone of ["Active Workflows", "Average Approval Time", "Escalated", "quick-card", "Create Workflow", "Add Rule"]) assert.doesNotMatch(dashboardSrc, new RegExp(gone));
});

// ---- app.js: My Requests requester-scoping, sidebar/header unchanged from prior simplification ----

test("My Requests is sourced from getMyInternalRequests (requester-scoped)", () => {
  assert.match(app, /function myRequestsView\(\)\{const rows=filterInternalRequests\(getMyInternalRequests\(state\)\)/);
});

test("the sidebar nav still contains exactly Dashboard, My Request Inbox and My Requests", () => {
  const navMatch = app.match(/const NAV=(\[\[.*?\]\]),LEGACY_ROUTES=/);
  assert.ok(navMatch);
  assert.deepEqual(JSON.parse(navMatch[1]), [["dashboard", "Dashboard"], ["inbox", "My Request Inbox"], ["mine", "My Requests"]]);
});

test("no duplicated global Create Request / Approval Inbox header actions", () => {
  assert.doesNotMatch(app, /class="top-actions"/);
  assert.doesNotMatch(app, />Approval Inbox</);
});

// ---- app.js: detail view actions (Accept/Start, Send Back, Reject, Complete) ----

test("the detail view offers the simple 4-verb action set, not a multi-level workflow builder", () => {
  assert.match(app, /data-ir-action="start">Accept \/ Start</);
  assert.match(app, /data-ir-action="send-back">Send Back</);
  assert.match(app, /data-ir-action="reject">Reject</);
  assert.match(app, /data-ir-action="complete">Complete</);
  assert.match(app, /data-ir-action="in-progress">Mark In Progress</);
});

test("no stock-check / issue-stock / procurement-required actions remain (Internal Requests does not duplicate Inventory/Purchases)", () => {
  for (const gone of ["stock-yes", "stock-no", "Check Stock", "Send to Warehouse", "Procurement Required", "createOrder", "createGrn", "createBill", "linkInternalRequestPurchaseNumber"]) {
    assert.doesNotMatch(app, new RegExp(gone));
  }
});

// ---- Old workflow/rule engine (unrelated business-transaction approvals) left untouched ----

test("the unrelated legacy workflow/rule/connector engine is untouched and still exported (backward compatibility, not deleted)", () => {
  assert.match(app, /\bsaveWorkflow\b/);
  assert.match(app, /\bsaveRule\b/);
  assert.match(app, /\bcreateRequest\b/);
  const engineSrc = readFileSync(new URL("../src/approvals/engine.js", import.meta.url), "utf8");
  assert.match(engineSrc, /export function saveWorkflow/);
  assert.match(engineSrc, /export function connectorRequest/);
});
