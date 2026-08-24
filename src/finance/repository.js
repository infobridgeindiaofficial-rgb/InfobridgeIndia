import { initialState } from "./core.js";
export const KEY = "infobridgeindia.finance.v1";
export function repository(storage = globalThis.InfoBridgeWorkspaceStorage || globalThis.localStorage) {
  return {
    load() { try { const x = JSON.parse(storage.getItem(KEY)); return x?.version === 1 ? { ...initialState(), ...x, settings: { ...initialState().settings, ...x.settings, defaultAccounts: { ...initialState().settings.defaultAccounts, ...x.settings?.defaultAccounts } } } : initialState(); } catch { return initialState(); } },
    save(state) { if (state.version !== 1) throw Error("Unsupported Finance schema"); storage.setItem(KEY, JSON.stringify(state)); return state; },
    backup: (state) => JSON.stringify({ schema: KEY, version: 1, exportedAt: new Date().toISOString(), state }, null, 2),
    restore(text) { const value = JSON.parse(text); if (value.schema !== KEY || value.version !== 1 || !Array.isArray(value.state?.journals)) throw Error("Invalid Finance backup"); return value.state; },
  };
}
