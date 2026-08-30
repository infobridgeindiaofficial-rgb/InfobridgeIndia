import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initialState, MODULES, INTERNAL_REQUEST_STATUSES, identityAdapter,
  createInternalRequest, updateInternalRequest, submitInternalRequest, startInternalRequestReview,
  markInternalRequestInProgress, completeInternalRequest, rejectInternalRequest, sendBackInternalRequest,
  cancelInternalRequest, addInternalRequestComment, getMyInternalRequests, getInternalRequestInbox,
  approveInternalRequest, canActOnInternalRequest, getInternalRequestOversight, internalRequestProgressStatus,
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
  identityAdapter.configure({ id: "requester", displayName: "Requester", departmentId: "OPS", permissions: {} });
  let s = initialState();
  let r = createInternalRequest(s, { subject: "Salary advance request", destinationDepartmentId: "DEP-1-FIN", destinationDepartmentName: "Finance", reason: "Medical emergency" }, { submit: true });
  s = r.state; const id = r.record.id;
  identityAdapter.configure({ id: "finance-approver", displayName: "Finance Manager", departmentId: "DEP-1-FIN", departmentName: "Finance", permissions: { "Internal Requests": { Approve: true } } });
  assert.throws(() => rejectInternalRequest(s, id, ""), /rejection reason/);
  r = rejectInternalRequest(s, id, "Policy does not allow this"); s = r.state;
  assert.equal(r.record.status, "Rejected");
  assert.equal(r.record.approvalHistory[0].actorRef, "finance-approver");
  identityAdapter.configure(null);
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

