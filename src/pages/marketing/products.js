import { servicePage } from "./service-template.js";
import { sectionHead, featureCard } from "../../components/ui.js";
import { breadcrumbs } from "../../components/layout.js";

const crumbBase = [{ label: "Home", href: "/index.html" }, { label: "Products", href: "/index.html" }];

export function financeAccountingPage() {
  return servicePage({
    route: "/products/finance-accounting.html",
    navKey: "products",
    icon: "ledger",
    eyebrow: "Products / Finance & Accounting",
    title: "Accounting built for real businesses, not a hobby ledger",
    lead: "A complete double-entry accounting system â€” chart of accounts, general ledger, financial statements, cost centres and multi-company books â€” that GST, sales, purchases and payroll all post into automatically.",
    crumb: [...crumbBase, { label: "Finance & Accounting", href: "#" }],
    highlights: [
      { label: "Core registers", value: "12+" },
      { label: "Standard reports", value: "10" },
      { label: "Financial years", value: "Unlimited" },
      { label: "Companies per account", value: "Unlimited" },
    ],
    subservices: [
      { icon: "ledger", title: "Chart of Accounts & General Ledger", desc: "A structured, extensible account hierarchy behind every report.", href: "/products/finance-accounting.html#coa" },
      { icon: "file", title: "Journal Entries & Adjustments", desc: "Manual entries with full approval and audit trail.", href: "/products/finance-accounting.html#journals" },
      { icon: "reports", title: "Trial Balance, P&L & Balance Sheet", desc: "Always current, drillable down to the source voucher.", href: "/products/finance-accounting.html#statements" },
      { icon: "bank", title: "Cash Book & Bank Book", desc: "Every cash and bank movement, reconciled continuously.", href: "/products/finance-accounting.html#cashbank" },
      { icon: "users", title: "Receivables & Payables", desc: "Customer and supplier ledgers with ageing built in.", href: "/products/finance-accounting.html#ledgers" },
      { icon: "briefcase", title: "Fixed Assets & Depreciation", desc: "Asset register with automated depreciation schedules.", href: "/products/finance-accounting.html#assets" },
      { icon: "branches", title: "Cost Centres, Departments & Branches", desc: "Slice every report by where the money actually moved.", href: "/products/finance-accounting.html#costcentres" },
      { icon: "target", title: "Budgets", desc: "Plan by department or cost centre, track variance live.", href: "/products/finance-accounting.html#budgets" },
      { icon: "calendar", title: "Financial Year & Closing", desc: "Structured year-end close with a locked, auditable trail.", href: "/products/finance-accounting.html#yearclose" },
    ],
    workflow: {
      title: "From transaction to financial statement",
      desc: "Every module below feeds accounting directly â€” nothing is re-entered.",
      steps: [
        { title: "Transaction occurs", desc: "Sale, purchase, payroll or bank entry" },
        { title: "Journal posts", desc: "Auto-generated, always balanced" },
        { title: "Ledgers update", desc: "Customer, supplier & GL accounts" },
        { title: "Statements refresh", desc: "Trial balance, P&L, balance sheet" },
        { title: "Year closes", desc: "Locked, carried forward, audited" },
      ],
    },
  });
}

