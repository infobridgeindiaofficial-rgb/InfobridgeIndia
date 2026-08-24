import { icon } from "../../components/icons.js";
import { breadcrumbs } from "../../components/layout.js";
import { sectionHead, banner } from "../../components/ui.js";

const plans = [
  {
    name: "Free",
    status: "Available now",
    statusTone: "success",
    price: "₹0",
    priceNote: "Free to use",
    description: "Essential tools for individuals and businesses getting started with InfoBridgeIndia.",
    featuresLabel: "Included tools",
    features: [
      "GST Calculator",
      "GST Interest Calculator",
      "GST Late Fee Calculator",
      "Marketplace Profit Calculator",
      "Quotation Generator",
      "GST Invoice Generator",
      "PDF and Word utilities",
      "Shipping Label 4-in-1",
    ],
    cta: "Explore Free Tools",
    href: "/solutions.html",
    available: true,
  },
  {
    name: "Plus",
    status: "Coming soon",
    statusTone: "neutral",
    price: "Coming soon",
    description: "Planned for small businesses that need connected day-to-day business management.",
    featuresLabel: "Planned features",
    features: [
      "Sales and customer management",
      "Purchases and supplier management",
      "Inventory and warehouse",
      "GST workspace",
      "Finance and accounting",
      "Business reports",
      "Cloud account and backup",
    ],
    cta: "Coming Soon",
    available: false,
  },
  {
    name: "Pro",
    status: "Coming soon",
    statusTone: "neutral",
    price: "Coming soon",
    description: "Planned for growing businesses that need team access and more advanced operational control.",
    featuresLabel: "Planned features",
    features: [
      "Everything planned for Plus",
      "Multiple users",
      "Roles and permissions",
      "Multiple branches",
      "HR and payroll",
      "Approvals and workflows",
      "Advanced reporting",
      "Priority support",
    ],
    cta: "Coming Soon",
    available: false,
  },
];

function planCard(plan) {
  const action = plan.available
    ? `<a href="${plan.href}" class="btn btn-primary btn-block" style="margin-top:20px;">${plan.cta}</a>`
    : `<button type="button" class="btn btn-secondary btn-block" style="margin-top:20px;" disabled>${plan.cta}</button>`;

  return `<article class="card" style="display:flex; flex-direction:column;${plan.available ? " border-color:var(--brand-500); box-shadow:var(--shadow-md);" : ""}">
    <span class="badge badge-${plan.statusTone}" style="align-self:flex-start;">${plan.status}</span>
    <h2 class="h-4" style="margin-top:var(--sp-4);">${plan.name}</h2>
    <div style="margin-top:var(--sp-4); display:flex; align-items:baseline; gap:var(--sp-2); flex-wrap:wrap;">
      <span class="h-3">${plan.price}</span>
      ${plan.priceNote ? `<span class="text-small">${plan.priceNote}</span>` : ""}
    </div>
    <p class="text-small" style="margin-top:var(--sp-4);">${plan.description}</p>
    <div class="text-micro" style="margin-top:var(--sp-6); font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--ink-500);">${plan.featuresLabel}</div>
    <ul class="cap-list" style="margin-top:var(--sp-3); flex:1;">
      ${plan.features.map((feature) => `<li>${icon("check")}${feature}</li>`).join("")}
    </ul>
    ${action}
  </article>`;
}

const faqs = [
  ["Is the Free plan available now?", "Yes. The listed free tools can currently be accessed without purchasing a paid plan."],
  ["Can I purchase Plus or Pro now?", "No. Plus and Pro are planned options and are not currently available for purchase."],
  ["When will paid pricing be announced?", "Pricing will be announced after the planned cloud accounts and paid-plan capabilities are ready."],
  ["Will I be charged automatically?", "No. No paid subscription will begin without clear pricing and the user’s explicit confirmation."],
];

export function pricingPage() {
  const body = `
  <section class="service-hero">
    <div class="container" style="text-align:center;">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Pricing", href: "#" }])}
      <div style="max-width:680px; margin:18px auto 0;">
        <span class="eyebrow">Pricing</span>
        <h1 class="h-1">Simple plans for every stage</h1>
        <p class="text-lead">Start with InfoBridgeIndia’s free tools today. Plus and Pro plans are being prepared for businesses that need more advanced workflows and team capabilities.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="grid g-3">
        ${plans.map(planCard).join("")}
      </div>
      <div style="margin-top:var(--sp-8);">
        ${banner({ tone: "info", title: "Paid plans are coming later", body: " Plus and Pro are planned options and are not currently available for purchase. Features, pricing and availability will be confirmed before launch. InfoBridgeIndia will display the final details clearly before any paid subscription begins." })}
      </div>
    </div>
  </section>

  <section class="section" style="background:var(--surface-0); border-top:1px solid var(--border); border-bottom:1px solid var(--border);">
    <div class="container">
      ${sectionHead({ eyebrow: "Common questions", title: "Pricing, in plain terms" })}
      <div class="grid g-2">
        ${faqs.map(([question, answer]) => `<article class="card"><h2 class="h-6">${question}</h2><p class="text-small" style="margin-top:var(--sp-2);">${answer}</p></article>`).join("")}
      </div>
    </div>
  </section>`;

  return {
    route: "/pricing.html",
    title: "Pricing",
    description: "Start with InfoBridgeIndia’s free business tools. Plus and Pro plans are planned for future release.",
    active: "pricing",
    body,
  };
}
