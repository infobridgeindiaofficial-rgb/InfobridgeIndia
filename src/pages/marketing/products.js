import { servicePage } from "./service-template.js";
import { sectionHead, featureCard } from "../../components/ui.js";
import { breadcrumbs } from "../../components/layout.js";

const crumbBase = [{ label: "Home", href: "/index.html" }, { label: "Products", href: "/index.html" }];

export function salesCrmPage() {
  return servicePage({
    route: "/products/sales-crm.html",
    navKey: "products",
    icon: "sales",
    eyebrow: "Products / Sales & CRM",
    title: "CRM & Sales Management Software for Indian Businesses",
    lead: "Track leads and opportunities, send quotations, raise GST-compliant invoices and collect payment â€” with every step visible to the salesperson and the finance team at once.",
    crumb: [...crumbBase, { label: "Sales & CRM", href: "#" }],
    highlights: [
      { label: "Pipeline stages", value: "6" },
      { label: "Document types", value: "5" },
      { label: "Customer statements", value: "Auto" },
      { label: "Salesperson tracking", value: "Built-in" },
    ],
    subservices: [
      { icon: "crm", title: "Leads & Opportunities", desc: "Capture, qualify and move deals through your pipeline.", href: "/products/sales-crm.html#leads" },
      { icon: "clock", title: "Follow-ups & Sales Targets", desc: "Never lose a deal to a missed reminder.", href: "/products/sales-crm.html#followups" },
      { icon: "file", title: "Quotations & Sales Orders", desc: "Professional, GST-ready documents in seconds.", href: "/products/sales-crm.html#quotations" },
      { icon: "ledger", title: "Tax Invoices & Credit Notes", desc: "Invoicing that posts straight to accounting and GST.", href: "/products/sales-crm.html#invoices" },
      { icon: "wallet", title: "Payment Collection & Receivables", desc: "Overdue tracking that finance actually watches.", href: "/products/sales-crm.html#receivables" },
      { icon: "users", title: "Customer Statements", desc: "Share a running account statement any time.", href: "/products/sales-crm.html#statements" },
    ],
    workflow: {
      title: "Lead to cash, in one lifecycle",
      desc: null,
      steps: [
        { title: "Lead", desc: "Captured & qualified" },
        { title: "Opportunity", desc: "Tracked in pipeline" },
        { title: "Quotation", desc: "Sent to customer" },
        { title: "Sales order", desc: "Confirmed & scheduled" },
        { title: "Invoice", desc: "Raised & posted" },
        { title: "Payment", desc: "Collected & reconciled" },
      ],
    },
  });
}

export function purchasesPage() {
  return servicePage({
    route: "/products/purchases-procurement.html",
    navKey: "products",
    icon: "purchase",
    eyebrow: "Products / Purchases & Procurement",
    title: "Purchase & Procurement Management Software",
    lead: "Purchase requests, RFQs, vendor comparison, purchase orders, goods receipt and supplier payments â€” routed through the approval chain your business already uses.",
    crumb: [...crumbBase, { label: "Purchases & Procurement", href: "#" }],
    subservices: [
      { icon: "file", title: "Purchase Requests & Approvals", desc: "Requests routed to the right approver automatically.", href: "/products/purchases-procurement.html#requests" },
      { icon: "documents", title: "RFQs & Vendor Comparison", desc: "Compare vendor quotations side by side before deciding.", href: "/products/purchases-procurement.html#rfq" },
      { icon: "purchase", title: "Purchase Orders", desc: "Issued against approved requests, tracked to delivery.", href: "/products/purchases-procurement.html#po" },
      { icon: "inventory", title: "Goods Receipt", desc: "Stock updates the moment goods are received.", href: "/products/purchases-procurement.html#grn" },
      { icon: "ledger", title: "Purchase Bills & Debit Notes", desc: "Bills reconciled against POs and receipts automatically.", href: "/products/purchases-procurement.html#bills" },
      { icon: "wallet", title: "Supplier Payments & Ledger", desc: "Payables ageing and supplier statements, always current.", href: "/products/purchases-procurement.html#payments" },
    ],
    workflow: {
      title: "Request to payment",
      desc: null,
      steps: [
        { title: "Request", desc: "Raised by a department" },
        { title: "Approval", desc: "Routed by policy" },
        { title: "RFQ", desc: "Sent to vendors" },
        { title: "Purchase order", desc: "Issued to chosen vendor" },
        { title: "Goods receipt", desc: "Stock updated" },
        { title: "Payment", desc: "Bill settled & posted" },
      ],
    },
  });
}

export function inventoryPage() {
  return servicePage({
    route: "/products/inventory-warehouse.html",
    navKey: "products",
    icon: "inventory",
    eyebrow: "Products / Inventory & Warehouse",
    title: "Stock you can trust, across every warehouse",
    lead: "Products, SKUs, HSN/SAC and GST rates connected to real stock movement â€” with batch and serial tracking, reorder alerts and true product-level profitability.",
    crumb: [...crumbBase, { label: "Inventory & Warehouse", href: "#" }],
    subservices: [
      { icon: "package", title: "Products, SKUs & Units", desc: "HSN/SAC, GST rate, pricing and categories in one record.", href: "/inventory/index.html#products" },
      { icon: "warehouse", title: "Multiple Warehouses", desc: "Stock in, stock out and transfers between locations.", href: "/inventory/index.html#warehouses" },
      { icon: "alertTriangle", title: "Reorder Levels & Low Stock", desc: "Alerts before you run out, not after.", href: "/inventory/index.html#reports" },
      { icon: "layers", title: "Batch & Serial Tracking", desc: "Where it matters â€” pharma, electronics, food and more.", href: "/inventory/index.html#reports" },
      { icon: "checkCircle", title: "Stock Adjustments & Audit", desc: "Damaged, returned and adjusted stock, fully logged.", href: "/inventory/index.html#movements" },
      { icon: "scale", title: "Stock Valuation & Profitability", desc: "Know true margin per product, not just per sale.", href: "/inventory/index.html#reports" },
    ],
    workflow: {
      title: "From purchase to sale, stock stays accurate",
      desc: null,
      steps: [
        { title: "Goods received", desc: "Stock in" },
        { title: "Stored", desc: "Assigned to warehouse" },
        { title: "Reserved", desc: "Against sales order" },
        { title: "Dispatched", desc: "Stock out" },
        { title: "Valued", desc: "Ledger & margin updated" },
      ],
    },
  });
}

export function projectsOpsPage() {
  return servicePage({
    route: "/products/projects-operations.html",
    navKey: "products",
    icon: "projects",
    eyebrow: "Products / Projects & Office Operations",
    title: "Project Management Software for Indian Businesses",
    lead: "Projects, milestones and timesheets sit alongside internal requests, office assets and employee claims â€” so operational work is tracked with the same rigour as revenue.",
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
    lead: "Financial, GST, inventory, sales, HR and branch-level reports with real filters and export â€” plus a management view that surfaces what needs attention without burying it in charts.",
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
        <p class="text-lead">Grouped the way finance, operations and leadership actually think about the business â€” not an alphabetical feature list.</p>
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
