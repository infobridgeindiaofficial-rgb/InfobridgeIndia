const MODULES = [
  [/finance/, "Finance & Accounting"], [/sales/, "Sales & CRM"], [/purchases/, "Purchases & Procurement"],
  [/inventory/, "Inventory & Warehouse"], [/hr-payroll|\/app\/hr\//, "HR & Payroll"], [/projects/, "Projects & Operations"],
  [/documents/, "Documents"], [/approvals/, "Approvals & Workflows"], [/banking/, "Banking"],
  [/reports/, "Reports & Analytics"], [/admin/, "Administration"], [/gst/, "GST Workspace"],
];

const moduleName = MODULES.find(([pattern]) => pattern.test(location.pathname))?.[1] || "Workspace";
const backIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/><path d="M9 12h11"/></svg>';

function companyLabel() {
  const company = globalThis.InfoBridgeCompany;
  if (!company || company.profileComplete === false) return "Company profile incomplete";
  return currentCompanyName(company.name || "Company profile incomplete");
}

function makeBrandNonInteractive(sidebar) {
  const brand = sidebar.querySelector('a.sidebar-brand, a.gst-brand, a.projects-brand, a.documents-brand, .app-sidebar-head a.brand, a[data-workspace-brand]');
  if (!brand) return;
  const replacement = document.createElement("div");
  replacement.className = brand.className;
  replacement.dataset.workspaceBrand = "";
  replacement.innerHTML = brand.innerHTML;
  replacement.setAttribute("aria-label", "InfoBridgeIndia");
  brand.replaceWith(replacement);
}

function normalizeLabel(sidebar) {
  const legacyCompany = sidebar.querySelector(".app-sidebar-company");
  if (legacyCompany) {
    legacyCompany.className = "app-sidebar-company workspace-label";
    const currentTitle = legacyCompany.querySelector("strong");
    const currentCompany = legacyCompany.querySelector("[data-workspace-company]");
    if (!currentTitle || !currentCompany) legacyCompany.innerHTML = `<strong>${moduleName}</strong><span data-workspace-company>${companyLabel()}</span>`;
    else {
      if (currentTitle.textContent !== moduleName) currentTitle.textContent = moduleName;
      const value = companyLabel(); if (currentCompany.textContent !== value) currentCompany.textContent = value;
    }
    return;
  }
  const label = sidebar.querySelector(".workspace-label, .gst-label, .projects-header-title, .documents-header-title, .workspace-brand-copy");
  if (!label) return;
  const title = label.querySelector("strong");
  const company = label.querySelector("span");
  if (title && title.textContent !== moduleName) title.textContent = moduleName;
  if (company) {
    const value = companyLabel();
    if (company.textContent !== value) company.textContent = value;
    company.dataset.workspaceCompany = "";
  }
}

function normalizeFooter(sidebar) {
  let footer = sidebar.querySelector(".workspace-sidebar-footer, .local-note, .app-sidebar-foot");
  if (!footer) { footer = document.createElement("div"); sidebar.append(footer); }
  const changeBusiness = footer.querySelector("[data-change-business]");
  if (changeBusiness) {
    changeBusiness.classList.add("workspace-secondary-action");
    sidebar.querySelector("nav")?.append(changeBusiness);
  }
  if (footer.classList.contains("workspace-sidebar-footer") && footer.querySelector('.workspace-back-link[href="/index.html"] svg')) return;
  footer.className = "workspace-sidebar-footer";
  footer.innerHTML = `<a href="/index.html" class="workspace-back-link">${backIcon}<span>Back to main page</span></a>`;
}

function normalizeSidebar(sidebar) {
  if (!(sidebar instanceof HTMLElement)) return;
  makeBrandNonInteractive(sidebar);
  normalizeLabel(sidebar);
  normalizeFooter(sidebar);
}

function applyWorkspaceChrome() {
  document.querySelectorAll("aside.sidebar, aside.gst-sidebar, aside.workspace-sidebar, aside.app-sidebar").forEach(normalizeSidebar);
}

let scheduled = false;
const observer = new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; applyWorkspaceChrome(); });
});

if (document.readyState === "loading") addEventListener("DOMContentLoaded", () => { applyWorkspaceChrome(); observer.observe(document.body, { childList: true, subtree: true }); }, { once: true });
else { applyWorkspaceChrome(); observer.observe(document.body, { childList: true, subtree: true }); }

addEventListener("infobridge:company-ready", applyWorkspaceChrome);
listenForAdministrationCompany(applyWorkspaceChrome);
import { currentCompanyName, listenForAdministrationCompany } from "/administration-workspace/company.js";
