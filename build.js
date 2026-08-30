// InfoBridgeIndia static site builder â€” zero external dependencies.
// Reads component/page modules (plain JS render functions) and writes
// finished static HTML + copies styles/scripts/public assets into dist/.
import { mkdirSync, writeFileSync, cpSync, existsSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { marketingPage } from "./src/components/layout.js";

import { homePage } from "./src/pages/marketing/home.js";
import {
  salesCrmPage,
  purchasesPage,
  bankingPage,
  projectsOpsPage,
  documentsPage,
  approvalsPage,
  reportsPage,
  importExportPage,
  administrationPage,
} from "./src/pages/marketing/products.js";
import { financeAccountingPage, financeAccountingDetailPages } from "./src/pages/marketing/finance-accounting.js";
import { gstOverviewPage, gstr1Page, gstr3bPage } from "./src/pages/marketing/gst.js";
import { hrOverviewPage, payrollPage } from "./src/pages/marketing/hr.js";
import { solutionsPage } from "./src/pages/marketing/solutions.js";
import { pricingPage } from "./src/pages/marketing/pricing.js";
import { resourcesPage } from "./src/pages/marketing/resources.js";
import { securityPage } from "./src/pages/marketing/security.js";
import { privacyPage, termsPage } from "./src/pages/marketing/legal.js";
import { aboutPage } from "./src/pages/marketing/about.js";
import { companySetupPage, companyProfilePage, companySecurityPage } from "./src/pages/marketing/company.js";
import { loginPageHtml, resetPasswordPageHtml, signupPageHtml } from "./src/pages/marketing/login.js";
import { pdfToWordPageHtml } from "./src/pages/marketing/pdf-to-word.js";
import { gstCalculatorPageHtml } from "./src/pages/marketing/gst-calculator.js";
import { gstInterestCalculatorPageHtml } from "./src/pages/marketing/gst-interest-calculator.js";
import { gstLateFeeCalculatorPageHtml } from "./src/pages/marketing/gst-late-fee-calculator.js";
import { marketplaceProfitCalculatorPageHtml } from "./src/pages/marketing/marketplace-profit-calculator.js";
import { gstInvoiceGeneratorPageHtml } from "./src/pages/marketing/gst-invoice-generator.js";
import { shippingLabel4in1PageHtml } from "./src/pages/marketing/shipping-label-4in1.js";
import { quotationGeneratorPageHtml } from "./src/pages/marketing/quotation-generator.js";
import { wordToPdfPageHtml } from "./src/pages/marketing/word-to-pdf.js";
import { jpgToPdfPageHtml } from "./src/pages/marketing/jpg-to-pdf.js";
import { mergePdfPageHtml } from "./src/pages/marketing/merge-pdf.js";
import { splitPdfPageHtml } from "./src/pages/marketing/split-pdf.js";

import {
  financePage,
  bankingPage as appBankingPage,
  salesPage,
  purchasesPage as appPurchasesPage,
  inventoryPage as appInventoryPage,
  importExportPage as appImportExportPage,
  projectsPage,
  documentsPage as appDocumentsPage,
  reportsAppPage,
  adminPage,
  settingsPage,
} from "./src/pages/app/modules.js";
import { gstIndexPage, gstr1WorkspacePage } from "./src/pages/app/gst.js";
import { hrIndexPage, payrollWorkspacePage } from "./src/pages/app/hr.js";
import { inventoryWorkspacePage } from "./src/pages/app/inventory-workspace.js";
import { hrPayrollWorkspacePage } from "./src/pages/app/hr-payroll-workspace.js";
import { documentsWorkspacePage } from "./src/pages/app/documents-workspace.js";
import { gstWorkspacePage } from "./src/pages/app/gst-workspace.js";
import { approvalsWorkspacePage } from "./src/pages/app/approvals-workspace.js";
import { salesWorkspacePage } from "./src/pages/app/sales-workspace.js";
import { purchasesWorkspacePage } from "./src/pages/app/purchases-workspace.js";
import { bankingWorkspacePage } from "./src/pages/app/banking-workspace.js";
import { reportsWorkspacePage } from "./src/pages/app/reports-workspace.js";
import { administrationWorkspacePage } from "./src/pages/app/administration-workspace.js";
import { financeWorkspacePage } from "./src/pages/app/finance-workspace.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist");

if (existsSync(DIST)) rmSync(DIST, { recursive: true });
mkdirSync(DIST, { recursive: true });

function writeRoute(route, html) {
  const outPath = join(DIST, route);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, "utf8");
}

function withWorkspaceChrome(html) {
  return html.replace("</head>", '<link rel="stylesheet" href="/styles/workspace-sidebar.css"><script type="module" src="/scripts/workspace-sidebar.js"></script></head>');
}

