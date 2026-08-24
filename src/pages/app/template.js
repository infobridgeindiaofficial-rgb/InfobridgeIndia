import { appPage, breadcrumbs } from "../../components/layout.js";
import { statTile, banner, emptyState, timeline, table as dataTable } from "../../components/ui.js";
import { icon } from "../../components/icons.js";

// Generic authenticated "module landing" page — satisfies the page-design
// rule (what it is / status / actions / workflow / attention / activity /
// reports) without duplicating markup for every module.
export function moduleLandingPage({
  route,
  title,
  crumb,
  description,
  primaryAction,
  secondaryAction,
  attention,
  stats = [],
  table = null,
  emptyStateConfig = null,
  activity = [],
  reportLinks = [],
}) {
  const header = `
    <div class="app-content-header">
      <div>
        ${breadcrumbs(crumb)}
        <h1 style="margin-top:10px;">${title}</h1>
        <p class="text-small" style="margin-top:6px; max-width:640px;">${description}</p>
      </div>
      <div class="app-content-actions">
        ${secondaryAction ? `<a class="btn btn-secondary" href="${secondaryAction.href}">${secondaryAction.label}</a>` : ""}
        ${primaryAction ? `<a class="btn btn-primary" href="${primaryAction.href}">${icon("plus", "").replace("<svg", '<svg width="15" height="15"')} ${primaryAction.label}</a>` : ""}
      </div>
    </div>
  `;

  const body = `
    ${attention ? `<div style="margin-bottom:24px;">${banner(attention)}</div>` : ""}
    ${
      stats.length
        ? `<div class="grid g-4" style="margin-bottom:28px;">${stats.map(statTile).join("")}</div>`
        : ""
    }
    <div class="grid g-12" style="align-items:flex-start;">
      <div style="grid-column: span 8;">
        ${table ? dataTable(table) : emptyStateConfig ? emptyState(emptyStateConfig) : ""}
      </div>
      <div style="grid-column: span 4;" class="stack-6">
        <div class="card">
          <h4 class="h-6" style="margin-bottom:14px;">Recent activity</h4>
          ${activity.length ? timeline(activity) : `<p class="text-small">No activity yet in this module.</p>`}
        </div>
        ${
          reportLinks.length
            ? `<div class="card">
              <h4 class="h-6" style="margin-bottom:10px;">Relevant reports</h4>
              ${reportLinks.map((r) => `<a href="${r.href}" class="row-between" style="padding:9px 0; border-bottom:1px solid var(--border); font-size:14px; color:var(--ink-700); font-weight:560;">${r.label}${icon("chevronRight", "").replace("<svg", '<svg width="15" height="15" style="color:var(--ink-300)"')}</a>`).join("")}
            </div>`
            : ""
        }
      </div>
    </div>
  `;

  return {
    route,
    title,
    description,
    currentHref: route,
    header,
    body,
  };
}

export function renderModulePage(config) {
  const page = moduleLandingPage(config);
  return appPage(page);
}