export function salesCrmPage() {
  return servicePage({
    route: "/products/sales-crm.html",
    navKey: "products",
    icon: "sales",
    eyebrow: "Products / Sales & CRM",
    title: "One pipeline from first conversation to collected payment",
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
    title: "Procurement with approvals that actually happen",
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

export function bankingPage() {
  return servicePage({
    route: "/products/banking.html",
    navKey: "products",
    icon: "bank",
    eyebrow: "Products / Banking",
    title: "Every rupee in and out, reconciled",
    lead: "Cash and bank accounts, receipts, payments and transfers â€” reconciled against statements automatically, with marketplace settlements and payroll payments flowing in from the modules that generate them.",
    crumb: [...crumbBase, { label: "Banking", href: "#" }],
    subservices: [
      { icon: "wallet", title: "Cash & Bank Accounts", desc: "Every account your business operates, in one view.", href: "/products/banking.html#accounts" },
      { icon: "creditCard", title: "Receipts & Payments", desc: "Customer receipts and supplier payments, categorised.", href: "/products/banking.html#transactions" },
      { icon: "checkCircle", title: "Bank Reconciliation", desc: "Statement lines matched to book entries automatically.", href: "/products/banking.html#reconciliation" },
      { icon: "ecommerce", title: "Marketplace Settlements", desc: "E-commerce payouts reconciled against orders and fees.", href: "/products/banking.html#settlements" },
      { icon: "payroll", title: "Payroll & Statutory Payments", desc: "Salary and statutory dues paid and posted together.", href: "/products/banking.html#payroll" },
    ],
    workflow: null,
    extraSections: `<section class="section">
      <div class="container">
        ${sectionHead({ eyebrow: "Always reconciled", title: "Unmatched transactions don't hide" })}
        <div class="grid g-3">
          ${featureCard({ icon: "checkCircle", title: "Auto-matching", desc: "Statement imports matched to book entries by amount, date and reference." })}
          ${featureCard({ icon: "alertTriangle", title: "Exceptions surfaced", desc: "Unmatched lines flagged for review â€” never silently ignored." })}
          ${featureCard({ icon: "reports", title: "Reconciliation reports", desc: "A clean audit trail for every bank account, every period." })}
        </div>
      </div>
    </section>`,
  });
}

export function projectsOpsPage() {
  return servicePage({
    route: "/products/projects-operations.html",
    navKey: "products",
    icon: "projects",
    eyebrow: "Products / Projects & Office Operations",
    title: "Projects, tasks and the office running behind the business",
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

export function documentsPage() {
  return servicePage({
    route: "/products/documents.html",
    navKey: "products",
    icon: "documents",
    eyebrow: "Products / Documents",
    title: "Every business document, organised and never expiring quietly",
    lead: "Contracts, invoices, employee records and vendor documents â€” organised into folders with permissions, version history and expiry reminders.",
    crumb: [...crumbBase, { label: "Documents", href: "#" }],
    subservices: [
      { icon: "folder", title: "Folders & Access Permissions", desc: "Organised the way your business actually works.", href: "/products/documents.html#folders" },
      { icon: "calendar", title: "Expiry Reminders", desc: "Contracts, licences and agreements â€” tracked before they lapse.", href: "/products/documents.html#expiry" },
      { icon: "file", title: "Version & Document History", desc: "Know what changed, when, and who changed it.", href: "/products/documents.html#history" },
    ],
    workflow: null,
  });
}

export function approvalsPage() {
  return servicePage({
    route: "/products/approvals-workflows.html",
    navKey: "products",
    icon: "approvals",
    eyebrow: "Products / Approvals & Workflows",
    title: "Approvals that match how your company actually decides",
    lead: "Configurable, multi-level approval chains for purchases, expenses, leave, discounts and payments â€” so bigger organisations get the governance they need without slowing everyone else down.",
    crumb: [...crumbBase, { label: "Approvals & Workflows", href: "#" }],
    subservices: [
      { icon: "purchase", title: "Purchase & Payment Approvals", desc: "Employee â†’ Manager â†’ Finance, or your own chain.", href: "/products/approvals-workflows.html#purchase" },
      { icon: "wallet", title: "Expense Claim Approvals", desc: "Claims routed and settled without spreadsheets.", href: "/products/approvals-workflows.html#expense" },
      { icon: "hr", title: "Leave & HR Approvals", desc: "Employee â†’ Manager â†’ HR, with balances checked automatically.", href: "/products/approvals-workflows.html#leave" },
      { icon: "sales", title: "Discount & Quotation Approvals", desc: "Keep pricing discipline without blocking the sales team.", href: "/products/approvals-workflows.html#discount" },
    ],
    workflow: {
      title: "One configurable engine, many workflows",
      desc: null,
      steps: [
        { title: "Request raised", desc: "By any employee" },
        { title: "Routed", desc: "By configured rule" },
        { title: "Reviewed", desc: "By each approver in order" },
        { title: "Approved or returned", desc: "With a visible reason" },
        { title: "Actioned", desc: "System proceeds automatically" },
      ],
    },
  });
}

export function reportsPage() {
  return servicePage({
    route: "/products/reports-analytics.html",
    navKey: "products",
    icon: "reports",
    eyebrow: "Products / Reports & Analytics",
    title: "A report centre that management actually opens",
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

export function importExportPage() {
  return servicePage({
    route: "/products/import-export.html",
    navKey: "solutions",
    icon: "importexport",
    eyebrow: "Products / Import & Export",
    title: "International trade, without a separate spreadsheet system",
    lead: "IEC details, overseas customers and suppliers, foreign currency invoicing, landed cost and shipment tracking â€” integrated with accounting, inventory, banking and tax rather than kept apart from them.",
    crumb: [...crumbBase, { label: "Import & Export", href: "#" }],
    subservices: [
      { icon: "globe", title: "Overseas Customers & Suppliers", desc: "IEC, country and currency held against every party.", href: "/products/import-export.html#parties" },
      { icon: "creditCard", title: "Foreign Currency & Exchange Rates", desc: "Forex gain/loss calculated automatically at settlement.", href: "/products/import-export.html#forex" },
      { icon: "truck", title: "Shipping, Freight & Landed Cost", desc: "True cost per unit once freight and insurance are in.", href: "/products/import-export.html#landedcost" },
      { icon: "file", title: "Export Invoices & LUT", desc: "Export GST workflow, including LUT-based supplies.", href: "/products/import-export.html#exportgst" },
      { icon: "wallet", title: "International Receivables & Payables", desc: "Overseas ledgers alongside your domestic books.", href: "/products/import-export.html#ledgers" },
    ],
    workflow: {
      title: "Shipment to settlement",
      desc: null,
      steps: [
        { title: "Order confirmed", desc: "Overseas customer/supplier" },
        { title: "Shipment", desc: "Freight, insurance, customs" },
        { title: "Landed cost", desc: "Calculated per unit" },
        { title: "Invoice", desc: "Foreign currency, GST-aware" },
        { title: "Settlement", desc: "Forex gain/loss posted" },
      ],
    },
  });
}

export function administrationPage() {
  return servicePage({
    route: "/products/administration.html",
    navKey: "products",
    icon: "admin",
    eyebrow: "Products / Administration",
    title: "Companies, branches, roles and permissions â€” governed centrally",
    lead: "One console to manage every company under an account, every branch and department, and exactly what each role is allowed to view, create, edit, delete, approve or export.",
    crumb: [...crumbBase, { label: "Administration", href: "#" }],
    subservices: [
      { icon: "branches", title: "Companies & Branches", desc: "Each with its own GSTIN, books and bank accounts.", href: "/products/administration.html#companies" },
      { icon: "users", title: "Roles & Permissions", desc: "Owner, CFO, accountant, HR, sales â€” or a role you build.", href: "/products/administration.html#roles" },
      { icon: "shield", title: "Audit Trail", desc: "Every sensitive change, attributed and timestamped.", href: "/products/administration.html#audit" },
      { icon: "hr", title: "Employee Self-Service Access", desc: "Give employees their own scoped workspace.", href: "/products/administration.html#selfservice" },
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
        { icon: "importexport", title: "Import & Export", desc: "Foreign currency, landed cost, shipments.", href: "/products/import-export.html" },
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
        { icon: "bank", title: "Banking", desc: "Cash, bank feeds, reconciliation.", href: "/products/banking.html" },
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
