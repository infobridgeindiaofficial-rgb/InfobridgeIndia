import { renderModulePage } from "./template.js";
import { renderHead } from "../../components/layout.js";

const crumbHome = { label: "Home", href: "/index.html" };

export function financePage() {
  return renderModulePage({
    route: "/app/finance.html",
    title: "Finance & Accounting",
    crumb: [crumbHome, { label: "Finance & Accounting", href: "#" }],
    description: "Chart of accounts, general ledger, financial statements and cost centres for the current financial year.",
    primaryAction: { label: "New journal entry", href: "#" },
    secondaryAction: { label: "View trial balance", href: "#" },
    attention: { tone: "info", title: "FY 2026â€“27 is open.", body: " 4 months of transactions posted so far, 0 unreconciled journals." },
    stats: [
      { label: "Trial balance", value: "Balanced" },
      { label: "Open journals", value: "0" },
      { label: "Cost centres", value: "6" },
      { label: "Last year closed", value: "31 Mar 2026" },
    ],
    table: {
      columns: [
        { key: "acc", label: "Account", render: (r) => `<span class="cell-primary">${r.acc}</span><div class="cell-sub">${r.group}</div>` },
        { key: "debit", label: "Debit", num: true, render: (r) => (r.debit ? `<span class="mono">â‚¹${r.debit}</span>` : "â€”") },
        { key: "credit", label: "Credit", num: true, render: (r) => (r.credit ? `<span class="mono">â‚¹${r.credit}</span>` : "â€”") },
      ],
      rows: [
        { acc: "Sales â€” Domestic", group: "Income", credit: "18,42,600" },
        { acc: "Purchases â€” Raw Material", group: "Direct Expense", debit: "9,10,400" },
        { acc: "Salaries & Wages", group: "Indirect Expense", debit: "3,20,000" },
        { acc: "Input CGST/SGST", group: "Current Asset", debit: "82,900" },
        { acc: "Output CGST/SGST", group: "Current Liability", credit: "1,64,300" },
      ],
    },
    activity: [
      { title: "Journal JV-0412 posted", meta: "Depreciation â€” Aug 2026" },
      { title: "Bank reconciliation completed", meta: "HDFC Current A/c Â· 15 Aug" },
    ],
    reportLinks: [
      { label: "Profit & Loss", href: "/app/reports.html" },
      { label: "Balance Sheet", href: "/app/reports.html" },
      { label: "Trial Balance", href: "/app/reports.html" },
    ],
  });
}

export function bankingPage() {
  return renderModulePage({
    route: "/app/banking.html",
    title: "Banking",
    crumb: [crumbHome, { label: "Banking", href: "#" }],
    description: "Cash and bank accounts, receipts, payments and reconciliation status.",
    primaryAction: { label: "Record transaction", href: "#" },
    attention: { tone: "warning", title: "7 statement lines are unmatched.", body: " Review HDFC Current A/c for the week of 11â€“17 Aug." },
    stats: [
      { label: "Total cash & bank", value: "â‚¹32,14,800" },
      { label: "Accounts", value: "4" },
      { label: "Unmatched lines", value: "7" },
      { label: "Last import", value: "17 Aug 2026" },
    ],
    table: {
      columns: [
        { key: "acc", label: "Account", render: (r) => `<span class="cell-primary">${r.acc}</span>` },
        { key: "type", label: "Type" },
        { key: "bal", label: "Balance", num: true, render: (r) => `<span class="mono">â‚¹${r.bal}</span>` },
      ],
      rows: [
        { acc: "HDFC Current A/c", type: "Bank", bal: "18,20,400" },
        { acc: "ICICI Current A/c", type: "Bank", bal: "9,44,900" },
        { acc: "Cash â€” Head Office", type: "Cash", bal: "1,18,500" },
        { acc: "Cash â€” Surat Branch", type: "Cash", bal: "3,31,000" },
      ],
    },
    activity: [
      { title: "Receipt against INV-2431", meta: "â‚¹1,84,200 Â· HDFC Current A/c" },
      { title: "Supplier payment to Textile Suppliers Co.", meta: "â‚¹4,20,000 Â· ICICI Current A/c" },
    ],
    reportLinks: [{ label: "Bank Reconciliation", href: "/app/reports.html" }, { label: "Cash Book", href: "/app/reports.html" }],
  });
}

