import { icon } from "../../components/icons.js";
import { breadcrumbs } from "../../components/layout.js";
import { sectionHead, flow, ctaBand } from "../../components/ui.js";

const crumbBase = [{ label: "Home", href: "/index.html" }, { label: "Products", href: "/index.html" }];

export const financeSections = [
  { id: "core-accounting", icon: "ledger", title: "Core Accounting", desc: "The books, entries and balances at the centre of the accounting system.", tools: ["Chart of Accounts", "General Ledger", "Journal Entries", "Receipts", "Payments", "Contra Entries", "Opening Balances", "Account Adjustments"] },
  { id: "accounts-receivable", icon: "users", title: "Accounts Receivable", desc: "Track customer balances from invoice through collection.", tools: ["Customers", "Customer Accounts", "Customer Ledger", "Outstanding Receivables", "Receivables Ageing", "Collections", "Customer Advances", "Credit Adjustments"] },
  { id: "accounts-payable", icon: "purchase", title: "Accounts Payable", desc: "Control supplier balances, bills, advances and payments.", tools: ["Suppliers", "Supplier Accounts", "Supplier Ledger", "Bills Payable", "Payables Ageing", "Supplier Payments", "Supplier Advances", "Debit Adjustments"] },
  { id: "cash-bank-accounting", icon: "bank", title: "Cash & Bank Accounting", desc: "The accounting record of cash and bank movement without duplicating banking operations.", tools: ["Cash Book", "Bank Book", "Petty Cash", "Bank Accounts", "Cash Transfers", "Bank Transfers", "Bank Reconciliation", "Unmatched Transactions"] },
  { id: "expense-accounting", icon: "wallet", title: "Expense Accounting", desc: "Record, classify, allocate and analyse operating expenses.", tools: ["Expense Entries", "Expense Categories", "Recurring Expenses", "Business Expenses", "Employee Expenses", "Expense Allocation", "Expense Analysis"] },
  { id: "fixed-assets", icon: "briefcase", title: "Fixed Assets", desc: "Manage the complete financial lifecycle of business assets.", tools: ["Fixed Asset Register", "Asset Categories", "Asset Purchases", "Asset Allocation", "Asset Disposal", "Depreciation", "Asset Value", "Asset History"] },
  { id: "financial-statements", icon: "reports", title: "Financial Statements", desc: "Current, drillable statements and reports for management and review.", featured: true, tools: ["Trial Balance", "Profit & Loss", "Balance Sheet", "Cash Flow Statement", "General Ledger Report", "Receivables Report", "Payables Report", "Expense Report"] },
  { id: "management-accounting", icon: "target", title: "Cost & Management Accounting", desc: "Understand performance by responsibility, location and project.", tools: ["Cost Centres", "Departments", "Branch Accounting", "Project Accounting", "Budgets", "Budget vs Actual", "Department Profitability", "Branch Profitability", "Project Profitability"] },
  { id: "period-closing", icon: "calendar", title: "Financial Period & Closing", desc: "Control periods and complete month-end and year-end close with confidence.", tools: ["Financial Year", "Accounting Periods", "Period Lock", "Month Closing", "Year Closing", "Closing Entries", "Adjustment Entries", "Opening Balance Carry Forward"] },
  { id: "audit-control", icon: "shield", title: "Audit & Control", desc: "Trace activity, approvals, postings and reversals across the books.", tools: ["Audit Trail", "Transaction History", "User Activity", "Posted Entries", "Reversed Entries", "Approval History", "Locked Periods"] },
  { id: "advanced-accounting", icon: "branches", title: "Advanced Accounting", desc: "Architecture for complex organisations, kept separate from everyday accounting.", advanced: true, tools: ["Multi-company Accounting", "Multi-branch Books", "Multi-currency Accounting", "Exchange Rates", "Forex Gain/Loss", "Inter-company Transactions", "Consolidated Financial Statements"] },
];

