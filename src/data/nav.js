// Central navigation + module registry.
// Single source of truth for header mega-menus, footer, and the
// authenticated app sidebar â€” kept separate from presentation (layout.js)
// and from page content, per the "separate UI / navigation / config" goal.

export const BRAND = {
  name: "InfoBridgeIndia",
  tagline: "The business operating system for India",
};

export const mainNav = [
  {
    key: "products",
    label: "Products",
    href: "/index.html",
    mega: {
      columns: [
        {
          title: "Run the business",
          items: [
            { icon: "ledger", title: "Finance & Accounting", desc: "Ledgers, GST-ready books, financial statements", href: "/app/finance.html" },
            { icon: "sales", title: "Sales & CRM", desc: "Leads to invoices to collections, one pipeline", href: "/app/sales.html" },
            { icon: "purchase", title: "Purchases & Procurement", desc: "RFQs, approvals, purchase orders, bills", href: "/app/purchases.html" },
            { icon: "inventory", title: "Inventory & Warehouse", desc: "Multi-warehouse stock, batches, valuation", href: "/inventory/index.html" },
          ],
        },
        {
          title: "People & operations",
          items: [
            { icon: "hr", title: "HR & Payroll", desc: "Attendance, statutory payroll, self-service", href: "/hr-payroll/index.html" },
            { icon: "projects", title: "Projects & Operations", desc: "Timesheets, budgets, internal requests", href: "/app/projects.html" },
            { icon: "documents", title: "Documents", desc: "Contracts, records and expiry reminders", href: "/app/documents.html" },
            { icon: "approvals", title: "Internal Requests", desc: "Employee material, IT and service requests", href: "/app/approvals.html" },
          ],
        },
        {
          title: "Money & insight",
          items: [
            { icon: "bank", title: "Banking", desc: "Cash, statement import and reconciliation", href: "/app/banking.html" },
              { icon: "reports", title: "Reports & Analytics", desc: "Management, statutory and audit reports", href: "/app/reports.html" },
            { icon: "admin", title: "Administration", desc: "Companies, branches, roles & permissions", href: "/app/admin.html" },
          ],
        },
      ],
    },
  },
  {
    key: "solutions",
    label: "Business Tools",
    href: "/solutions.html",
    mega: {
      columns: [
        {
          title: "GST & Calculators",
          items: [
            { icon: "gst", title: "GST Calculator", desc: "Quick GST inclusive and exclusive amount workings", href: "/gst-calculator.html" },
            { icon: "clock", title: "GST Interest Calculator", desc: "Interest on delayed GST payments", href: "/gst-interest-calculator.html" },
            { icon: "alertCircle", title: "GST Late Fee Calculator", desc: "Late fees for delayed GST returns", href: "/gst-late-fee-calculator.html" },
            { icon: "ecommerce", title: "Marketplace Profit Calculator", desc: "True profit after marketplace fees and costs", href: "/marketplace-profit-calculator.html" },
          ],
        },
        {
          title: "PDF & Documents",
          items: [
            { icon: "documents", title: "PDF to Word", desc: "Convert PDF files into editable Word documents", href: "/pdf-to-word.html" },
            { icon: "grid", title: "Shipping Label 4-in-1 PDF", desc: "Fit 4 marketplace shipping labels on one A4 page", href: "/shipping-label-4in1.html" },
            { icon: "download", title: "Word to PDF", desc: "Convert Word documents into shareable PDFs", href: "/word-to-pdf.html" },
            { icon: "layers", title: "JPG to PDF", desc: "Convert JPG images into a single PDF", href: "/jpg-to-pdf.html" },
            { icon: "workflow", title: "Merge PDF", desc: "Combine multiple PDF files into one", href: "/merge-pdf.html" },
            { icon: "list", title: "Split PDF", desc: "Split a PDF into separate files or pages", href: "/split-pdf.html" },
          ],
        },
        {
          title: "Business Generators",
          items: [
            { icon: "file", title: "GST Invoice Generator", desc: "Create GST-compliant invoices in minutes", href: "/gst-invoice-generator.html" },
            { icon: "briefcase", title: "Quotation Generator", desc: "Create professional quotations for customers", href: "/quotation-generator.html" },
          ],
        },
      ],
    },
  },
  {
    key: "gst",
    label: "GST Workspace",
    href: "/app/gst/index.html",
  },
  {
    key: "about",
    label: "About Us",
    href: "/about.html",
  },
  { key: "pricing", label: "Pricing", href: "/pricing.html" },
];

export const footerColumns = [
  {
    title: "Products",
    links: [
      { title: "Finance & Accounting", href: "/app/finance.html" },
      { title: "Sales & CRM", href: "/app/sales.html" },
      { title: "Purchases & Procurement", href: "/app/purchases.html" },
      { title: "Inventory & Warehouse", href: "/inventory/index.html" },
      { title: "HR & Payroll", href: "/hr-payroll/index.html" },
      { title: "Banking", href: "/app/banking.html" },
    ],
  },
  {
    title: "Business Tools",
    links: [
      { title: "Reports & Analytics", href: "/app/reports.html" },
      { title: "Internal Requests", href: "/app/approvals.html" },
      { title: "Multi-branch & Enterprise", href: "/solutions.html#enterprise" },
      { title: "Service Business", href: "/solutions.html#service" },
    ],
  },
  {
    title: "GST Workspace",
    links: [
      { title: "GST & Tax Compliance", href: "/app/gst/index.html" },
      { title: "GSTR-1 Workspace", href: "/app/gst/gstr-1.html" },
      { title: "GSTR-3B", href: "/gst/gstr-3b.html" },
      { title: "Import & Export", href: "/products/import-export.html" },
    ],
  },
  {
    title: "Company",
    links: [
      { title: "Pricing", href: "/pricing.html" },
      { title: "Resources", href: "/resources.html" },
      { title: "Security", href: "/security.html" },
      { title: "Contact sales", href: "/pricing.html#contact" },
    ],
  },
];

// ---- Authenticated app sidebar ----
export const appNav = [
  {
    group: "Finance",
    items: [
        { icon: "ledger", title: "Finance & Accounting", href: "/app/finance.html" },
      { icon: "bank", title: "Banking", href: "/app/banking.html" },
    ],
  },
  {
    group: "Revenue",
    items: [{ icon: "sales", title: "Sales & CRM", href: "/app/sales.html" }],
  },
  {
    group: "Supply chain",
    items: [
      { icon: "purchase", title: "Purchases & Procurement", href: "/app/purchases.html" },
      { icon: "inventory", title: "Inventory & Warehouse", href: "/inventory/index.html" },
      { icon: "importexport", title: "Import & Export", href: "/app/import-export.html" },
    ],
  },
  {
    group: "Compliance",
    items: [
      { icon: "gst", title: "GST & Tax", href: "/app/gst/index.html", badge: "2 due" },
    ],
  },
  {
    group: "People",
    items: [
      { icon: "hr", title: "HR & Payroll", href: "/hr-payroll/index.html" },
      { icon: "projects", title: "Projects", href: "/app/projects.html" },
    ],
  },
  {
    group: "Operations",
    items: [
      { icon: "documents", title: "Documents", href: "/app/documents.html" },
      { icon: "approvals", title: "Approvals", href: "/app/approvals.html", badge: "5" },
    ],
  },
  {
    group: "Insight",
    items: [{ icon: "reports", title: "Reports & Analytics", href: "/app/reports.html" }],
  },
  {
    group: "System",
    items: [
      { icon: "admin", title: "Administration", href: "/app/admin.html" },
      { icon: "settings", title: "Settings", href: "/app/settings.html" },
    ],
  },
];
