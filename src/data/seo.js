const DOMAIN = "https://infobridgeindia.online";

const page = (title, description, schema = "") => ({ title, description, schema });

export const SEO_PAGES = Object.freeze({
  "/index.html": page(
    "Business Management Software India | InfoBridgeIndia",
    "All-in-one business management software for Indian businesses. Manage GST billing, accounting, CRM, inventory, sales, purchases, HR, payroll and projects with InfoBridgeIndia.",
    "homepage"
  ),
  "/gst.html": page(
    "GST Billing Software India | InfoBridgeIndia",
    "GST billing and invoicing software for Indian businesses, with connected returns, reconciliation and compliance workflows in InfoBridgeIndia.",
    "software"
  ),
  "/gst/gstr-1.html": page(
    "GSTR-1 Filing Guide & Tools | InfoBridgeIndia",
    "Prepare, review and validate GSTR-1 outward-supply data with tools for invoices, credit notes, HSN summaries and filing readiness.",
    "software"
  ),
  "/gst/gstr-3b.html": page(
    "GSTR-3B Filing Guide & Tools | InfoBridgeIndia",
    "Review GSTR-3B tax liability, eligible input tax credit and set-off calculations using connected GST workflow tools.",
    "software"
  ),
  "/products/finance-accounting.html": page(
    "Accounting Software India | Finance & Accounting | InfoBridgeIndia",
    "Business accounting software for Indian companies to manage books, receivables, payables, cash flow, assets, budgets and financial reports.",
    "software"
  ),
  "/hr.html": page(
    "HR Management Software India | InfoBridgeIndia",
    "HR management software for Indian businesses to manage employees, attendance, leave, recruitment and connected payroll operations.",
    "software"
  ),
  "/hr/payroll.html": page(
    "Payroll Software India | InfoBridgeIndia",
    "Payroll management software for Indian businesses covering salary calculations, attendance inputs, statutory deductions, approvals and payslips.",
    "software"
  ),
  "/products/projects-operations.html": page(
    "Project Management Software India | InfoBridgeIndia",
    "Manage business projects, milestones, tasks, timesheets, expenses and operational requests in one connected project workspace.",
    "software"
  ),
  "/products/sales-crm.html": page(
    "CRM & Sales Management Software India | InfoBridgeIndia",
    "CRM and sales management software for Indian businesses to manage leads, follow-ups, quotations, orders, invoices and collections.",
    "software"
  ),
  "/products/purchases-procurement.html": page(
    "Purchase & Procurement Software India | InfoBridgeIndia",
    "Manage purchase requests, approvals, vendor quotations, purchase orders, goods receipts, bills and supplier payments in one workflow.",
    "software"
  ),
  "/products/documents.html": page(
    "Document Management Software India | InfoBridgeIndia",
    "Business document management software for organizing files, controlling access, tracking versions and monitoring document expiry dates.",
    "software"
  ),
  "/products/reports-analytics.html": page(
    "Business Reports & Analytics Software | InfoBridgeIndia",
    "Connected business reporting and analytics for finance, GST, inventory, sales, HR, branches and management decision-making.",
    "software"
  ),
  "/products/import-export.html": page(
    "Import Export Business Software India | InfoBridgeIndia",
    "Manage overseas customers, suppliers, foreign-currency documents, landed costs and shipment tracking alongside core business operations.",
    "software"
  ),
  "/products/approvals-workflows.html": page(
    "Approval Workflow Software | InfoBridgeIndia",
    "Route material, IT, employee and expense requests through clear business approval workflows with status and decision tracking.",
    "software"
  ),
  "/products/administration.html": page(
    "Business Administration Software | InfoBridgeIndia",
    "Manage companies, branches, roles, permissions and governed employee access from a connected business administration workspace.",
    "software"
  ),
  "/products/banking.html": page(
    "Business Banking & Reconciliation Software | InfoBridgeIndia",
    "Manage business bank accounts, cash movement, receipts, payments, statement imports and bank reconciliation with connected finance records.",
    "software"
  ),
  "/gst-calculator.html": page(
    "GST Calculator India | Calculate GST Online | InfoBridgeIndia",
    "Calculate inclusive or exclusive GST online and view taxable value, GST amount, CGST, SGST and IGST instantly.",
    "webapp"
  ),
  "/gst-interest-calculator.html": page(
    "GST Interest Calculator India | InfoBridgeIndia",
    "Calculate interest on delayed GST tax payments using the tax amount, applicable rate and period of delay.",
    "webapp"
  ),
  "/gst-invoice-generator.html": page(
    "GST Invoice Generator India | InfoBridgeIndia",
    "Create a GST invoice with customer details, line items, automatic CGST, SGST or IGST calculations, preview and PDF printing.",
    "webapp"
  ),
  "/gst-late-fee-calculator.html": page(
    "GST Late Fee Calculator | InfoBridgeIndia",
    "Calculate estimated late fees for delayed GSTR-1 and GSTR-3B filing based on return type, turnover, liability and delay period.",
    "webapp"
  ),
  "/quotation-generator.html": page(
    "Quotation Generator & Quotation Software | InfoBridgeIndia",
    "Create professional business quotations with customer details, line items, taxes, totals, live preview and printable PDF output.",
    "webapp"
  ),
  "/marketplace-profit-calculator.html": page(
    "Marketplace Profit Calculator for Sellers | InfoBridgeIndia",
    "Estimate seller profit, marketplace fees, shipping charges, taxes and margins for Amazon, Flipkart and Meesho orders.",
    "webapp"
  ),
  "/shipping-label-4in1.html": page(
    "4-in-1 Shipping Label Generator | InfoBridgeIndia",
    "Arrange up to four marketplace shipping labels on each A4 page for efficient printing, processed entirely in your browser.",
    "webapp"
  ),
  "/jpg-to-pdf.html": page(
    "JPG to PDF Converter | InfoBridgeIndia",
    "Convert JPG, JPEG and PNG images into one PDF in your browser, with page size, orientation and image-fit controls.",
    "webapp"
  ),
  "/pdf-to-word.html": page(
    "PDF to Word Converter | InfoBridgeIndia",
    "Convert a PDF into an editable Word document in your browser without uploading the source file to a server.",
    "webapp"
  ),
  "/word-to-pdf.html": page(
    "Word to PDF Converter | InfoBridgeIndia",
    "Convert Word documents to printable PDF files in your browser while preserving text, tables, images and document formatting.",
    "webapp"
  ),
  "/merge-pdf.html": page(
    "Merge PDF Files Online | InfoBridgeIndia",
    "Combine multiple PDF files into one document in your preferred order, securely in your browser without server uploads.",
    "webapp"
  ),
  "/split-pdf.html": page(
    "Split PDF Files Online | InfoBridgeIndia",
    "Extract selected PDF pages or split a PDF into separate documents securely in your browser without uploading the file.",
    "webapp"
  ),
  "/pricing.html": page(
    "InfoBridgeIndia Pricing | Plans and Availability",
    "Review current free InfoBridgeIndia tools and the planned Plus and Pro business software plans, features and availability.",
  ),
  "/resources.html": page(
    "Business Resources & Compliance Guides | InfoBridgeIndia",
    "Explore InfoBridgeIndia setup guidance, GST and payroll resources, compliance dates, security information and support options.",
  ),
  "/security.html": page(
    "Data Security & Privacy | InfoBridgeIndia",
    "Learn how InfoBridgeIndia handles browser-based file processing, account security, business data protection and privacy considerations.",
  ),
});

