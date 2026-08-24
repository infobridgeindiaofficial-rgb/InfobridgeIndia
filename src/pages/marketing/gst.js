import { icon } from "../../components/icons.js";
import { breadcrumbs } from "../../components/layout.js";
import { sectionHead, subserviceCard, flow, ctaBand, featureCard, banner } from "../../components/ui.js";

export function gstOverviewPage() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "GST & Compliance", href: "#" }])}
      <div class="service-hero-top" style="margin-top:18px;">
        <div>
          <span class="eyebrow">GST & Tax Compliance</span>
          <h1 class="h-1">Compliance built into the workflow, not bolted on after</h1>
          <p class="text-lead">Every GST service â€” returns, reconciliation, e-invoicing, e-way bills â€” has its own dedicated workspace that validates your data before filing, backed by a compliance calendar that never lets a due date slip.</p>
        </div>
        <div class="service-icon-badge">${icon("gst")}</div>
      </div>
      <div class="grid g-4" style="margin-top:40px;">
        <div class="stat-tile"><div class="text-micro">Next due</div><span class="figure" style="font-size:20px;">GSTR-1</span><span class="stat-delta up">Aug 2026 Â· 6 days left</span></div>
        <div class="stat-tile"><div class="text-micro">Return types supported</div><span class="figure" style="font-size:20px;">GSTR-1, 3B, 2B</span></div>
        <div class="stat-tile"><div class="text-micro">Rate heads</div><span class="figure" style="font-size:20px;">CGST Â· SGST Â· IGST</span></div>
        <div class="stat-tile"><div class="text-micro">Also covered</div><span class="figure" style="font-size:20px;">TDS Â· TCS</span></div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${sectionHead({ eyebrow: "GST services", title: "Every return and reconciliation, one dedicated workspace each" })}
      <div class="grid g-3">
        ${subserviceCard({ icon: "gst", title: "GSTR-1", desc: "Outward supplies â€” B2B, B2C, credit/debit notes, HSN summary.", href: "/gst/gstr-1.html", status: { tone: "warning", label: "Due in 6 days" } })}
        ${subserviceCard({ icon: "gst", title: "GSTR-3B", desc: "Summary return, tax liability and ITC set-off.", href: "/gst/gstr-3b.html", status: { tone: "neutral", label: "Not started" } })}
        ${subserviceCard({ icon: "checkCircle", title: "GSTR-2B Reconciliation", desc: "Match input tax credit against vendor-filed returns.", href: "/gst.html#reconciliation", status: { tone: "info", label: "12 mismatches" } })}
        ${subserviceCard({ icon: "reports", title: "HSN / SAC Summary", desc: "Rate-wise summary generated from actual invoices.", href: "/gst.html#hsn" })}
        ${subserviceCard({ icon: "file", title: "E-Invoice & IRN", desc: "IRN generation for eligible outward invoices.", href: "/gst.html#einvoice" })}
        ${subserviceCard({ icon: "truck", title: "E-Way Bill", desc: "Movement documents generated from sales & stock transfer.", href: "/gst.html#ewaybill" })}
        ${subserviceCard({ icon: "wallet", title: "Input Tax Credit", desc: "ITC availed, reversed and carried forward, tracked.", href: "/gst.html#itc" })}
        ${subserviceCard({ icon: "importexport", title: "Reverse Charge & E-commerce GST", desc: "RCM and marketplace GST handled where applicable.", href: "/gst.html#rcm" })}
        ${subserviceCard({ icon: "calendar", title: "Compliance Calendar", desc: "Every due date for every registration, tracked automatically.", href: "/gst.html#calendar" })}
      </div>
    </div>
  </section>

  <section class="section" style="background:var(--surface-0); border-top:1px solid var(--border); border-bottom:1px solid var(--border);" id="calendar">
    <div class="container">
      <div class="row-between" style="margin-bottom:24px; flex-wrap:wrap; gap:16px;">
        <div>
          <span class="eyebrow">Compliance calendar</span>
          <h2 class="h-3" style="margin-top:8px;">Nothing gets filed late</h2>
        </div>
        <a href="/signup.html" class="btn btn-secondary">Open full calendar</a>
      </div>
      ${banner({ tone: "warning", title: "GSTR-1 for August 2026 is due 11 Sep 2026.", body: " 312 B2B and 1,048 B2C invoices are ready for review." })}
      <div class="grid g-4" style="margin-top:20px;">
        ${featureCard({ icon: "calendar", title: "GSTR-1", desc: "Due 11th of every month â€” outward supplies." })}
        ${featureCard({ icon: "calendar", title: "GSTR-3B", desc: "Due 20th of every month â€” summary & payment." })}
        ${featureCard({ icon: "calendar", title: "TDS / TCS returns", desc: "Quarterly, tracked alongside GST due dates." })}
        ${featureCard({ icon: "calendar", title: "Annual return (GSTR-9)", desc: "Once your financial year closes." })}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${ctaBand({
        title: "Prepare your next GSTR-1 in minutes, not days",
        desc: "Open the dedicated GSTR-1 workspace and see exactly how invoices, validation and filing come together.",
        primary: { href: "/gst/gstr-1.html", label: "Open GSTR-1 workspace" },
        secondary: { href: "/index.html", label: "Back to main page" },
      })}
    </div>
  </section>
  `;

  return { route: "/gst.html", title: "GST & Compliance", description: "GST returns, reconciliation and e-invoicing built into the daily workflow.", active: "gst", body };
}

export function gstr1Page() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([
        { label: "Home", href: "/index.html" },
        { label: "GST & Compliance", href: "/gst.html" },
        { label: "GSTR-1", href: "#" },
      ])}
      <div class="service-hero-top" style="margin-top:18px;">
        <div>
          <span class="eyebrow">GST & Compliance / GSTR-1</span>
          <h1 class="h-1">The GSTR-1 workspace</h1>
          <p class="text-lead">Every outward-supply invoice for the period, validated against GST rules automatically â€” reviewed, corrected and exported without leaving InfoBridgeIndia.</p>
        </div>
        <div class="service-icon-badge">${icon("gst")}</div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${sectionHead({ eyebrow: "The workflow", title: "Prepare â†’ Validate â†’ Resolve â†’ Review â†’ File" })}
      ${flow([
        { title: "Import / enter", desc: "Invoices pulled from Sales automatically" },
        { title: "Validate", desc: "GSTIN, HSN and rate checks run instantly" },
        { title: "Resolve errors", desc: "Flagged rows fixed inline, nothing hidden" },
        { title: "Review", desc: "B2B, B2C, credit notes & HSN summary" },
        { title: "Generate output", desc: "JSON / summary ready for filing" },
      ])}
    </div>
  </section>

  <section class="section" style="background:var(--surface-0); border-top:1px solid var(--border); border-bottom:1px solid var(--border);">
    <div class="container">
      <div class="grid g-3">
        ${featureCard({ icon: "sales", title: "No double entry", desc: "Every tax invoice raised in Sales already appears here â€” nothing is re-typed for the return." })}
        ${featureCard({ icon: "checkCircle", title: "Validated as you go", desc: "GSTIN format, HSN codes and tax rates are checked the moment data lands, not at deadline." })}
        ${featureCard({ icon: "download", title: "Filing-ready output", desc: "A summary and export format ready to hand to your GSP or file directly." })}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${ctaBand({
        title: "See the live workspace with sample data",
        desc: "Log in to open the actual GSTR-1 preparation workspace â€” B2B, B2C, notes and validation, all in one place.",
        primary: { href: "/signup.html", label: "Open in the app" },
        secondary: { href: "/gst.html", label: "Back to GST & Compliance" },
      })}
    </div>
  </section>
  `;
  return { route: "/gst/gstr-1.html", title: "GSTR-1 â€” GST & Compliance", description: "The dedicated GSTR-1 preparation, validation and filing workspace.", active: "gst", body };
}

