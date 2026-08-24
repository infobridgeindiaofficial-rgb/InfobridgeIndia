import { icon } from "../../components/icons.js";
import { breadcrumbs } from "../../components/layout.js";

const CONTACT_LINK = '<a href="/pricing.html#contact" class="btn btn-secondary btn-sm" style="margin-top:10px; display:inline-flex;">Contact us</a>';

function legalList(items) {
  return `<ul style="display:flex; flex-direction:column; gap:8px;">${items
    .map(
      (item) => `<li style="display:flex; gap:9px; align-items:flex-start; font-size:15px; color:var(--ink-600); line-height:1.6;">
        ${icon("check", "").replace("<svg", '<svg width="14" height="14" style="flex:none; margin-top:5px; color:var(--brand-600);"')}
        <span>${item}</span>
      </li>`
    )
    .join("")}</ul>`;
}

function legalCard(iconName, number, title, content) {
  const body = Array.isArray(content)
    ? legalList(content)
    : `<p style="font-size:15px; color:var(--ink-600); line-height:1.6;">${content}</p>`;
  return `<div class="card" style="margin-top:var(--sp-5);">
    <div class="row-gap-3" style="align-items:center;">
      <span class="card-icon" style="margin:0; width:34px; height:34px; flex:none;">${icon(iconName, "").replace("<svg", '<svg width="17" height="17"')}</span>
      <h2 style="margin:0; font-size:21px; line-height:1.3;">${number}. ${title}</h2>
    </div>
    <div style="margin-top:12px;">${body}</div>
  </div>`;
}

function legalIntro(label, title, intro, current) {
  return `<section class="section" style="padding-bottom:0;">
    <div class="container" style="max-width:900px;">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: current, href: "#" }])}
      <div style="margin-top:16px; max-width:760px;">
        <span class="eyebrow">${label}</span>
        <h1 style="margin-top:8px; font-size:clamp(26px, 3vw, 38px); line-height:1.15;">${title}</h1>
        <p style="margin-top:10px; font-size:15px; color:var(--ink-600); line-height:1.6;">${intro}</p>
      </div>
    </div>
  </section>`;
}

function legalBody(cards) {
  return `<section class="section" style="padding-top:var(--sp-6);">
    <div class="container" style="max-width:900px;">${cards.join("")}</div>
  </section>`;
}

export function privacyPage() {
  const cards = [
    legalCard("documents", 1, "Information we collect", [
      "Account details such as name and email address.",
      "Company profile information entered by the user.",
      "Business records created inside enabled workspaces.",
      "Basic technical and authentication information required to operate the service.",
    ]),
    legalCard("settings", 2, "How information is used", [
      "To create and maintain user accounts.",
      "To provide access to connected business modules.",
      "To save company and workspace information.",
      "To improve reliability, security and user experience.",
    ]),
    legalCard("users", 3, "Authentication and cloud storage", [
      "Authentication and supported cloud data are managed through the platform’s configured service providers.",
      "Access is tied to the signed-in user.",
      "InfoBridgeIndia does not claim encryption, certifications or security controls that have not been verified.",
    ]),
    legalCard("link", 4, "Information sharing", [
      "InfoBridgeIndia does not sell personal information.",
      "Information may be processed by service providers required to operate authentication, hosting and storage.",
      "Information may be disclosed when legally required.",
    ]),
    legalCard("checkCircle", 5, "User choices", [
      "Users may update their account and company profile information.",
      "Users may export locally supported business data where the product provides that feature.",
      "Account or data deletion requests can be made through the available contact method.",
    ]),
    legalCard("clock", 6, "Data retention", "Information is retained only as needed to provide the service, meet legal requirements and resolve operational issues."),
    legalCard("alertCircle", 7, "Changes to this policy", "This policy may be updated when the platform or legal requirements change."),
    legalCard("info", 8, "Contact", `InfoBridgeIndia does not currently publish a verified privacy email address. Please use the available contact channel for privacy, account or data requests.${CONTACT_LINK}`),
  ];
  const body = `${legalIntro(
    "Privacy Policy",
    "How we handle your information",
    "This policy explains what information InfoBridgeIndia collects, why it is used, and how users can manage their information while using the platform.",
    "Privacy Policy"
  )}${legalBody(cards)}`;
  return { route: "/privacy.html", title: "Privacy Policy", description: "How InfoBridgeIndia collects, uses and manages information.", active: "", body };
}

export function termsPage() {
  const cards = [
    legalCard("users", 1, "Account responsibility", [
      "Users must provide accurate account information.",
      "Users are responsible for protecting their login access and activity performed through their account.",
    ]),
    legalCard("checkCircle", 2, "Acceptable use", [
      "The platform must not be used for illegal, fraudulent, harmful or unauthorised activity.",
      "Users must not attempt to interfere with, damage or gain unauthorised access to the service.",
    ]),
    legalCard("documents", 3, "Business data", [
      "Users are responsible for the accuracy of information entered into the platform.",
      "Users should review accounting, tax, payroll and compliance information before relying on or submitting it.",
    ]),
    legalCard("settings", 4, "Product availability", [
      "Features may be added, changed, improved or removed as the platform develops.",
      "InfoBridgeIndia does not promise uninterrupted or error-free availability.",
    ]),
    legalCard("wallet", 5, "Pricing and future paid plans", [
      "Currently available free features may be subject to limits.",
      "Paid plans, user limits and pricing may be introduced in the future.",
      "Users must be informed before charges are applied to their account.",
    ]),
    legalCard("link", 6, "Third-party services", "Authentication, hosting, storage or integrations may depend on third-party providers and their terms."),
    legalCard("shield", 7, "Intellectual property", [
      "InfoBridgeIndia branding, website design and original platform materials remain the property of their respective owner.",
      "Users retain responsibility for the business data they submit.",
    ]),
    legalCard("scale", 8, "Limitation and professional review", [
      "The platform assists with business workflows but does not replace professional accounting, tax, legal or compliance advice.",
      "Users remain responsible for reviewing important business submissions and decisions.",
    ]),
    legalCard("alertCircle", 9, "Suspension or termination", "Access may be restricted for misuse, security risks or violation of these terms."),
    legalCard("clock", 10, "Changes to these terms", "These terms may be updated as the platform and services develop."),
  ];
  const body = `${legalIntro(
    "Terms of Use",
    "Terms for using InfoBridgeIndia",
    "These terms explain the conditions for accessing and using InfoBridgeIndia’s website, business platform and related services.",
    "Terms of Use"
  )}${legalBody(cards)}`;
  return { route: "/terms.html", title: "Terms of Use", description: "Terms for accessing and using InfoBridgeIndia and its related services.", active: "", body };
}
