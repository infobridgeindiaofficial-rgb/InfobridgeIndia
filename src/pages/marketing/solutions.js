import { icon } from "../../components/icons.js";
import { breadcrumbs } from "../../components/layout.js";
import { sectionHead, featureCard, ctaBand } from "../../components/ui.js";

function typeSection({ id, eyebrow, title, desc, points, reverse }) {
  return `<div class="cap-row${reverse ? " reverse" : ""}" id="${id}">
    <div class="cap-copy">
      <div class="eyebrow">${eyebrow}</div>
      <h3 class="h-3" style="margin-top:10px;">${title}</h3>
      <p class="text-body">${desc}</p>
      <ul class="cap-list">${points.map((p) => `<li>${icon("check")}${p}</li>`).join("")}</ul>
    </div>
    <div class="cap-visual" style="display:flex; align-items:center;">
      <div style="width:100%;">
        <div class="text-micro" style="margin-bottom:10px;">Where InfoBridgeIndia focuses first</div>
        ${points.map((p) => `<div class="mock-row"><span style="font-size:13.5px; color:var(--ink-700); font-weight:560;">${p}</span>${icon("checkCircle", "").replace("<svg", '<svg width="16" height="16" style="color:var(--brand-600)"')}</div>`).join("")}
      </div>
    </div>
  </div>`;
}

export function solutionsPage() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Solutions", href: "#" }])}
      <div style="margin-top:18px; max-width:680px;">
        <span class="eyebrow">Solutions</span>
        <h1 class="h-1">Whichever business you run, the platform prioritises accordingly</h1>
        <p class="text-lead">InfoBridgeIndia doesn't assume every business needs every module on day one. Setup understands your business type and scale, and surfaces what matters first â€” the rest stays one click away.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${typeSection({
        id: "retailer",
        eyebrow: "Local Retailer, Trader & Wholesaler",
        title: "Billing, GST and stock â€” without the complexity you don't need",
        desc: "Start with simple billing and inventory, switch on ledgers, GST returns and multi-warehouse tracking the moment you need them.",
        points: ["Fast, GST-compliant billing", "Stock across one or many counters", "GSTR-1 and GSTR-3B ready from day one"],
      })}
      ${typeSection({
        id: "service",
        eyebrow: "Service Business & Freelancers",
        title: "Time, retainers and invoicing â€” kept simple",
        desc: "Track billable time and project cost without carrying inventory or manufacturing complexity you'll never use.",
        points: ["Time and retainer-based invoicing", "Simple expense and client tracking", "Upgrade to full accounting anytime"],
        reverse: true,
      })}
      ${typeSection({
        id: "manufacturer",
        eyebrow: "Manufacturer",
        title: "Inventory that understands production, not just resale",
        desc: "Raw materials, work-in-progress and finished goods tracked with job and batch-level costing.",
        points: ["Batch tracking across production stages", "Job costing rolled into product profitability", "Purchase-to-production-to-sale visibility"],
      })}
      ${typeSection({
        id: "multibranch",
        eyebrow: "Multi-branch Company",
        title: "Shared books, branch-level accountability",
        desc: "Each branch operates day-to-day independently while finance sees one consolidated set of books.",
        points: ["Branch-wise P&L and stock", "Central approvals, local execution", "One customer and supplier ledger, group-wide"],
        reverse: true,
      })}
      ${typeSection({
        id: "enterprise",
        eyebrow: "Enterprise / MNC",
        title: "Multi-company governance without multiple systems",
        desc: "Account â†’ Company â†’ Branch â†’ Department â†’ Team â†’ Employee â€” one hierarchy that scales to a group of companies.",
        points: ["Separate GSTIN, books and bank accounts per company", "Group-level consolidated reporting for owners and CFOs", "Role-based access enforced across every entity"],
      })}
    </div>
  </section>

  <section class="section" style="background:var(--surface-0); border-top:1px solid var(--border); border-bottom:1px solid var(--border);">
    <div class="container">
      ${sectionHead({ eyebrow: "Importer & Exporter", title: "International trade, integrated â€” not bolted on", center: true })}
      <div class="grid g-3">
        ${featureCard({ icon: "globe", title: "Foreign currency invoicing", desc: "Export invoices in the customer's currency, with forex gain/loss handled automatically." })}
        ${featureCard({ icon: "truck", title: "Landed cost", desc: "Freight, insurance and customs rolled into true per-unit cost." })}
        ${featureCard({ icon: "file", title: "LUT & export GST", desc: "Export-specific GST workflows, including LUT-based supply." })}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${ctaBand({
        title: "Tell us about your business, we'll set up the rest",
        desc: "Onboarding takes minutes and prioritises the modules relevant to you.",
        secondary: { href: "/pricing.html", label: "View pricing" },
      })}
    </div>
  </section>
  `;
  return { route: "/solutions.html", title: "Solutions", description: "InfoBridgeIndia by business type and scale â€” retail, service, manufacturing, multi-branch and enterprise.", active: "solutions", body };
}
