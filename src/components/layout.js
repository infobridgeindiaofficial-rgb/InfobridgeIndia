import { icon } from "./icons.js";
import { BRAND, mainNav, footerColumns, appNav } from "../data/nav.js";
import { renderSeoTags, seoForRoute } from "../data/seo.js";

const YEAR = 2026;
const GA4_MEASUREMENT_ID = "G-WDV9HEL5DX";
const ANALYTICS_EXCLUDED_ROUTES = new Set([
  "/company-setup.html",
  "/company-profile.html",
  "/company-security.html",
]);
const NOINDEX_ROUTES = new Set(["/company-setup.html", "/company-profile.html", "/company-security.html"]);

function renderGoogleAnalyticsTag(route) {
  if (!route || ANALYTICS_EXCLUDED_ROUTES.has(route)) return "";
  return `
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA4_MEASUREMENT_ID}');
  </script>`;
}

function renderBrandIconTags(route) {
  if (!route || ANALYTICS_EXCLUDED_ROUTES.has(route)) {
    return '<link rel="icon" type="image/png" href="/infobridgeindia-logo.png" />';
  }
  return `<link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" sizes="16x16" href="/logo/favicon-16x16.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/logo/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="48x48" href="/logo/favicon-48x48.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/logo/apple-touch-icon.png" />`;
}

export function renderHead({ title, description, exactTitle = false, route = "" }) {
  const seo = seoForRoute(route);
  const effectiveTitle = seo?.title || title;
  const effectiveDescription = seo?.description ?? description;
  const descriptionMeta = effectiveDescription === null
    ? ""
    : `\n  <meta name="description" content="${effectiveDescription || BRAND.tagline}" />`;
  const robotsMeta = NOINDEX_ROUTES.has(route) ? '\n  <meta name="robots" content="noindex, nofollow" />' : "";
  return `<meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${seo || exactTitle ? effectiveTitle : effectiveTitle ? `${effectiveTitle} — ${BRAND.name}` : BRAND.name}</title>${descriptionMeta}${robotsMeta}${renderSeoTags(seo)}${renderGoogleAnalyticsTag(route)}
  <link rel="stylesheet" href="/styles/tokens.css" />
  <link rel="stylesheet" href="/styles/base.css" />
  <link rel="stylesheet" href="/styles/components.css" />
  ${renderBrandIconTags(route)}
  <script src="/vendor/supabase.js"></script>
  <script src="/supabase-config.js"></script>
  <script type="module" src="/scripts/auth-gate.js"></script>`;
}

function megaColumn(col) {
  return `<div>
    <div class="mega-col-title">${col.title}</div>
    <div class="stack-1">
      ${col.items
        .map(
          (it) => `<a class="mega-link" href="${it.href}">
        <span class="mega-link-icon">${icon(it.icon)}</span>
        <span>
          <span class="mega-link-title">${it.title}</span>
          <div class="mega-link-desc">${it.desc}</div>
        </span>
      </a>`
        )
        .join("")}
    </div>
  </div>`;
}

function renderMega(item) {
  if (!item.mega) return "";
  const cols = item.mega.columns.map(megaColumn).join("");
  const promo = item.mega.promo
    ? `<div class="mega-promo">
        <div>
          <div class="eyebrow">${item.mega.promo.eyebrow}</div>
          <h4>${item.mega.promo.title}</h4>
          <p>${item.mega.promo.body}</p>
        </div>
        <a href="${item.mega.promo.href}" class="btn btn-on-dark btn-sm" style="margin-top:16px; align-self:flex-start;">${item.mega.promo.cta} ${icon("arrowRight", "").replace("<svg", '<svg width="14" height="14"')}</a>
      </div>`
    : "";
  return `<div class="mega">
    <div class="mega-grid" style="grid-template-columns: repeat(${item.mega.columns.length}, 1fr) ${item.mega.promo ? "220px" : ""};">
      ${cols}
      ${promo}
    </div>
  </div>`;
}

