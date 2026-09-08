import { servicePage } from "./service-template.js";
import { sectionHead, featureCard } from "../../components/ui.js";
import { breadcrumbs } from "../../components/layout.js";

const crumbBase = [{ label: "Home", href: "/index.html" }, { label: "Products", href: "/index.html" }];

export function projectsOpsPage() {
  return servicePage({
    route: "/products/projects-operations.html",
    navKey: "products",
    icon: "projects",
    eyebrow: "Products / Projects & Office Operations",
    title: "Project Management Software for Indian Businesses",
    lead: "Projects, milestones and timesheets sit alongside internal requests, office assets and employee claims — so operational work is tracked with the same rigour as revenue.",
    crumb: [...crumbBase, { label: "Projects & Operations", href: "#" }],
    subservices: [
      { icon: "projects", title: "Projects & Milestones", desc: "Tasks, teams and deadlines with budget tracking.", href: "/app/projects.html" },
      { icon: "clock", title: "Timesheets & Project Expenses", desc: "Time and cost rolled up into project profitability.", href: "/products/projects-operations.html#timesheets" },
      { icon: "briefcase", title: "Office Assets & Equipment", desc: "What's issued to whom, and when maintenance is due.", href: "/products/projects-operations.html#assets" },
      { icon: "file", title: "Internal Requests & Travel", desc: "Requests and claims routed through approvals.", href: "/products/projects-operations.html#requests" },
    ],
    workflow: null,
  });
}

export function reportsPage() {
  return servicePage({
    route: "/products/reports-analytics.html",
    navKey: "products",
    icon: "reports",
    eyebrow: "Products / Reports & Analytics",
    title: "Business Reports & Analytics Software",
    lead: "Financial, GST, inventory, sales, HR and branch-level reports with real filters and export — plus a management view that surfaces what needs attention without burying it in charts.",
    crumb: [...crumbBase, { label: "Reports & Analytics", href: "#" }],
    subservices: [
      { icon: "ledger", title: "Financial Reports", desc: "P&L, balance sheet, cash flow, trial balance, ledgers.", href: "/products/reports-analytics.html#financial" },
      { icon: "gst", title: "GST & Tax Reports", desc: "HSN summary, liability, ITC and return-wise reports.", href: "/products/reports-analytics.html#tax" },
      { icon: "inventory", title: "Inventory Reports", desc: "Valuation, movement and product profitability.", href: "/products/reports-analytics.html#inventory" },
      { icon: "hr", title: "HR & Payroll Reports", desc: "Attendance, payroll cost and department-wise headcount.", href: "/products/reports-analytics.html#hr" },
      { icon: "branches", title: "Branch & Project Reports", desc: "Performance sliced by branch, department or project.", href: "/products/reports-analytics.html#branch" },
      { icon: "admin", title: "Management Reports", desc: "The health-of-the-business view, for owners and CFOs.", href: "/products/reports-analytics.html#management" },
    ],
    workflow: null,
  });
}

export function productsOverviewPage() {
  const groups = [
    {
      title: "Run the business",
      items: [
        { icon: "ledger", title: "Finance & Accounting", desc: "General ledger, statements, cost centres, assets.", href: "/app/finance.html" },
        { icon: "sales", title: "Sales & CRM", desc: "Leads to invoices to collections.", href: "/app/sales.html" },
        { icon: "purchase", title: "Purchases & Procurement", desc: "RFQs, POs, goods receipt, supplier payments.", href: "/app/purchases.html" },
        { icon: "inventory", title: "Inventory & Warehouse", desc: "Multi-warehouse stock, batches, valuation.", href: "/inventory/index.html" },
      ],
    },
    {
      title: "Compliance & trade",
      items: [
        { icon: "gst", title: "GST & Tax Compliance", desc: "Returns, reconciliation, e-invoicing.", href: "/app/gst/index.html" },
        { icon: "approvals", title: "Approvals & Workflows", desc: "Configurable multi-level sign-off.", href: "/app/approvals.html" },
      ],
    },
    {
      title: "People & operations",
      items: [
        { icon: "hr", title: "HR & Payroll", desc: "Attendance, statutory payroll, self-service.", href: "/hr-payroll/index.html" },
        { icon: "projects", title: "Projects & Operations", desc: "Timesheets, budgets, office assets.", href: "/app/projects.html" },
        { icon: "documents", title: "Documents", desc: "Contracts and records, organised.", href: "/app/documents.html" },
      ],
    },
    {
      title: "Money & insight",
      items: [
        { icon: "bank", title: "Banking", desc: "Cash, bank feeds, reconciliation.", href: "/app/banking.html" },
        { icon: "reports", title: "Reports & Analytics", desc: "Financial, GST, inventory and HR reports.", href: "/products/reports-analytics.html" },
        { icon: "admin", title: "Administration", desc: "Companies, branches, roles, permissions.", href: "/app/admin.html" },
      ],
    },
  ];

  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Products", href: "#" }])}
      <div style="margin-top:18px; max-width:680px;">
        <span class="eyebrow">The full platform</span>
        <h1 class="h-1">Every module your business runs on</h1>
        <p class="text-lead">Grouped the way finance, operations and leadership actually think about the business — not an alphabetical feature list.</p>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="container stack-8">
      ${groups
        .map(
          (g) => `<div>
          <h3 class="h-5" style="margin-bottom:20px;">${g.title}</h3>
          <div class="grid g-4">${g.items.map((i) => featureCard(i)).join("")}</div>
        </div>`
        )
        .join("")}
    </div>
  </section>
  `;

  return { route: "/index.html", title: "Products", description: "Every InfoBridgeIndia module, grouped by how businesses actually work.", active: "products", body };
}
