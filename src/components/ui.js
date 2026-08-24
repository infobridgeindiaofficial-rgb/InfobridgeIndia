import { icon } from "./icons.js";

export function sectionHead({ eyebrow, title, desc, center = false }) {
  return `<div class="section-head${center ? " center" : ""}">
    ${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ""}
    <h2 class="h-2">${title}</h2>
    ${desc ? `<p class="text-lead">${desc}</p>` : ""}
  </div>`;
}

export function statTile({ label, value, delta, deltaDir }) {
  const deltaHtml = delta
    ? `<span class="stat-delta ${deltaDir === "down" ? "down" : "up"}">${icon(deltaDir === "down" ? "trendingDown" : "trendingUp", "").replace("<svg", '<svg width="13" height="13"')} ${delta}</span>`
    : "";
  return `<div class="stat-tile">
    <div class="text-micro">${label}</div>
    <span class="figure">${value}</span>
    ${deltaHtml}
  </div>`;
}

export function featureCard({ icon: ic, title, desc, href }) {
  return `<div class="card card-hover feature-card">
    <div class="card-icon">${icon(ic)}</div>
    <h4>${title}</h4>
    <p>${desc}</p>
    ${href ? `<a class="feature-link" href="${href}">Learn more ${icon("arrowRight", "").replace("<svg", '<svg width="14" height="14"')}</a>` : ""}
  </div>`;
}

export function subserviceCard({ icon: ic, title, desc, href, status }) {
  return `<a class="subservice-card" href="${href}">
    <div class="subservice-top">
      <span class="card-icon" style="margin-bottom:0; width:36px; height:36px;">${icon(ic).replace("<svg", '<svg width="18" height="18"')}</span>
      ${status ? `<span class="badge badge-${status.tone}">${status.label}</span>` : ""}
    </div>
    <h4 style="margin-top:14px;">${title}</h4>
    <p>${desc}</p>
    <div class="subservice-arrow" style="margin-top:12px;">${icon("arrowRight")}</div>
  </a>`;
}

export function flow(steps) {
  return `<div class="flow">
    ${steps
      .map(
        (s, i) => `${i > 0 ? `<div class="flow-arrow">${icon("chevronRight")}</div>` : ""}
        <div class="flow-step">
          <div class="flow-num">${String(i + 1).padStart(2, "0")}</div>
          <h5>${s.title}</h5>
          <p>${s.desc}</p>
        </div>`
      )
      .join("")}
  </div>`;
}

export function chipGrid(items) {
  return `<div class="chip-grid">${items.map((c) => `<a class="chip" href="${c.href || "#"}">${c.icon ? icon(c.icon).replace("<svg", '<svg width="15" height="15"') : ""}${c.label}</a>`).join("")}</div>`;
}

export function ctaBand({ title, desc, primary, secondary }) {
  return `<div class="cta-band">
    <div>
      <h2 class="h-3">${title}</h2>
      <p>${desc}</p>
    </div>
    <div class="row-gap-3">
      ${secondary ? `<a href="${secondary.href}" class="btn btn-on-dark btn-lg">${secondary.label}</a>` : ""}
      ${primary ? `<a href="${primary.href}" class="btn btn-accent btn-lg">${primary.label}</a>` : ""}
    </div>
  </div>`;
}

export function stepTrack(steps, currentIndex) {
  return `<div class="step-track">
    ${steps
      .map((s, i) => {
        const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "";
        return `${i > 0 ? '<div class="step-line"></div>' : ""}<div class="step ${state}">
          <div class="step-dot">${i < currentIndex ? icon("check", "").replace("<svg", '<svg width="13" height="13"') : i + 1}</div>
          <div class="step-label">${s}</div>
        </div>`;
      })
      .join("")}
  </div>`;
}

export function tabs(tabList, activePanelHtmlList) {
  const heads = tabList
    .map((t, i) => `<div class="tab${i === 0 ? " active" : ""}" data-tab="${t.id}">${t.label}</div>`)
    .join("");
  const panels = tabList
    .map((t, i) => `<div class="tab-panel${i === 0 ? " active" : ""}" data-tab-panel="${t.id}">${activePanelHtmlList[i]}</div>`)
    .join("");
  return `<div data-tabs>
    <div class="tabs">${heads}</div>
    ${panels}
  </div>`;
}

export function emptyState({ icon: ic = "folder", title, desc, action }) {
  return `<div class="state-block">
    <div class="state-icon">${icon(ic, "").replace("<svg", '<svg width="24" height="24"')}</div>
    <h4>${title}</h4>
    <p>${desc}</p>
    ${action ? `<a href="${action.href}" class="btn btn-primary btn-sm">${action.label}</a>` : ""}
  </div>`;
}

export function banner({ tone = "info", title, body }) {
  const ic = tone === "danger" ? "alertCircle" : tone === "warning" ? "alertTriangle" : tone === "success" ? "checkCircle" : "info";
  return `<div class="banner banner-${tone}">
    ${icon(ic)}
    <div><strong>${title}</strong>${body}</div>
  </div>`;
}

export function kvList(rows) {
  return `<div class="kv-list">${rows.map((r) => `<div class="kv-row"><span class="k">${r.k}</span><span class="v">${r.v}</span></div>`).join("")}</div>`;
}

export function timeline(items) {
  return `<div>${items
    .map(
      (it) => `<div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-body">
        <div class="t-title">${it.title}</div>
        <div class="t-meta">${it.meta}</div>
      </div>
    </div>`
    )
    .join("")}</div>`;
}

export function table({ columns, rows, toolbar = true, pagination = true }) {
  const head = columns.map((c) => `<th class="${c.num ? "num" : ""}">${c.label}</th>`).join("");
  const body = rows
    .map(
      (r) => `<tr>${columns
        .map((c) => {
          const val = r[c.key];
          if (c.render) return `<td class="${c.num ? "num" : ""}">${c.render(r)}</td>`;
          return `<td class="${c.num ? "num" : ""}">${val ?? ""}</td>`;
        })
        .join("")}</tr>`
    )
    .join("");

  return `<div class="table-wrap">
    ${
      toolbar
        ? `<div class="table-toolbar">
        <div class="table-toolbar-left">
          <div class="search-input">${icon("search")}<input placeholder="Search…" /></div>
          <button class="btn btn-secondary btn-sm">${icon("filter", "").replace("<svg", '<svg width="14" height="14"')} Filters</button>
        </div>
        <div class="row-gap-2">
          <button class="btn btn-secondary btn-sm">${icon("download", "").replace("<svg", '<svg width="14" height="14"')} Export</button>
        </div>
      </div>`
        : ""
    }
    <table class="data-table">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    ${
      pagination
        ? `<div class="table-pagination">
        <span>Showing ${rows.length} of ${rows.length} records</span>
        <div class="pager"><button class="active">1</button></div>
      </div>`
        : ""
    }
  </div>`;
}

export function statusBadge(label, tone) {
  return `<span class="badge badge-${tone}">${label}</span>`;
}
