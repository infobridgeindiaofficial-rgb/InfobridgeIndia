import { bootstrap, defaultState, now } from "./core.js";
import { ensureDefaultDepartments } from "./departments.js";
import { administrationCompanyName, publishAdministrationCompany } from "./company.js";
export const KEY = "infobridgeindia.administration.v2";
export const MODULE_KEYS = ["infobridgeindia.sales.v1", "infobridgeindia.purchases.v1", "infobridgeindia.banking.v1", "InfoBridgeIndiaApprovalsV2", "infobridgeindia.analytics.v1"];

export function repository(storage = globalThis.InfoBridgeWorkspaceStorage || globalThis.localStorage) {
  return {
    load() { try { return ensureDefaultDepartments(bootstrap(JSON.parse(storage.getItem(KEY)) || defaultState())); } catch { return ensureDefaultDepartments(bootstrap(defaultState())); } },
    save(state) { if (state.version !== 2) throw Error("Unsupported Administration schema"); ensureDefaultDepartments(state); storage.setItem(KEY, JSON.stringify(state)); publishAdministrationCompany(state, state.currentCompanyId); return state; },
    snapshot() { const values = {}; for (const key of MODULE_KEYS) if (storage.getItem(key) !== null) values[key] = storage.getItem(key); return { createdAt: now(), values }; },
    restoreSnapshot(snapshot) { for (const [key, value] of Object.entries(snapshot.values || {})) storage.setItem(key, value); },
    exportAdministration: (state) => JSON.stringify({ schema: KEY, version: 2, exportedAt: now(), administration: state }, null, 2),
    restoreAdministration(text) { const value = JSON.parse(text); if (value.schema !== KEY || value.version !== 2 || !Array.isArray(value.administration?.companies)) throw Error("Invalid Administration backup"); return ensureDefaultDepartments(bootstrap(value.administration)); },
  };
}

export function companyBackup(state, companyId, moduleData = {}) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) throw Error("Company not found");
  const pick = (items) => (items || []).filter((item) => item.companyId === companyId);
  const names = ["companies", "branches", "departments", "companyMembers", "roles", "moduleAccess", "financialYears", "documentSequences", "gstSettings", "sharedMasters", "notificationSettings", "audit"];
  const administration = { ...Object.fromEntries(names.map((name) => [name, name === "companies" ? [company] : pick(state[name])])), settings: state.settings };
  const modules = { ...moduleData }, counts = {};
  for (const [key, value] of Object.entries(administration)) if (Array.isArray(value)) counts[`administration.${key}`] = value.length;
  for (const [key, value] of Object.entries(modules)) counts[`module.${key}`] = Object.values(value || {}).filter(Array.isArray).reduce((total, rows) => total + rows.length, 0);
  const payload = { schema: "infobridgeindia.company-backup", version: 1, appVersion: "2.0", exportedAt: now(), companyId, companyName: administrationCompanyName(company), counts, administration, modules };
  payload.checksum = simpleChecksum(JSON.stringify(payload));
  return payload;
}

export function simpleChecksum(value) { let hash = 2166136261; for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619); return (hash >>> 0).toString(16).padStart(8, "0"); }
export function validateBackup(value) { if (value?.schema !== "infobridgeindia.company-backup" || value.version !== 1 || !value.companyId || !value.administration?.companies?.length) throw Error("Invalid company backup schema"); const checksum = value.checksum, copy = structuredClone(value); delete copy.checksum; if (simpleChecksum(JSON.stringify(copy)) !== checksum) throw Error("Backup checksum validation failed"); return { companyName: value.companyName, exportedAt: value.exportedAt, counts: value.counts }; }