function slug(value) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toolHref(tool) {
  return `/products/finance-accounting/${slug(tool)}.html`;
}

function renderSection(section) {
  return `<section id="${section.id}" class="finance-hub-section${section.featured ? " featured" : ""}${section.advanced ? " advanced" : ""}">
    <div class="finance-section-head"><span class="finance-section-icon">${icon(section.icon)}</span><div><h2 class="h-3">${section.title}</h2><p>${section.desc}</p></div></div>
    <div class="finance-tool-grid">${section.tools.map((tool) => `<a class="finance-tool-link" href="${toolHref(tool)}"><span>${tool}</span>${icon("arrowRight")}</a>`).join("")}</div>
  </section>`;
}

export function financeAccountingPage() {
  const body = `<section class="service-hero"><div class="container">
    ${breadcrumbs([...crumbBase, { label: "Finance & Accounting", href: "#" }])}
    <div class="service-hero-top" style="margin-top:18px;"><div><span class="eyebrow">Products / Finance & Accounting</span><h1 class="h-1">Finance & Accounting</h1><p class="text-lead">Manage your complete books, cash flow, receivables, payables, assets, budgets and financial reporting from one connected accounting system.</p></div></div>
  </div></section>
  <section class="section"><div class="container"><div class="finance-hub-intro">${sectionHead({ eyebrow: "Accounting structure", title: "Everything finance teams need, clearly organised", desc: "Start with daily books and move into reporting, closing, control and advanced group accounting when needed." })}</div><div class="finance-hub-list">
    ${financeSections.slice(0, 2).map(renderSection).join("")}
    <div class="finance-process">${sectionHead({ eyebrow: "Receivables process", title: "From invoice to a reconciled customer account", desc: null })}${flow([{ title: "Invoice", desc: "Amount becomes due" }, { title: "Receivable", desc: "Outstanding is tracked" }, { title: "Collection", desc: "Payment is recorded" }, { title: "Customer Ledger", desc: "Account stays current" }])}</div>
    ${financeSections.slice(2).map(renderSection).join("")}
  </div></div></section>
  <section class="section"><div class="container">${ctaBand({ title: "Open your complete accounting workspace", desc: "Set up your books and activate only the finance tools your business needs.", primary: { href: "/signup.html", label: "Create account" }, secondary: { href: "/index.html", label: "Back to main page" } })}</div></section>`;
  return { route: "/products/finance-accounting.html", title: "Finance & Accounting", description: "Manage books, cash flow, receivables, payables, assets, budgets and financial reporting in InfoBridgeIndia.", active: "products", body };
}

export function financeAccountingDetailPages() {
  return financeSections.flatMap((section) => section.tools.map((tool) => {
    const body = `<section class="service-hero"><div class="container">${breadcrumbs([...crumbBase, { label: "Finance & Accounting", href: "/products/finance-accounting.html" }, { label: tool, href: "#" }])}<div class="service-hero-top" style="margin-top:18px;"><div><span class="eyebrow">Finance & Accounting / ${section.title}</span><h1 class="h-1">${tool}</h1><p class="text-lead">A dedicated ${tool.toLowerCase()} workspace within InfoBridgeIndia Finance & Accounting.</p></div><div class="service-icon-badge">${icon(section.icon)}</div></div></div></section>
    <section class="section"><div class="container"><div class="finance-detail-shell"><span class="eyebrow">Workspace structure</span><h2 class="h-3">Built for the complete ${tool.toLowerCase()} process</h2><p class="text-lead">This route establishes the dedicated page in the finance architecture. Transaction processing and accounting-engine functionality will be connected here in a later implementation phase.</p><a class="btn btn-secondary" href="/products/finance-accounting.html#${section.id}">Back to ${section.title}</a></div></div></section>`;
    return { route: toolHref(tool), title: tool, description: `${tool} in InfoBridgeIndia Finance & Accounting.`, active: "products", body };
  }));
}
