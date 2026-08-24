import { icon } from "../../components/icons.js";
import { breadcrumbs } from "../../components/layout.js";

/* Compact section card: small icon + h6 heading + body. Kept deliberately
   plain (existing .card / .h-6 / .text-small tokens only) per the brief:
   no oversized hero typography, no illustrations, no fake badges. */
function secCard(iconName, title, bodyHtml) {
  return `<div class="card" style="margin-top:var(--sp-5);">
    <div class="row-gap-3" style="align-items:center;">
      <span class="card-icon" style="margin:0; width:34px; height:34px; flex:none;">${icon(iconName, "").replace("<svg", '<svg width="17" height="17"')}</span>
      <h2 class="h-6" style="margin:0;">${title}</h2>
    </div>
    <div style="margin-top:12px;">${bodyHtml}</div>
  </div>`;
}

function checkList(items) {
  return `<ul style="display:flex; flex-direction:column; gap:9px;">${items
    .map(
      (t) =>
        `<li style="display:flex; gap:9px; align-items:flex-start; font-size:var(--fs-14); color:var(--ink-600); line-height:var(--lh-normal);">${icon(
          "check",
          ""
        ).replace("<svg", '<svg width="14" height="14" style="flex:none; margin-top:3px; color:var(--brand-600);"')}<span>${t}</span></li>`
    )
    .join("")}</ul>`;
}

function p(text) {
  return `<p class="text-small">${text}</p>`;
}