export function salesPage() {
  return renderModulePage({
    route: "/app/sales.html",
    title: "Sales & CRM",
    crumb: [crumbHome, { label: "Sales & CRM", href: "#" }],
    description: "Leads, quotations, sales orders, invoices and collections.",
    primaryAction: { label: "New invoice", href: "#" },
    secondaryAction: { label: "New quotation", href: "#" },
    attention: { tone: "danger", title: "2 invoices are overdue by more than 30 days.", body: " Follow up with Orbit Retail Pvt Ltd and Kohli Wholesale." },
    stats: [
      { label: "Sales (MTD)", value: "â‚¹18,42,600" },
      { label: "Open quotations", value: "9" },
      { label: "Receivables outstanding", value: "â‚¹9,05,300" },
      { label: "Overdue invoices", value: "2" },
    ],
    table: {
      columns: [
        { key: "doc", label: "Invoice", render: (r) => `<span class="cell-primary">${r.doc}</span>` },
        { key: "party", label: "Customer" },
        { key: "amount", label: "Amount", num: true, render: (r) => `<span class="mono">â‚¹${r.amount}</span>` },
        { key: "status", label: "Status", render: (r) => `<span class="badge badge-${r.tone}">${r.status}</span>` },
      ],
      rows: [
        { doc: "INV-2431", party: "Kavya Textiles", amount: "1,84,200", status: "Paid", tone: "success" },
        { doc: "INV-2430", party: "Orbit Retail Pvt Ltd", amount: "62,500", status: "Overdue", tone: "danger" },
        { doc: "INV-2429", party: "Nimbus Traders", amount: "1,10,000", status: "Sent", tone: "info" },
      ],
    },
    activity: [
      { title: "Quotation QT-118 sent", meta: "InfoBridgeIndia Retail Group" },
      { title: "Sales order SO-092 confirmed", meta: "Kavya Textiles" },
    ],
    reportLinks: [{ label: "Sales Register", href: "/app/reports.html" }, { label: "Receivables Ageing", href: "/app/reports.html" }],
  });
}

export function purchasesPage() {
  return renderModulePage({
    route: "/app/purchases.html",
    title: "Purchases & Procurement",
    crumb: [crumbHome, { label: "Purchases & Procurement", href: "#" }],
    description: "Purchase requests, RFQs, purchase orders, goods receipt and supplier bills.",
    primaryAction: { label: "New purchase order", href: "#" },
    attention: { tone: "info", title: "3 purchase requests are waiting for approval.", body: "" },
    stats: [
      { label: "Purchases (MTD)", value: "â‚¹9,10,400" },
      { label: "Open purchase orders", value: "6" },
      { label: "Payables outstanding", value: "â‚¹5,42,000" },
      { label: "Pending approvals", value: "3" },
    ],
    table: {
      columns: [
        { key: "doc", label: "PO", render: (r) => `<span class="cell-primary">${r.doc}</span>` },
        { key: "party", label: "Supplier" },
        { key: "amount", label: "Amount", num: true, render: (r) => `<span class="mono">â‚¹${r.amount}</span>` },
        { key: "status", label: "Status", render: (r) => `<span class="badge badge-${r.tone}">${r.status}</span>` },
      ],
      rows: [
        { doc: "PO-118", party: "Textile Suppliers Co.", amount: "4,20,000", status: "Received", tone: "success" },
        { doc: "PO-117", party: "Om Packaging", amount: "82,500", status: "Awaiting receipt", tone: "info" },
        { doc: "PO-116", party: "Sri Dyes & Chemicals", amount: "1,64,000", status: "Approval pending", tone: "warning" },
      ],
    },
    activity: [{ title: "Goods received against PO-118", meta: "Mumbai Warehouse" }],
    reportLinks: [{ label: "Purchase Register", href: "/app/reports.html" }, { label: "Payables Ageing", href: "/app/reports.html" }],
  });
}

