import { initialState, refreshTimeState } from "./engine.js";
export class LocalApprovalRepository {
  constructor(key = "InfoBridgeIndiaApprovalsV2", storage = globalThis.InfoBridgeWorkspaceStorage || globalThis.localStorage) { this.key = key; this.storage = storage; }
  load() { try { const data = JSON.parse(this.storage.getItem(this.key)); return refreshTimeState(data?.version === 2 ? data : initialState()); } catch { return initialState(); } }
  save(state) { if (state.version !== 2) throw Error("Unsupported approval workspace schema"); this.storage.setItem(this.key, JSON.stringify(state)); return state; }
  exportBackup(state) { return JSON.stringify(state, null, 2); }
  restore(text) { const data = JSON.parse(text); if (data?.version !== 2 || !Array.isArray(data.requests) || !Array.isArray(data.workflows) || !Array.isArray(data.audit)) throw Error("Invalid approvals backup"); return this.save(data); }
}