// ---- Marketing pages (need layout wrapper) ----
const marketingPages = [
  homePage(),
  financeAccountingPage(),
  ...financeAccountingDetailPages(),
  salesCrmPage(),
  purchasesPage(),
  bankingPage(),
  projectsOpsPage(),
  documentsPage(),
  approvalsPage(),
  reportsPage(),
  importExportPage(),
  administrationPage(),
  gstOverviewPage(),
  gstr1Page(),
  gstr3bPage(),
  hrOverviewPage(),
  payrollPage(),
  solutionsPage(),
  pricingPage(),
  resourcesPage(),
  securityPage(),
  privacyPage(),
  termsPage(),
  aboutPage(),
  companySetupPage(),
  companyProfilePage(),
  companySecurityPage(),
];

let count = 0;
for (const page of marketingPages) {
  const html = marketingPage(page);
  writeRoute(page.route, html);
  count++;
}

// Retired standalone Products route: retain only a compatibility redirect.
writeRoute("/products.html", '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=/index.html"><link rel="canonical" href="/index.html"><title>Redirecting — InfoBridgeIndia</title><script>window.location.replace("/index.html");</script></head><body><p>Redirecting to <a href="/index.html">InfoBridgeIndia</a>…</p></body></html>');
count++;

// ---- Login (custom full-page layout) ----
writeRoute("/login.html", loginPageHtml());
count++;
writeRoute("/signup.html", signupPageHtml());
count++;
writeRoute("/reset-password.html", resetPasswordPageHtml());
count++;

// ---- Business Tools (custom full-page layout) ----
writeRoute("/pdf-to-word.html", pdfToWordPageHtml());
count++;
writeRoute("/gst-calculator.html", gstCalculatorPageHtml());
count++;
writeRoute("/gst-interest-calculator.html", gstInterestCalculatorPageHtml());
count++;
writeRoute("/gst-late-fee-calculator.html", gstLateFeeCalculatorPageHtml());
count++;
writeRoute("/marketplace-profit-calculator.html", marketplaceProfitCalculatorPageHtml());
count++;
writeRoute("/gst-invoice-generator.html", gstInvoiceGeneratorPageHtml());
count++;
writeRoute("/shipping-label-4in1.html", shippingLabel4in1PageHtml());
count++;
writeRoute("/quotation-generator.html", quotationGeneratorPageHtml());
count++;
writeRoute("/word-to-pdf.html", wordToPdfPageHtml());
count++;
writeRoute("/jpg-to-pdf.html", jpgToPdfPageHtml());
count++;
writeRoute("/merge-pdf.html", mergePdfPageHtml());
count++;
writeRoute("/split-pdf.html", splitPdfPageHtml());
count++;

// ---- Authenticated app pages (already full HTML documents) ----
const appPages = [
  ["/app/index.html", '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=/index.html"><link rel="canonical" href="/index.html"><title>Redirecting — InfoBridgeIndia</title><script>window.location.replace("/index.html");</script></head><body><p>Redirecting to <a href="/index.html">InfoBridgeIndia</a>…</p></body></html>'],
  ["/app/finance.html", financeWorkspacePage()],
  ["/app/banking.html", bankingWorkspacePage()],
  ["/app/sales.html", salesWorkspacePage()],
  ["/app/purchases.html", purchasesWorkspacePage()],
  ["/app/inventory.html", appInventoryPage()],
  ["/app/import-export.html", appImportExportPage()],
  ["/app/projects.html", projectsPage()],
  ["/app/documents.html", documentsWorkspacePage()],
  ["/app/approvals.html", approvalsWorkspacePage()],
  ["/app/reports.html", reportsWorkspacePage()],
  ["/app/admin.html", administrationWorkspacePage()],
  ["/app/settings.html", settingsPage()],
  ["/app/gst/index.html", gstWorkspacePage()],
  ["/app/gst/gstr-1.html", gstWorkspacePage()],
  ["/app/hr/index.html", hrIndexPage()],
  ["/app/hr/payroll.html", payrollWorkspacePage()],
];

for (const [route, html] of appPages) {
  writeRoute(route, route === "/app/index.html" ? html : withWorkspaceChrome(html));
  count++;
}

// ---- New standalone Inventory application (active Inventory destination) ----
writeRoute("/inventory/index.html", withWorkspaceChrome(inventoryWorkspacePage()));
count++;

// ---- Working HR & Payroll application (active HR destination) ----
writeRoute("/hr-payroll/index.html", withWorkspaceChrome(hrPayrollWorkspacePage().replace("<head>", '<head><script src="/vendor/supabase.js"></script><script src="/supabase-config.js"></script><script type="module" src="/scripts/auth-gate.js"></script>')));
count++;