function canonicalUrl(route) {
  return route === "/index.html" ? `${DOMAIN}/` : `${DOMAIN}${route}`;
}

function structuredData(route, seo) {
  if (!seo.schema) return null;
  const url = canonicalUrl(route);
  const application = {
    "@type": seo.schema === "webapp" ? "WebApplication" : "SoftwareApplication",
    name: seo.title.split(" |")[0],
    url,
    description: seo.description,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web browser",
  };
  if (seo.schema !== "homepage") return { "@context": "https://schema.org", ...application };
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${DOMAIN}/#organization`, name: "InfoBridgeIndia", url: `${DOMAIN}/`, logo: `${DOMAIN}/logo/infobridgeindia-brand-logo.png` },
      { ...application, "@id": `${DOMAIN}/#software`, publisher: { "@id": `${DOMAIN}/#organization` } },
    ],
  };
}

export function seoForRoute(route) {
  const seo = SEO_PAGES[route];
  if (!seo) return null;
  return { ...seo, canonical: canonicalUrl(route), structuredData: structuredData(route, seo) };
}

export function renderSeoTags(seo) {
  if (!seo) return "";
  const jsonLd = seo.structuredData
    ? `\n  <script type="application/ld+json">${JSON.stringify(seo.structuredData).replace(/</g, "\\u003c")}</script>`
    : "";
  return `
  <link rel="canonical" href="${seo.canonical}" />
  <meta property="og:title" content="${seo.title}" />
  <meta property="og:description" content="${seo.description}" />
  <meta property="og:url" content="${seo.canonical}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${seo.title}" />
  <meta name="twitter:description" content="${seo.description}" />${jsonLd}`;
}
