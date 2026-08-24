import { icon } from "../../components/icons.js";
import { breadcrumbs } from "../../components/layout.js";
import { sectionHead, subserviceCard, flow, ctaBand, featureCard } from "../../components/ui.js";

// Generic, reusable "main service" page shell used by every product/solution
// overview page. Keeps every service page consistent (what it is, what's
// inside it, how the workflow runs, where to go deeper) without duplicating
// markup per module.
export function servicePage({
  route,
  navKey,
  icon: ic,
  eyebrow,
  title,
  lead,
  crumb,
  highlights = [],
  subservices = [],
  workflow = null,
  extraSections = "",
  cta = null,
}) {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs(crumb)}
      <div class="service-hero-top" style="margin-top:18px;">
        <div>
          <span class="eyebrow">${eyebrow}</span>
          <h1 class="h-1">${title}</h1>
          <p class="text-lead">${lead}</p>
        </div>
        <div class="service-icon-badge">${icon(ic)}</div>
      </div>
      ${
        highlights.length
          ? `<div class="grid g-4" style="margin-top:40px;">
          ${highlights.map((h) => `<div class="stat-tile"><div class="text-micro">${h.label}</div><span class="figure" style="font-size:20px;">${h.value}</span></div>`).join("")}
        </div>`
          : ""
      }
    </div>
  </section>

  ${
    subservices.length
      ? `<section class="section">
      <div class="container">
        ${sectionHead({ eyebrow: "Inside this service", title: "What you get", desc: "Each area below opens into its own dedicated workspace." })}
        <div class="grid g-3">
          ${subservices.map((s) => subserviceCard(s)).join("")}
        </div>
      </div>
    </section>`
      : ""
  }

  ${
    workflow
      ? `<section class="section" style="background:var(--surface-0); border-top:1px solid var(--border); border-bottom:1px solid var(--border);">
      <div class="container">
        ${sectionHead({ eyebrow: "How it flows", title: workflow.title, desc: workflow.desc })}
        ${flow(workflow.steps)}
      </div>
    </section>`
      : ""
  }

  ${extraSections}

  <section class="section">
    <div class="container">
      ${ctaBand(
        cta || {
          title: "Ready to see it inside the app?",
          desc: "Open the workspace and explore with sample data — no setup required.",
          secondary: { href: "/index.html", label: "Back to main page" },
        }
      )}
    </div>
  </section>
  `;

  return { route, title, description: lead, active: navKey, body };
}

export function moduleGrid(items) {
  return `<div class="grid g-4">${items.map((i) => featureCard(i)).join("")}</div>`;
}