export function inventoryPage() {
  return renderModulePage({
    route: "/app/inventory.html",
    title: "Inventory & Warehouse",
    crumb: [crumbHome, { label: "Inventory & Warehouse", href: "#" }],
    description: "Stock levels, warehouses, valuation and product profitability.",
    primaryAction: { label: "Stock adjustment", href: "#" },
    attention: { tone: "warning", title: "3 products are below reorder level.", body: " Packing Boxes (Medium), Zipper Rolls, Cotton Fabric (Surat WH)." },
    stats: [
      { label: "Stock value", value: "â‚¹22,80,600" },
      { label: "SKUs tracked", value: "184" },
      { label: "Warehouses", value: "2" },
      { label: "Below reorder level", value: "3" },
    ],
    table: {
      columns: [
        { key: "item", label: "Item", render: (r) => `<span class="cell-primary">${r.item}</span><div class="cell-sub">${r.wh}</div>` },
        { key: "qty", label: "Quantity", num: true },
        { key: "status", label: "Status", render: (r) => `<span class="badge badge-${r.tone}">${r.status}</span>` },
      ],
      rows: [
        { item: "Cotton Fabric â€” Roll", wh: "Mumbai Warehouse", qty: "1,240 mtr", status: "Healthy", tone: "success" },
        { item: "Cotton Fabric â€” Roll", wh: "Surat Warehouse", qty: "340 mtr", status: "Low", tone: "warning" },
        { item: "Packing Boxes â€” Medium", wh: "Mumbai Warehouse", qty: "120 pcs", status: "Reorder", tone: "danger" },
      ],
    },
    activity: [{ title: "Stock transfer SW-Mumbai â†’ Surat completed", meta: "220 mtr Cotton Fabric" }],
    reportLinks: [{ label: "Stock Valuation", href: "/app/reports.html" }, { label: "Product Profitability", href: "/app/reports.html" }],
  });
}

export function importExportPage() {
  return renderModulePage({
    route: "/app/import-export.html",
    title: "Import & Export",
    crumb: [crumbHome, { label: "Import & Export", href: "#" }],
    description: "Overseas customers and suppliers, foreign currency documents and shipments.",
    primaryAction: { label: "New export invoice", href: "#" },
    stats: [
      { label: "Export sales (FY)", value: "$142,600" },
      { label: "Active shipments", value: "3" },
      { label: "Overseas receivables", value: "$28,400" },
    ],
    emptyStateConfig: {
      icon: "globe",
      title: "No shipments in progress",
      desc: "Create an export invoice or import purchase to start tracking shipments and landed cost.",
      action: { label: "New export invoice", href: "#" },
    },
    activity: [{ title: "Export invoice EXP-014 raised", meta: "Vantage Exports LLC Â· $8,200" }],
    reportLinks: [{ label: "Export Register", href: "/app/reports.html" }],
  });
}

export function projectsPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${renderHead({title:"Projects & Operations",description:"A practical local-first project sheet for small businesses."})}
<link rel="stylesheet" href="/styles/projects.css" />
</head>
<body class="projects-workspace-page workspace-standard-page">
  <aside class="workspace-sidebar">
    <div class="projects-brand" data-workspace-brand aria-label="InfoBridgeIndia"><img src="/infobridgeindia-logo.png" alt="InfoBridgeIndia" /></div>
    <div class="workspace-brand-copy"><strong>Projects & Operations</strong><span>Company</span></div>
    <nav aria-label="Projects navigation"></nav>
    <div class="workspace-sidebar-footer"><a class="workspace-back-link" href="/index.html"><span>Back to main page</span></a></div>
  </aside>
  <main class="projects-workspace-main">
    <div class="projects-intro"><div><span class="eyebrow">Projects & Operations</span><h1>Projects workspace</h1><p>Create a project, update a simple smart sheet, and export a professional report.</p></div></div>
    <div id="projects-workspace"><div class="projects-boot">Opening your projects…</div></div>
  </main>
  <div id="projects-modal"></div><div id="projects-toast" aria-live="polite"></div>
  <script type="module" src="/scripts/projects.js"></script>
