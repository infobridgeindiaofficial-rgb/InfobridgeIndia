import { icon } from "../../components/icons.js";
import { breadcrumbs } from "../../components/layout.js";
import { sectionHead, featureCard, banner, timeline } from "../../components/ui.js";

export function resourcesPage() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Resources", href: "#" }])}
      <div style="margin-top:18px; max-width:640px;">
        <span class="eyebrow">Resources</span>
        <h1 class="h-1">Guides, compliance dates and help â€” in one place</h1>
        <p class="text-lead">Everything you need to set up and run InfoBridgeIndia, plus how we keep your business data secure.</p>
      </div>
    </div>
  </section>

  <section class="section" id="guides">
    <div class="container">
      ${sectionHead({ eyebrow: "Guides & playbooks", title: "Set up the right way, the first time" })}
      <div class="grid g-3">
        ${featureCard({ icon: "building", title: "Getting started", desc: "Choose your business type and set up your first company." })}
        ${featureCard({ icon: "gst", title: "Your first GSTR-1", desc: "A walkthrough of preparing and filing your first return." })}
        ${featureCard({ icon: "hr", title: "Running your first payroll", desc: "Salary structures, statutory setup and your first payslip run." })}
      </div>
    </div>
  </section>

  <section class="section" style="background:var(--surface-0); border-top:1px solid var(--border); border-bottom:1px solid var(--border);" id="calendar">
    <div class="container">
      ${sectionHead({ eyebrow: "Compliance calendar", title: "What's due soon" })}
      ${banner({ tone: "warning", title: "GSTR-1 (Aug 2026)", body: " due 11 Sep 2026." })}
      <div style="margin-top:20px;">
        ${timeline([
          { title: "GSTR-3B (Jul 2026)", meta: "Filed on 19 Aug 2026" },
          { title: "TDS return â€” Q1 FY26-27", meta: "Filed on 31 Jul 2026" },
          { title: "GSTR-1 (Aug 2026)", meta: "Due 11 Sep 2026" },
          { title: "GSTR-3B (Aug 2026)", meta: "Due 20 Sep 2026" },
        ])}
      </div>
    </div>
  </section>

  <section class="section" id="security">
    <div class="container">
      ${sectionHead({ eyebrow: "Security", title: "How InfoBridgeIndia handles your data" })}
      <div class="card" style="max-width:640px;">
        <p class="text-small">Many of our document, label and GST-report tools process files directly in your browser instead of uploading them to a server. The Security page explains exactly what runs locally, what's stored, and what account-security features are (and aren't) built yet &mdash; described plainly, without generic promises.</p>
        <a href="/security.html" class="btn btn-secondary btn-sm" style="margin-top:14px; display:inline-flex;">Read the full Security page ${icon("arrowRight", "").replace("<svg", '<svg width="14" height="14"')}</a>
      </div>
    </div>
  </section>

  <section class="section" id="integrations">
    <div class="container">
      ${sectionHead({ eyebrow: "Integrations", title: "Built to connect, not to isolate" })}
      <div class="grid g-3">
        ${featureCard({ icon: "bank", title: "Banks", desc: "Bank statement import for faster reconciliation." })}
        ${featureCard({ icon: "ecommerce", title: "Marketplaces", desc: "Order, fee and settlement data from your sales channels." })}
        ${featureCard({ icon: "gst", title: "GSPs", desc: "GST Suvidha Provider connections for filing." })}
      </div>
    </div>
  </section>

  <section class="section" id="help">
    <div class="container">
      ${sectionHead({ eyebrow: "Help Center", title: "Support when you need it" })}
      <div class="grid g-3">
        ${featureCard({ icon: "info", title: "Documentation", desc: "Step-by-step guidance for every module." })}
        ${featureCard({ icon: "users", title: "Community", desc: "Learn from how other Indian businesses use InfoBridgeIndia." })}
        ${featureCard({ icon: "briefcase", title: "Priority support", desc: "Available on Business and Enterprise plans." })}
      </div>
    </div>
  </section>
  `;
  return { route: "/resources.html", title: "Resources", description: "Guides, compliance calendar and security information for InfoBridgeIndia.", active: "resources", body };
}