export function renderHeader(active = "") {
  const items = mainNav
    .map((item) => {
      const isActive = item.key === active;
      const caret = item.mega ? `<span class="nav-caret">${icon("chevronDown")}</span>` : "";
      return `<div class="nav-item${item.mega ? " has-mega" : ""}" data-nav-item>
        <a class="nav-link" href="${item.href}">${item.label}${caret}</a>
        ${renderMega(item)}
      </div>`;
    })
    .join("");

  const mobileGroups = mainNav
    .map((item) => {
      const sub = item.mega
        ? item.mega.columns.flatMap((c) => c.items).map((it) => `<a href="${it.href}">${it.title}</a>`).join("")
        : "";
      return `<div class="mobile-group">
        <a class="mobile-group-title" href="${item.href}" style="display:block;">${item.label}</a>
        ${sub}
      </div>`;
    })
    .join("");

  return `<header class="site-header">
    <div class="container">
      <a href="/index.html" class="brand">
        <img class="brand-logo" src="/infobridgeindia-logo.png" alt="InfoBridgeIndia" />
      </a>
      <nav class="main-nav" aria-label="Main">
        ${items}
      </nav>
      <div class="header-actions">
        <span data-auth-logged-out><a href="/login.html" class="btn btn-accent btn-sm">Log in</a></span>
        <div class="profile-menu" data-auth-logged-in hidden>
          <button class="profile-control" type="button" data-profile-toggle aria-label="Open account menu" aria-haspopup="menu" aria-expanded="false"><span class="profile-initials" data-session-initials>IB</span><span class="profile-label" data-auth-display-name>Account</span>${icon("chevronDown")}</button>
          <div class="profile-dropdown" data-profile-dropdown role="menu" hidden>
            <div class="profile-dropdown-identity"><strong data-auth-display-name>Account</strong><span data-auth-email></span><span data-auth-company-detail hidden></span></div>
            <a href="/company-profile.html" role="menuitem">Company Profile</a>
            <button type="button" data-auth-logout role="menuitem">Log out</button>
          </div>
        </div>
        <button class="mobile-nav-toggle" data-mobile-toggle aria-label="Menu">${icon("menu")}</button>
      </div>
    </div>
    <div class="mobile-nav" data-mobile-nav>
      <div class="container">
        ${mobileGroups}
        <div class="mobile-group" style="border-bottom:none;" data-auth-logged-out>
          <a href="/login.html" style="color:#fff; font-weight:600;">Log in</a>
        </div>
        <div class="mobile-group" style="border-bottom:none;" data-auth-logged-in hidden>
          <span data-auth-display-name></span><span data-auth-email></span><span data-auth-company-detail hidden></span><a href="/company-profile.html">Company Profile</a><button class="mobile-auth-logout" type="button" data-auth-logout>Log out</button>
        </div>
      </div>
    </div>
  </header>`;
}

export function renderFooter() {
  const cols = footerColumns
    .map(
      (col) => `<div class="footer-col">
      <div class="footer-col-title">${col.title}</div>
      ${col.links.map((l) => `<a href="${l.href}">${l.title}</a>`).join("")}
    </div>`
    )
    .join("");

  return `<footer class="site-footer">
    <div class="container">
      <div class="footer-top">
        <div class="footer-brand">
          <a href="/index.html" class="brand">
            <img class="brand-logo brand-logo-footer" src="/infobridgeindia-logo.png" alt="InfoBridgeIndia" />
          </a>
          <p>Business platforms, mobile apps, desktop software and websites — built to make everyday work simpler.</p>
        </div>
        ${cols}
      </div>
      <div class="footer-bottom">
        <span>© ${YEAR} InfoBridgeIndia Business Systems. All rights reserved.</span>
        <span class="row-gap-4" style="gap:8px;">
          <a href="/privacy.html">Privacy</a>
          <span aria-hidden="true">&middot;</span>
          <a href="/terms.html">Terms</a>
          <span aria-hidden="true">&middot;</span>
          <a href="/security.html">Security</a>
        </span>
      </div>
    </div>
  </footer>`;
}

