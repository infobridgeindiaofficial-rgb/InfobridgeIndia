import { initialState, refreshTimeState } from "./engine.js";
// Safely upgrades internal requests saved by an earlier version of this module (which used a
// Request Category + fake "responsible team" instead of a real destination department) so old
// records stay readable. Nothing is deleted; missing fields are backfilled non-destructively.
function migrateInternalRequest(r) {
  const upgraded = { ...r, subject: r.subject || r.category || (r.reason ? r.reason.slice(0, 60) : "Internal request"), destinationDepartmentId: r.destinationDepartmentId || null, destinationDepartmentName: r.destinationDepartmentName || r.assignedTeam || "Unassigned", requesterDepartmentId: r.requesterDepartmentId || null, requesterDepartmentName: r.requesterDepartmentName || "", approvalHistory: Array.isArray(r.approvalHistory) ? r.approvalHistory : [] };
  if (["Submitted", "In Review", "In Progress"].includes(upgraded.status) && !upgraded.currentApproverRoleRef) {
    upgraded.approvalStages = [{ order: 1, name: `${upgraded.destinationDepartmentName || "Department"} Approval`, approverRoleRef: "Internal Requests Approver", approverDepartmentId: upgraded.destinationDepartmentId, approverDepartmentName: upgraded.destinationDepartmentName, status: "Pending" }];
    upgraded.currentApprovalStage = 0;
    upgraded.currentApproverRoleRef = "Internal Requests Approver";
    upgraded.currentApproverDepartmentId = upgraded.destinationDepartmentId;
    upgraded.currentApproverDepartmentName = upgraded.destinationDepartmentName;
    upgraded.currentApproverUserRef = null;
  }
  // Earlier builds routed this stage implicitly to a Department Head. Preserve the
  // request/history while upgrading only the still-pending assignment semantics.
  if (["Submitted", "In Review", "In Progress"].includes(upgraded.status) && upgraded.currentApproverRoleRef === "Department Head") {
    upgraded.currentApproverRoleRef = "Internal Requests Approver";
    const stage = upgraded.approvalStages?.[upgraded.currentApprovalStage ?? 0];
    if (stage?.approverRoleRef === "Department Head" && stage.status === "Pending") stage.approverRoleRef = "Internal Requests Approver";
  }
  return upgraded;
}
function withInternalRequestDefaults(data) {
  return { ...data, internalRequests: (Array.isArray(data.internalRequests) ? data.internalRequests : []).map(migrateInternalRequest), internalSequence: data.internalSequence || 0 };
}
export class LocalApprovalRepository {
  constructor(key = "InfoBridgeIndiaApprovalsV2", storage = globalThis.InfoBridgeWorkspaceStorage || globalThis.localStorage) { this.key = key; this.storage = storage; }
  load() { try { const data = JSON.parse(this.storage.getItem(this.key)); return refreshTimeState(data?.version === 2 ? withInternalRequestDefaults(data) : initialState()); } catch { return initialState(); } }
  save(state) { if (state.version !== 2) throw Error("Unsupported approval workspace schema"); this.storage.setItem(this.key, JSON.stringify(state)); return state; }
  exportBackup(state) { return JSON.stringify(state, null, 2); }
  restore(text) { const data = JSON.parse(text); if (data?.version !== 2 || !Array.isArray(data.requests) || !Array.isArray(data.workflows) || !Array.isArray(data.audit)) throw Error("Invalid approvals backup"); return this.save(data); }
}
