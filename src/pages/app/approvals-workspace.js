import { renderHead } from "../../components/layout.js";

export function approvalsWorkspacePage() {
  return `<!DOCTYPE html><html lang="en"><head>${renderHead({ title: "Approvals & Workflows", description: "Local-first approval engine and workflow workspace." })}<link rel="stylesheet" href="/approvals-workspace/styles.css"></head><body><div id="approvals-app"><div class="app-loading"><div class="boot-card"><div class="spinner"></div><p>Opening Approvals & Workflows…</p></div></div></div><div id="approvals-modal"></div><div id="approvals-toast" class="toast-region" aria-live="polite"></div><script type="module" src="/approvals-workspace/app.js"></script></body></html>`;
}