// ---- Static assets ----
cpSync(join(__dirname, "src/styles"), join(DIST, "styles"), { recursive: true });
cpSync(join(__dirname, "src/scripts"), join(DIST, "scripts"), { recursive: true });
cpSync(join(__dirname, "src/auth"), join(DIST, "auth"), { recursive: true });
cpSync(join(__dirname, "src/supabase"), join(DIST, "supabase"), { recursive: true });
cpSync(join(__dirname, "src/country"), join(DIST, "country"), { recursive: true });
cpSync(join(__dirname, "src/export"), join(DIST, "export"), { recursive: true });
cpSync(join(__dirname, "src/company"), join(DIST, "company"), { recursive: true });
cpSync(join(__dirname, "src/security"), join(DIST, "security"), { recursive: true });
mkdirSync(join(DIST, "vendor"), { recursive: true });
cpSync(join(__dirname, "node_modules/@supabase/supabase-js/dist/umd/supabase.js"), join(DIST, "vendor/supabase.js"));
// Keep PDF.js local/offline, but publish it with .js extensions. Some static hosts
// (including older preview processes) serve unknown .mjs files as octet-stream,
// which browsers reject for dynamic module imports. The files remain ES modules.
cpSync(join(__dirname, "node_modules/pdfjs-dist/build/pdf.min.mjs"), join(DIST, "vendor/pdf.js"));
cpSync(join(__dirname, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"), join(DIST, "vendor/pdf.worker.min.js"));
// Retain canonical aliases for direct diagnostics and hosts that correctly map .mjs.
// Banking intentionally imports the .js aliases for broader static-server compatibility.
cpSync(join(__dirname, "node_modules/pdfjs-dist/build/pdf.min.mjs"), join(DIST, "vendor/pdf.mjs"));
cpSync(join(__dirname, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"), join(DIST, "vendor/pdf.worker.min.mjs"));
cpSync(join(__dirname, "src/inventory"), join(DIST, "inventory"), { recursive: true });
cpSync(join(__dirname, "src/hr-payroll"), join(DIST, "hr-payroll"), { recursive: true });
cpSync(join(__dirname, "src/gst"), join(DIST, "gst-workspace"), { recursive: true });
cpSync(join(__dirname, "src/approvals"), join(DIST, "approvals-workspace"), { recursive: true });
cpSync(join(__dirname, "src/sales"), join(DIST, "sales-workspace"), { recursive: true });
cpSync(join(__dirname, "src/purchases"), join(DIST, "purchases-workspace"), { recursive: true });
cpSync(join(__dirname, "src/banking"), join(DIST, "banking-workspace"), { recursive: true });
cpSync(join(__dirname, "src/analytics"), join(DIST, "reports-workspace"), { recursive: true });
cpSync(join(__dirname, "src/administration"), join(DIST, "administration-workspace"), { recursive: true });
cpSync(join(__dirname, "src/finance"), join(DIST, "finance-workspace"), { recursive: true });
cpSync(join(__dirname, "src/pdf-to-word"), join(DIST, "pdf-to-word"), { recursive: true });
cpSync(join(__dirname, "src/gst-calculator"), join(DIST, "gst-calculator"), { recursive: true });
cpSync(join(__dirname, "src/gst-interest-calculator"), join(DIST, "gst-interest-calculator"), { recursive: true });
cpSync(join(__dirname, "src/gst-late-fee-calculator"), join(DIST, "gst-late-fee-calculator"), { recursive: true });
cpSync(join(__dirname, "src/marketplace-profit-calculator"), join(DIST, "marketplace-profit-calculator"), { recursive: true });
cpSync(join(__dirname, "src/gst-invoice-generator"), join(DIST, "gst-invoice-generator"), { recursive: true });
cpSync(join(__dirname, "src/shipping-label-4in1"), join(DIST, "shipping-label-4in1"), { recursive: true });
cpSync(join(__dirname, "src/quotation-generator"), join(DIST, "quotation-generator"), { recursive: true });
cpSync(join(__dirname, "src/word-to-pdf"), join(DIST, "word-to-pdf"), { recursive: true });
cpSync(join(__dirname, "src/jpg-to-pdf"), join(DIST, "jpg-to-pdf"), { recursive: true });
cpSync(join(__dirname, "node_modules/jspdf/dist/jspdf.umd.min.js"), join(DIST, "vendor/jspdf.umd.min.js"));
cpSync(join(__dirname, "src/merge-pdf"), join(DIST, "merge-pdf"), { recursive: true });
cpSync(join(__dirname, "node_modules/pdf-lib/dist/pdf-lib.min.js"), join(DIST, "vendor/pdf-lib.min.js"));
cpSync(join(__dirname, "src/split-pdf"), join(DIST, "split-pdf"), { recursive: true });
if (existsSync(join(__dirname, "public"))) {
  cpSync(join(__dirname, "public"), DIST, { recursive: true });
}

console.log(`Built ${count} pages into ./dist`);
