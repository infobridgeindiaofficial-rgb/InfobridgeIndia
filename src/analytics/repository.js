export const KEY = "infobridgeindia.analytics.v1";
export function initialAnalytics() { return { version: 1, savedReports: [], presets: [], acknowledgedInsights: [], exportHistory: [], settings: { defaultRange: "This Month", financialYear: "auto", currency: "INR", numberFormat: "en-IN", comparison: "Previous Period", ageingBuckets: [30, 60, 90], salesChangeThreshold: 20, deadStockDays: 90, chartAnimation: false, dataQualityWarnings: true } }; }
export function repository(storage = globalThis.InfoBridgeWorkspaceStorage || globalThis.localStorage) {
  return {
    load() { try { const value = JSON.parse(storage.getItem(KEY)); return value?.version === 1 ? { ...initialAnalytics(), ...value, settings: { ...initialAnalytics().settings, ...value.settings } } : initialAnalytics(); } catch { return initialAnalytics(); } },
    save(value) { storage.setItem(KEY, JSON.stringify(value)); return value; },
    clearCache() { sessionStorage.removeItem("infobridgeindia.analytics.cache"); },
  };
}