</body>
</html>`;
}

export function documentsPage() {
  return renderModulePage({
    route: "/app/documents.html",
    title: "Documents",
    crumb: [crumbHome, { label: "Documents", href: "#" }],
    description: "Contracts, employee and vendor documents, organised by folder.",
    primaryAction: { label: "Upload document", href: "#" },
    attention: { tone: "warning", title: "1 vendor agreement expires within 30 days.", body: " Om Packaging â€” Supply Agreement, expires 10 Sep 2026." },
    stats: [
      { label: "Documents stored", value: "342" },
      { label: "Folders", value: "18" },
      { label: "Expiring soon", value: "1" },
    ],
    emptyStateConfig: {
      icon: "folder",
      title: "Browse documents by folder",
      desc: "Contracts, employee records, vendor and tax documents are organised here with permissions and expiry tracking.",
      action: { label: "Upload document", href: "#" },
    },
    activity: [{ title: "Offer letter uploaded", meta: "New hire â€” Ananya Iyer" }],
    reportLinks: [],
  });
}

export function approvalsPage() {
  return renderModulePage({
    route: "/app/approvals.html",
    title: "Internal Requests",
    crumb: [crumbHome, { label: "Internal Requests", href: "#" }],
    description: "Employee material, IT and service requests, routed to the responsible team.",
    stats: [
      { label: "Waiting on your team", value: "5" },
      { label: "Completed this week", value: "11" },
      { label: "Categories configured", value: "22" },
    ],
    table: {
      columns: [
        { key: "type", label: "Category", render: (r) => `<span class="cell-primary">${r.type}</span><div class="cell-sub">${r.detail}</div>` },
        { key: "from", label: "Requested by" },
        { key: "status", label: "Status", render: () => `<span class="badge badge-warning">Pending</span>` },
      ],
      rows: [
        { type: "Stationery request", detail: "A4 Copy Paper Ã— 10 packs", from: "HR Department" },
        { type: "Leave request", detail: "6 days, 2â€“7 Sep", from: "Ananya Iyer" },
        { type: "Expense reimbursement", detail: "â‚¹8,400 â€” Client travel", from: "Rohit Mehta" },
      ],
    },
    activity: [{ title: "Stationery request completed", meta: "Issued from warehouse stock" }],
    reportLinks: [],
  });
}

export function reportsAppPage() {
  return renderModulePage({
    route: "/app/reports.html",
    title: "Reports & Analytics",
    crumb: [crumbHome, { label: "Reports & Analytics", href: "#" }],
    description: "Financial, GST, inventory, HR and management reports with filters and export.",
    stats: [
      { label: "Reports available", value: "24" },
      { label: "Scheduled exports", value: "2" },
    ],
    table: {
      columns: [
        { key: "name", label: "Report", render: (r) => `<span class="cell-primary">${r.name}</span>` },
        { key: "cat", label: "Category" },
        { key: "action", label: "", render: () => `<a class="text-small text-brand" style="font-weight:650;" href="#">Open â†’</a>` },
      ],
      rows: [
        { name: "Profit & Loss", cat: "Financial" },
        { name: "Balance Sheet", cat: "Financial" },
        { name: "GSTR-1 Summary", cat: "GST" },
        { name: "Stock Valuation", cat: "Inventory" },
        { name: "Receivables Ageing", cat: "Sales" },
        { name: "Payroll Cost by Department", cat: "HR" },
      ],
    },
    activity: [],
    reportLinks: [],
  });
}

export function adminPage() {
  return renderModulePage({
    route: "/app/admin.html",
    title: "Administration",
    crumb: [crumbHome, { label: "Administration", href: "#" }],
    description: "Companies, branches, roles and permissions for this account.",
    primaryAction: { label: "Invite team member", href: "#" },
    stats: [
      { label: "Companies", value: "1" },
      { label: "Branches", value: "2" },
      { label: "Active users", value: "14" },
      { label: "Custom roles", value: "3" },
    ],
    table: {
      columns: [
        { key: "name", label: "User", render: (r) => `<span class="cell-primary">${r.name}</span><div class="cell-sub">${r.email}</div>` },
        { key: "role", label: "Role" },
        { key: "status", label: "Status", render: (r) => `<span class="badge badge-${r.tone}">${r.status}</span>` },
      ],
      rows: [
        { name: "Salman Patel", email: "mohamedsalman.cad@gmail.com", role: "Owner", status: "Active", tone: "success" },
        { name: "Priya Sharma", email: "priya@sundarkrafts.in", role: "Finance Manager", status: "Active", tone: "success" },
        { name: "Rohit Mehta", email: "rohit@sundarkrafts.in", role: "Sales Manager", status: "Invited", tone: "info" },
      ],
    },
    activity: [],
    reportLinks: [],
  });
}

export function settingsPage() {
  return renderModulePage({
    route: "/app/settings.html",
    title: "Settings",
    crumb: [crumbHome, { label: "Settings", href: "#" }],
    description: "Company profile, financial year, GST registration and preferences.",
    stats: [],
    emptyStateConfig: {
      icon: "settings",
      title: "Company settings",
      desc: "GSTIN, financial year, invoice numbering and notification preferences live here.",
      action: { label: "Edit company profile", href: "#" },
    },
    activity: [],
    reportLinks: [],
  });
}