export function securityPage() {
  const body = `
  <section class="section" style="padding-bottom:0;">
    <div class="container" style="max-width:760px;">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Resources", href: "/resources.html" }, { label: "Security", href: "#" }])}
      <div style="margin-top:16px; max-width:620px;">
        <span class="eyebrow">Security</span>
        <h1 class="h-3" style="margin-top:8px;">Protecting your business data</h1>
        <p class="text-small" style="margin-top:10px;">InfoBridgeIndia handles business, GST and document workflows. This page describes, specifically, how the product currently handles data &mdash; what runs locally in your browser, what is stored, and what has not been built yet &mdash; rather than making general promises.</p>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:var(--sp-6);">
    <div class="container" style="max-width:760px;">

      ${secCard(
        "folder",
        "1. Data protection",
        p("How data is handled depends on the specific module or tool.") +
          checkList([
            "Business setup details and workspace records are stored in the configured Supabase project and protected by authenticated-user and company ownership policies.",
            "Uploaded marketplace GST reports (Meesho / Flipkart Excel files) are read and calculated directly in your browser; the file itself is not uploaded anywhere.",
            "Browser-local storage is not encrypted at rest. It is only as private as the device, browser profile and operating-system account it lives in.",
          ])
      )}

      ${secCard(
        "documents",
        "2. File privacy",
        p("Verified by inspecting the source code: none of the tools below make any network request when converting or generating a file.") +
          checkList([
            "PDF to Word, Word to PDF, and Shipping Label 4-in-1 PDF read the selected file and produce the output entirely in your browser &mdash; the file is not uploaded to a server or a third-party conversion API.",
            "GST marketplace report processing (Meesho, Flipkart, Combined GSTR-1) parses the uploaded Excel file locally and produces the Excel/JSON output locally.",
            "Quotation Generator's optional logo image is read locally in your browser (never uploaded) and only becomes part of the PDF you generate via your browser's own print function.",
            "JPG to PDF, Merge PDF and Split PDF process files locally in the browser; documents are not sent to an external conversion service.",
          ])
      )}

      ${secCard(
        "users",
        "3. Account security",
        p("This is described accurately rather than aspirationally: sign-in is currently a visual prototype, not a working authentication system.") +
          checkList([
            "Log in and Create Account use Supabase Auth. Google authentication is available when the Google provider and approved redirect URLs are configured in Supabase.",
            "No password hashing, multi-factor authentication, session tokens, session expiry or account lockout are implemented, because there is no authentication backend yet.",
            "As a result, anyone with the URL can currently open the app workspace pages directly &mdash; there is no login wall or role-based access control in this version.",
          ])
      )}

      ${secCard(
        "gst",
        "4. GST &amp; business data",
        p("GSTIN, invoices, quotations, marketplace reports and GSTR data can include sensitive business and customer details.") +
          checkList([
            "GST Workspace setup and transaction records are scoped to the authenticated owner and company through Supabase Row Level Security.",
            "GST Invoice Generator and Quotation Generator hold what you type only in memory for the current page session &mdash; nothing is saved automatically, and it is cleared on refresh.",
            "Generated GST JSON and Excel workbooks are produced from data you supplied and are saved to your device via your browser's normal download &mdash; InfoBridgeIndia does not keep a separate copy.",
          ])
      )}

      ${secCard(
        "link",
        "5. Third-party services",
        p("Checked directly in the source and the built site: no CDN scripts, external fonts, analytics or tracking services, or third-party document-processing APIs are loaded anywhere.") +
          checkList([
            "Typography uses your system's built-in fonts &mdash; no font files are fetched from an external service.",
            "A small number of workflows (e.g. contacting a customer or supplier) include a click-to-open WhatsApp link; this only activates if you click it and does not run automatically in the background.",
            "Because the document and GST-report tools above process files locally, they do not depend on any third-party service to function.",
          ])
      )}

      ${secCard(
        "clock",
        "6. Data retention",
        p("Retention differs by where the data lives:") +
          checkList([
            "<strong>In-memory only:</strong> the document/PDF tools, Shipping Label 4-in-1, GST Invoice Generator, Quotation Generator and marketplace report uploads &mdash; cleared when you refresh or leave the page.",
            "<strong>Authenticated workspace storage:</strong> company and workspace records are stored in the configured Supabase project and retained until you delete them through the product or remove the account data.",
            "<strong>Downloads you generate</strong> (PDF, Excel, GST&nbsp;JSON) are saved to your device through your browser; what happens to that file afterward is under your control.",
          ])
      )}

      ${secCard(
        "checkCircle",
        "7. Security practices",
        p("Practices genuinely followed in this codebase, not a generic list:") +
          checkList([
            "Local processing for the document, label and GST-report tools listed above, instead of routing files through a server.",
            "The Supabase browser client is bundled with the product rather than loaded from a third-party CDN.",
            "Only the browser-safe Supabase project URL and publishable key are used in the built output; privileged service-role keys and provider secrets must remain in Supabase.",
            "User-entered text (customer names, notes, addresses, etc.) is escaped before being placed on the page in the areas we reviewed, to guard against common script-injection issues.",
            "File-type and file-size checks on document, logo and marketplace-report uploads.",
          ])
      )}

      ${secCard(
        "scale",
        "8. Privacy &amp; Indian data protection",
        p("InfoBridgeIndia is being built with India's data-protection framework in mind, including the Digital Personal Data Protection Act, 2023 and its associated Rules, alongside the Information Technology Act, 2000 and applicable CERT-In cyber-security directions.") +
          p("As a product still under active development, we have not completed formal compliance processes such as a Data Protection Officer appointment, a Consent Manager integration, a breach-notification procedure, or a data-protection impact assessment. We do not claim DPDP compliance, ISO/SOC certification, or any government/CERT-In endorsement, and businesses using InfoBridgeIndia remain responsible for their own obligations as data fiduciaries under applicable law.") +
          `<p class="text-micro" style="margin-top:8px;">This section is provided for transparency and is not legal advice. For authoritative guidance, consult the Ministry of Electronics &amp; Information Technology (MeitY) and your own legal counsel.</p>`
      )}

      ${secCard(
        "alertCircle",
        "9. Report a security issue",
        p("If you believe you have found a security issue in InfoBridgeIndia, please report it responsibly so it can be investigated.") +
          p("We do not yet have a dedicated security-disclosure inbox. Until one is set up, please use our contact channel below and mark your message as a security report.") +
          `<a href="/pricing.html#contact" class="btn btn-secondary btn-sm" style="margin-top:10px; display:inline-flex;">Contact us</a>`
      )}

    </div>
  </section>
  `;
  return { route: "/security.html", title: "Security", description: "How InfoBridgeIndia currently handles data protection, file privacy, account security and Indian data-protection considerations.", active: "resources", body };
}