export function gstr3bPage() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([
        { label: "Home", href: "/index.html" },
        { label: "GST & Compliance", href: "/gst.html" },
        { label: "GSTR-3B", href: "#" },
      ])}
      <div class="service-hero-top" style="margin-top:18px;">
        <div>
          <span class="eyebrow">GST & Compliance / GSTR-3B</span>
          <h1 class="h-1">Summary return & tax liability, calculated automatically</h1>
          <p class="text-lead">Outward tax liability, eligible ITC and the net payable â€” pulled from GSTR-1 data and purchase records, not recalculated by hand.</p>
        </div>
        <div class="service-icon-badge">${icon("gst")}</div>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="container">
      ${sectionHead({ eyebrow: "What it covers", title: "Liability, ITC and net payment in one view" })}
      <div class="grid g-3">
        ${featureCard({ icon: "wallet", title: "Outward tax liability", desc: "Computed from validated GSTR-1 data for the period." })}
        ${featureCard({ icon: "checkCircle", title: "ITC set-off", desc: "Eligible input credit applied against liability automatically." })}
        ${featureCard({ icon: "bank", title: "Net payment", desc: "The exact amount payable, ready for challan generation." })}
      </div>
    </div>
  </section>
  <section class="section">
    <div class="container">
      ${ctaBand({
        title: "Open the GSTR-3B workspace",
        desc: "Log in to review this period's liability with live sample data.",
        primary: { href: "/signup.html", label: "Open in the app" },
        secondary: { href: "/gst.html", label: "Back to GST & Compliance" },
      })}
    </div>
  </section>
  `;
  return { route: "/gst/gstr-3b.html", title: "GSTR-3B â€” GST & Compliance", description: "Summary return, tax liability and ITC set-off workspace.", active: "gst", body };
}
