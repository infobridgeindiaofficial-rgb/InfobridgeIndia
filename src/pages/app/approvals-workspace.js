import { renderHead } from "../../components/layout.js";

export function approvalsWorkspacePage() {
  return `<!DOCTYPE html><html lang="en"><head>${renderHead({ title: "Internal Requests", description: "Employee material, IT, and service requests routed to the responsible team." })}<link rel="stylesheet" href="/approvals-workspace/styles.css"></head><body><div id="approvals-app"><div class="app-loading"><div class="boot-card"><div class="spinner"></div><p>Opening Internal Requests…</p></div></div></div><div id="approvals-modal"></div><div id="approvals-toast" class="toast-region" aria-live="polite"></div><script type="module" src="/approvals-workspace/app.js"></script></body></html>`;
}