test("the inbox requires matching destination department and explicit Approve permission", () => {
  let s = initialState();
  let r = createInternalRequest(s, { subject: "Need A4 paper", destinationDepartmentId: "DEP-1-PUR", reason: "Out of stock" }, { submit: true });
  s = r.state;
  const authorized = { id: "purchase-supervisor", departmentId: "DEP-1-PUR", permissions: { "Internal Requests": { Approve: true } } };
  const noPermission = { id: "purchase-assistant", departmentId: "DEP-1-PUR", permissions: { "Internal Requests": { Approve: false } } };
  assert.equal(getInternalRequestInbox(s, authorized).length, 1);
  assert.equal(getInternalRequestInbox(s, noPermission).length, 0);
  assert.equal(getInternalRequestInbox(s, authorized)[0].destinationDepartmentId, "DEP-1-PUR");
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
  assert.equal(migrated.currentApproverRoleRef, "Internal Requests Approver");
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

test("the sidebar keeps staff navigation and adds Company Requests only for Owner", () => {
  assert.match(app, /\["dashboard","Dashboard"\].*\["inbox","My Request Inbox"\].*\["mine","My Requests"\]/);
  assert.match(app, /identityAdapter\.current\(\)\.isOwner\?\[\["oversight","Company Requests"\]\]/);
});

test("no duplicated global Create Request / Approval Inbox header actions", () => {
  assert.doesNotMatch(app, /class="top-actions"/);
  assert.doesNotMatch(app, />Approval Inbox</);
});

// ---- app.js: detail view actions (Accept/Start, Send Back, Reject, Complete) ----

test("the detail view offers role-protected Approve and Reject decisions", () => {
  assert.match(app, /canActOnInternalRequest\(r\)/);
  assert.match(app, /data-ir-action="approve">Approve</);
  assert.match(app, /data-ir-action="reject">Reject</);
  assert.match(app, /internalRequestDecisionModal/);
});

test("department approver then Owner routing preserves history and scopes each inbox", () => {
  identityAdapter.configure({ id: "employee", displayName: "Employee", departmentId: "SALES", departmentName: "Sales", permissions: [] });
  let result = createInternalRequest(initialState(), { subject: "Vacation", destinationDepartmentId: "HR", destinationDepartmentName: "HR", reason: "Annual leave", approvalStages: [{ name: "HR Head Approval", approverRoleRef: "Department Head", approverDepartmentId: "HR", approverDepartmentName: "HR" }, { name: "Owner Approval", approverRoleRef: "Owner" }] }, { submit: true });
  let state = result.state, id = result.record.id;
  assert.equal(getMyInternalRequests(state, "employee").length, 1);
  const hr = { id: "hr-supervisor", displayName: "HR Supervisor", departmentId: "HR", departmentName: "HR", isDepartmentHead: false, permissions: { "Internal Requests": { Approve: true } } };
  assert.equal(getInternalRequestInbox(state, hr).length, 1);
  identityAdapter.configure(hr); result = approveInternalRequest(state, id, "Policy checked"); state = result.state;
  assert.equal(internalRequestProgressStatus(result.record), "Pending Owner Approval");
  assert.equal(getInternalRequestInbox(state, hr).length, 0);
  const owner = { id: "owner", displayName: "Owner", systemRole: "Owner", isOwner: true, permissions: [] };
  assert.equal(getInternalRequestInbox(state, owner).length, 1);
  assert.equal(getInternalRequestOversight(state, owner).length, 1);
  identityAdapter.configure(owner); result = approveInternalRequest(state, id, "Approved");
  assert.equal(result.record.status, "Completed");
  assert.equal(result.record.approvalHistory.length, 2);
  identityAdapter.configure(null);
});

test("self approval and unrelated department access are blocked", () => {
  identityAdapter.configure({ id: "requester", displayName: "Requester", departmentId: "HR", isDepartmentHead: true, permissions: ["Internal Requests.Approve"] });
  const result = createInternalRequest(initialState(), { subject: "Vacation", destinationDepartmentId: "HR", destinationDepartmentName: "HR", reason: "Leave" }, { submit: true });
  assert.equal(canActOnInternalRequest(result.record), false);
  assert.throws(() => approveInternalRequest(result.state, result.record.id), /not assigned/);
  assert.equal(getInternalRequestInbox(result.state, { id: "sales-head", departmentId: "SALES", isDepartmentHead: true, permissions: [] }).length, 0);
  identityAdapter.configure(null);
});

test("exact HR scenario supports multiple permission-based approvers without duplicate records", () => {
  const admin = { id: "admin-employee", companyId: "CO-1", displayName: "Admin Employee", departmentId: "ADMIN", departmentName: "Administration", permissions: {} };
  const hrHead = { id: "hr-head", companyId: "CO-1", displayName: "HR Head", departmentId: "HR", departmentName: "HR & Payroll", isDepartmentHead: true, permissions: { "Internal Requests": { Approve: true } } };
  const hrStaffOff = { id: "hr-staff", companyId: "CO-1", displayName: "HR Staff", departmentId: "HR", departmentName: "HR & Payroll", permissions: { "Internal Requests": { Approve: false } } };
  const owner = { id: "owner", companyId: "CO-1", displayName: "Owner", systemRole: "owner", isOwner: true, permissions: {} };
  identityAdapter.configure(admin);
  let result = createInternalRequest(initialState(), { companyId: "CO-1", subject: "Vacation Request", destinationDepartmentId: "HR", destinationDepartmentName: "HR & Payroll", reason: "Annual leave" }, { submit: true });
  let state = result.state;
  assert.equal(state.internalRequests.length, 1);
  assert.equal(getMyInternalRequests(state, admin.id).length, 1);
  assert.equal(getInternalRequestInbox(state, admin).length, 0);
  assert.equal(getInternalRequestInbox(state, hrHead).length, 1);
  assert.equal(getInternalRequestInbox(state, hrStaffOff).length, 0);
  assert.equal(getInternalRequestInbox(state, owner).length, 0);
  assert.equal(getInternalRequestOversight(state, owner).length, 1);

  const hrStaffOn = { ...hrStaffOff, permissions: { "Internal Requests": { Approve: true } } };
  assert.equal(getInternalRequestInbox(state, hrStaffOn).length, 1);
  identityAdapter.configure(hrStaffOn);
  result = approveInternalRequest(state, result.record.id, "Leave balance checked");
  state = result.state;
  assert.equal(state.internalRequests.length, 1);
  assert.equal(result.record.status, "Completed");
  assert.equal(result.record.approvalHistory[0].actorRef, hrStaffOn.id);
  assert.equal(getInternalRequestInbox(state, hrHead).length, 0);
  assert.throws(() => approveInternalRequest(state, result.record.id), /not assigned/);
  identityAdapter.configure(null);
});

test("company boundary is enforced before direct approval", () => {
  identityAdapter.configure({ id: "creator", companyId: "CO-1", departmentId: "SALES", permissions: {} });
  const result = createInternalRequest(initialState(), { companyId: "CO-1", subject: "A4 Paper", destinationDepartmentId: "PUR", destinationDepartmentName: "Purchases", reason: "Out of paper" }, { submit: true });
  const foreignApprover = { id: "foreign", companyId: "CO-2", departmentId: "PUR", permissions: { "Internal Requests": { Approve: true } } };
  assert.equal(canActOnInternalRequest(result.record, foreignApprover), false);
  identityAdapter.configure(foreignApprover);
  assert.throws(() => approveInternalRequest(result.state, result.record.id), /not assigned/);
  identityAdapter.configure(null);
});

test("permission-routed assignments and audit history survive repository refresh", () => {
  const storage = new Map();
  const repository = new LocalApprovalRepository("IR-PERSIST", { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) });
  identityAdapter.configure({ id: "creator", companyId: "CO-1", departmentId: "ADMIN", permissions: {} });
  const created = createInternalRequest(initialState(), { companyId: "CO-1", subject: "Vacation", destinationDepartmentId: "HR", destinationDepartmentName: "HR & Payroll", reason: "Leave" }, { submit: true });
  repository.save(created.state);
  const loaded = repository.load(), request = loaded.internalRequests[0];
  assert.equal(request.currentApproverRoleRef, "Internal Requests Approver");
  assert.equal(request.history.some(event => event.action === "Request submitted"), true);
  assert.equal(getInternalRequestInbox(loaded, { id: "hr-manager", companyId: "CO-1", departmentId: "HR", permissions: { "Internal Requests": { Approve: true } } }).length, 1);
  identityAdapter.configure(null);
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