export function renderClientScript() {
  return `<script src="/scripts/site.js"></script>`;
}

export function marketingPage({ route, title, description, exactTitle = false, active, body, bodyClass = "", extraHead = "", extraScripts = "" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${renderHead({ title, description, exactTitle, route })}
${extraHead}
</head>
<body class="${bodyClass}">
${renderHeader(active)}
${body}
${renderFooter()}
${renderClientScript()}
${extraScripts}
</body>
</html>`;
}

// ---------------- Authenticated app shell ----------------

function sideLinkHtml(item, currentHref) {
  const active = item.href === currentHref;
  return `<a class="side-link${active ? " active" : ""}" href="${item.href}">
    ${icon(item.icon)}<span>${item.title}</span>
    ${item.badge ? `<span class="count">${item.badge}</span>` : ""}
  </a>`;
}

export function renderAppSidebar(currentHref) {
  const groups = appNav
    .map(
      (g) => `<div class="side-group">
      <div class="side-group-title">${g.group}</div>
      ${g.items.map((it) => sideLinkHtml(it, currentHref)).join("")}
    </div>`
    )
    .join("");

  return `<aside class="app-sidebar" data-app-sidebar>
    <div class="app-sidebar-head">
      <a href="/index.html" class="brand" aria-label="InfoBridgeIndia home">
        <img class="brand-logo brand-logo-sidebar" src="/infobridgeindia-logo.png" alt="InfoBridgeIndia" />
      </a>
    </div>
    <div class="app-sidebar-company">
      <div class="company-avatar" data-company-initials>IB</div>
      <div>
        <div class="company-name" data-auth-company-name>Your company</div>
        <div class="company-sub" data-company-fy>India · INR</div>
      </div>
      <span style="margin-left:auto; color:rgba(255,255,255,0.4);">${icon("chevronDown", "").replace("<svg", '<svg width="14" height="14"')}</span>
    </div>
    <nav class="side-nav">${groups}</nav>
    <div class="app-sidebar-foot">
      <a class="side-link" href="/index.html">${icon("logout")}<span>Exit to website</span></a>
    </div>
  </aside>`;
}

export function renderAppTopbar({ title }) {
  return `<div class="app-topbar">
    <div class="row-gap-3">
      <button class="mobile-nav-toggle" data-sidebar-toggle style="color: var(--ink-700);" aria-label="Menu">${icon("menu")}</button>
      <div class="app-search">${icon("search")}<span>Search customers, invoices, employeesâ€¦</span></div>
    </div>
    <div class="topbar-actions">
      <span class="badge badge-brand">Sandbox data</span>
      <button class="icon-btn">${icon("bell")}</button>
      <button class="icon-btn">${icon("settings")}</button>
      <div class="avatar" data-session-initials>IB</div>
    </div>
  </div>`;
}

export function appPage({ title, description, currentHref, header, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${renderHead({ title, description })}
</head>
<body>
<div class="app-shell">
  ${renderAppSidebar(currentHref)}
  <div class="app-main">
    ${renderAppTopbar({ title })}
    <div class="app-content">
      ${header || ""}
      ${body}
    </div>
  </div>
</div>
${renderClientScript()}
</body>
</html>`;
}

export function breadcrumbs(trail) {
  return `<div class="breadcrumbs">
    ${trail
      .map((t, i) => {
        if (i === trail.length - 1) return `<span class="current">${t.label}</span>`;
        return `<a href="${t.href}">${t.label}</a><span class="sep">${icon("chevronRight").replace("<svg", '<svg width="12" height="12"')}</span>`;
      })
      .join("")}
  </div>`;
}
