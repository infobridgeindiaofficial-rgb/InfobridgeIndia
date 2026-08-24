import { icon } from "../../components/icons.js";
import { breadcrumbs } from "../../components/layout.js";
import { sectionHead, featureCard, ctaBand } from "../../components/ui.js";

function principleCard(iconName, title, description) {
  return `<article class="card card-hover">
    <div class="card-icon">${icon(iconName)}</div>
    <h3 class="h-6">${title}</h3>
    <p class="text-small" style="margin-top:var(--sp-3);">${description}</p>
  </article>`;
}

const problemCards = [
  ["link", "Disconnected business tools"],
  ["workflow", "Repeated manual data entry"],
  ["documents", "Scattered spreadsheets and records"],
  ["gst", "Complicated GST workflows"],
  ["reports", "Limited visibility across operations"],
  ["clock", "Time spent switching between different systems"],
];

const platformAreas = [
  ["gst", "GST & Compliance", "GST preparation, validation and compliance workflows.", "/gst.html"],
  ["ledger", "Finance & Accounting", "Connected books, ledgers, controls and financial reporting.", "/products/finance-accounting.html"],
  ["sales", "Sales & Customer Management", "Leads, customers, quotations, orders, invoices and collections.", "/products/sales-crm.html"],
  ["purchase", "Purchases & Supplier Management", "Requests, suppliers, purchase orders, bills and payments.", "/products/purchases-procurement.html"],
  ["inventory", "Inventory & Warehouse", "Products, stock movement, warehouses and inventory reporting.", "/inventory/index.html"],
  ["bank", "Banking & Reconciliation", "Accounts, statement imports, payments and reconciliation.", "/products/banking.html"],
  ["hr", "HR & Payroll", "Employee records, attendance, leave, payroll and payslips.", "/hr.html"],
  ["approvals", "Projects & Approvals", "Project work, responsibilities and structured approval processes.", "/products/projects-operations.html"],
  ["reports", "Business Documents & Reports", "Organised records, document tracking and business reporting.", "/products/documents.html"],
  ["briefcase", "Quotation & Invoice Tools", "Create practical customer quotations and GST invoices.", "/quotation-generator.html"],
  ["ecommerce", "Marketplace & GST Calculators", "Understand marketplace costs, profit and GST amounts.", "/marketplace-profit-calculator.html"],
  ["documents", "PDF, Word & Shipping Label Utilities", "Convert documents and arrange marketplace shipping labels.", "/solutions.html"],
];

export function aboutPage() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "About Us", href: "#" }])}
      <div class="service-hero-top" style="margin-top:18px;">
        <div>
          <span class="eyebrow">About InfoBridgeIndia</span>
          <h1 class="h-1">Built to simplify business in India</h1>
          <p class="text-lead">InfoBridgeIndia is a practical business management platform designed to help Indian businesses manage everyday operations, accounting, GST compliance, people, inventory and documents from one connected place.</p>
          <div class="row-gap-3 wrap" style="margin-top:var(--sp-6);">
            <a class="btn btn-primary btn-lg" href="/index.html">Explore Products</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="grid g-12" style="align-items:start;">
        <div style="grid-column:span 5;">${sectionHead({ eyebrow: "Who we are", title: "Business technology made practical" })}</div>
        <div class="stack-4" style="grid-column:7 / span 6;">
          <p class="text-body">InfoBridgeIndia is a business technology platform being built for small and growing businesses across India. We bring essential business workflows and useful office tools together in a simple, organised and accessible platform.</p>
          <p class="text-body">Our focus is not to make business software more complicated. It is to make everyday work easier to understand, manage and complete.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section" style="background:var(--surface-0); border-top:1px solid var(--border); border-bottom:1px solid var(--border);">
    <div class="container">
      ${sectionHead({ eyebrow: "Why InfoBridgeIndia exists", title: "Why we are building InfoBridgeIndia", desc: "Businesses often manage sales in one place, expenses in another, inventory through spreadsheets, employee records manually and GST work through separate systems. This creates repeated work, scattered information and avoidable confusion." })}
      <p class="text-body" style="max-width:760px; margin-top:calc(var(--sp-6) * -1); margin-bottom:var(--sp-8);">InfoBridgeIndia is being built to bring these activities together and provide businesses with a clearer way to manage their work.</p>
      <div class="grid g-3">
        ${problemCards.map(([iconName, title]) => principleCard(iconName, title, "A connected platform helps keep related work clear, organised and easier to complete.")).join("")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${sectionHead({ eyebrow: "What InfoBridgeIndia does", title: "One platform for everyday business work", desc: "InfoBridgeIndia combines business management modules with practical tools that support everyday work—from preparing quotations and tracking stock to managing payroll, business records and GST-related workflows." })}
      <div class="grid g-3">
        ${platformAreas.map(([iconName, title, desc, href]) => featureCard({ icon: iconName, title, desc, href })).join("")}
      </div>
    </div>
  </section>

  <section class="section" style="background:var(--brand-50); border-top:1px solid var(--brand-100); border-bottom:1px solid var(--brand-100);">
    <div class="container">
      <div class="grid g-12" style="align-items:center;">
        <div style="grid-column:span 5;">${sectionHead({ eyebrow: "Who it is for", title: "Designed for people who run and support businesses" })}</div>
        <div style="grid-column:7 / span 6;">
          <p class="text-body">InfoBridgeIndia is designed for people who need practical business tools without unnecessary complexity—whether they run a small business, manage a growing team, sell through online marketplaces or support clients with accounting and compliance work.</p>
          <div class="chip-grid" style="margin-top:var(--sp-6);">
            ${["Small businesses", "Growing companies", "Traders and distributors", "Service providers", "Online marketplace sellers", "Accountants and finance teams", "Business owners and operations teams"].map((label) => `<span class="chip">${label}</span>`).join("")}
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="grid g-12" style="align-items:start;">
        <div style="grid-column:span 5;">${sectionHead({ eyebrow: "Our purpose", title: "Make essential business technology easier" })}</div>
        <div class="stack-4" style="grid-column:7 / span 6;">
          <p class="text-lead">Our purpose is to make essential business technology easier to access, understand and use.</p>
          <p class="text-body">We want businesses to spend less time moving between disconnected tools and more time focusing on their customers, teams and growth.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section" style="background:var(--surface-0); border-top:1px solid var(--border); border-bottom:1px solid var(--border);">
    <div class="container">
      ${sectionHead({ eyebrow: "Our principles", title: "How we approach the product" })}
      <div class="grid g-3">
        ${principleCard("checkCircle", "Simple", "Business tools should be clear and easy to use.")}
        ${principleCard("briefcase", "Practical", "Every feature should solve a genuine business need.")}
        ${principleCard("info", "Transparent", "We clearly explain what the platform currently does and how business data is handled.")}
        ${principleCard("gst", "India-focused", "The platform is designed around Indian business, accounting and GST workflows.")}
        ${principleCard("link", "Connected", "Business information should move smoothly between related workflows.")}
      </div>
    </div>
  </section>

  <section class="section-tight">
    <div class="container">
      ${ctaBand({ title: "A simpler way to manage your business", desc: "Explore InfoBridgeIndia’s business modules and practical tools designed for everyday business work.", secondary: { href: "/index.html", label: "Explore Products" } })}
    </div>
  </section>`;

  return {
    route: "/about.html",
    title: "About Us",
    description: "Learn how InfoBridgeIndia is being built to make everyday business management, accounting and GST workflows simpler for Indian businesses.",
    active: "resources",
    body,
  };
}
