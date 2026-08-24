import { initialState } from "./core.js";
export const STORAGE_KEY = "infobridgeindia.banking.v1";
const copy = (value) => structuredClone(value);
function migrate(value) { const base = initialState(); if (!value || typeof value !== "object") return base; return { ...base, ...value, settings: { ...base.settings, ...value.settings, prefixes: { ...base.settings.prefixes, ...value.settings?.prefixes } }, integration: { ...base.integration, ...value.integration } }; }
export function createRepository(storage = globalThis.InfoBridgeWorkspaceStorage || globalThis.localStorage) {
  return {
    load() { try { return migrate(JSON.parse(storage.getItem(STORAGE_KEY) || "null")); } catch { return initialState(); } },
    save(state) { const safe = copy(state); for (const account of safe.accounts) for (const key of Object.keys(account)) if (/password|pin|otp|cvv/i.test(key)) delete account[key]; storage.setItem(STORAGE_KEY, JSON.stringify(safe)); return safe; },
    clear() { storage.removeItem(STORAGE_KEY); },
    export: (state) => JSON.stringify({ schema: STORAGE_KEY, version: 1, exportedAt: new Date().toISOString(), state }, null, 2),
    restore(text) { const value = JSON.parse(text); if (value.schema !== STORAGE_KEY || value.version !== 1 || !value.state?.settings || !Array.isArray(value.state.accounts)) throw Error("Invalid Banking workspace backup"); return migrate(value.state); },
  };
}
