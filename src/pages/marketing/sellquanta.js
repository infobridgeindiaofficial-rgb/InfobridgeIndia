import { icon } from "../../components/icons.js";
import { breadcrumbs } from "../../components/layout.js";
import { sectionHead, featureCard, ctaBand, banner, kvList } from "../../components/ui.js";
import { legalDocument, legalDocumentHead } from "../../components/legal-document.js";

// SellQuanta - open-source Windows desktop app published by InfoBridgeIndia.
// Source of truth: https://github.com/infobridgeindiaofficial-rgb/sellquanta
export const SELLQUANTA = Object.freeze({
  version: "1.0.2",
  repo: "https://github.com/infobridgeindiaofficial-rgb/sellquanta",
  // Public, no-login download of the installer built by the repository's GitHub Actions release workflow.
  // null = no public release published yet: the download page then shows the source link instead of a button.
  installerUrl: "https://github.com/infobridgeindiaofficial-rgb/sellquanta/releases/download/v1.0.2/SellQuanta-Setup-1.0.2.exe",
  installerSize: "about 110 MB",
  installerSha256: "56cc96e19cc5a7073f088dfd6b576a3982c7ceef50be87cbb5df0290c0b22870",
  releaseUrl: "https://github.com/infobridgeindiaofficial-rgb/sellquanta/releases/tag/v1.0.2",
});

const EXTRA_HEAD = '<link rel="stylesheet" href="/styles/sellquanta.css" />';
const LEGAL_HEAD = `${legalDocumentHead}${EXTRA_HEAD}`;
const small = (name) => icon(name, "").replace("<svg", '<svg width="16" height="16"');
const crumbBase = [{ label: "Home", href: "/index.html" }, { label: "SellQuanta", href: "/sellquanta.html" }];
const UNSIGNED_NOTE = "SellQuanta is currently unsigned. Windows SmartScreen may display an Unknown Publisher warning.";
const TRADEMARK_NOTE = "Amazon, Flipkart and Meesho are trademarks of their respective owners. SellQuanta is an independent open-source project and is not affiliated with, endorsed by or sponsored by them.";

function subNav(current) {
  const links = [
    ["/sellquanta.html", "Overview"],
    ["/sellquanta/download.html", "Download"],
    ["/sellquanta/privacy.html", "Privacy"],
    ["/sellquanta/code-signing.html", "Code Signing"],
  ];
  return `<nav class="sq-subnav" aria-label="SellQuanta">
    <div class="container sq-subnav-inner">
      <span class="sq-subnav-brand">SellQuanta</span>
      ${links.map(([href, label]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
      <a class="sq-subnav-gh" href="${SELLQUANTA.repo}" target="_blank" rel="noopener">GitHub ${small("arrowUpRight")}</a>
    </div>
  </nav>`;
}

function badges() {
  return `<div class="sq-badges">
    <span class="badge badge-brand">Open Source</span>
    <span class="badge badge-neutral">MIT License</span>
    <span class="badge badge-neutral">Windows 10 / 11 (64-bit)</span>
    <span class="badge badge-neutral">Local-first</span>
  </div>`;
}

export function sellquantaHomePage() {
  const features = [
    ["warehouse", "Warehouse & Inventory Management", "Products, warehouse product codes, cost price, opening stock, stock adjustments and low-stock levels."],
    ["package", "Product Master", "One place to map every marketplace SKU to the right warehouse product, per company."],
    ["link", "Amazon / Flipkart / Meesho mapping", "Map marketplace SKUs from Amazon, Flipkart and Meesho listings to your own warehouse products."],
    ["file", "Shipping-label PDF scanning", "Read order ID, SKU, quantity and amount from supported shipping-label and invoice PDFs. Results are shown for review before saving."],
    ["sales", "Daily Sales", "Record sales from scanned labels or manually, with checks for duplicate order IDs and suspicious quantities."],
    ["inventory", "Automatic stock deduction", "Saving a sale deducts stock from the mapped warehouse product; refunds return it."],
    ["trendingDown", "Refund Management", "Refund a sale within the refund window, return stock and adjust the agent wallet in one step."],
    ["wallet", "Agent Wallets", "Track what each agent owes for the sales recorded on their marketplace accounts."],
    ["creditCard", "Payments & Settlement History", "Record payments against agent wallets and keep a complete settlement history."],
    ["clock", "Wallet Reset", "Start a new wallet period from a clear baseline without deleting past records."],
    ["calendar", "Close Day / Month Close", "Export the day's sales to Excel and archive completed months as permanent snapshots."],
    ["download", "Excel import / export", "Import products and mappings from Excel templates and export warehouse and Product Master backups."],
    ["bolt", "Local Ollama AI-assisted label scanning", "Optionally use a vision model running in Ollama on your own computer for labels the text parser cannot read."],
    ["shield", "Local-first data storage", "Your records are kept in a local database with automatic daily backups on your PC."],
  ];
  const body = `
  ${subNav("/sellquanta.html")}
  <section class="service-hero sq-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "SellQuanta", href: "#" }])}
      <div class="service-hero-top" style="margin-top:18px;">
        <div>
          <span class="eyebrow">Desktop Software &middot; Windows</span>
          <h1 class="h-1">SellQuanta</h1>
          <p class="text-lead">Open-source desktop software for managing e-commerce orders, inventory, product mappings, refunds and agent wallets.</p>
          ${badges()}
          <div class="sq-actions">
            <a class="btn btn-accent btn-lg" href="/sellquanta/download.html">${small("download")} Download for Windows</a>
            <a class="btn btn-secondary btn-lg" href="${SELLQUANTA.repo}" target="_blank" rel="noopener">View Source on GitHub</a>
          </div>
        </div>
        <div class="service-icon-badge">${icon("ecommerce")}</div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container sq-intro">
      ${sectionHead({ eyebrow: "What it is", title: "A Windows desktop app for e-commerce sellers", desc: "SellQuanta is a Windows desktop application designed for e-commerce sellers who manage stock in their own warehouse and sell through online marketplaces. It brings orders, inventory, marketplace SKU mappings, refunds and agent wallets together in one place, and it runs entirely on your own computer." })}
    </div>
  </section>

  <section class="section sq-section-alt">
    <div class="container">
      ${sectionHead({ eyebrow: "Features", title: "What SellQuanta does" })}
      <div class="grid g-3 sq-features">
        ${features.map(([ic, title, desc]) => featureCard({ icon: ic, title, desc })).join("")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container grid g-2 sq-split">
      <div>
        <span class="eyebrow">Privacy by design</span>
        <h2 class="h-2">Your business data stays on your computer.</h2>
        <p class="text-lead">SellQuanta has no cloud account and no SellQuanta server. Products, sales, refunds, wallets, backups and exports are stored in a local data folder on your PC.</p>
      </div>
      <div class="stack-4">
        <div class="card sq-point"><strong>Local database &amp; backups</strong><p>All records are saved on your computer, with automatic daily backups and Month Close archives in the same local folder.</p></div>
        <div class="card sq-point"><strong>Optional local AI</strong><p>Ollama integration is optional and runs locally. SellQuanta talks only to the Ollama service you configure (by default on your own computer) and never downloads models on its own.</p></div>
        <div class="card sq-point"><strong>No telemetry</strong><p>The SellQuanta app does not include telemetry, usage-tracking or advertising components. Read the <a href="/sellquanta/privacy.html">SellQuanta Privacy Policy</a>.</p></div>
      </div>
    </div>
  </section>

  <section class="section sq-section-alt">
    <div class="container grid g-2 sq-split">
      <div>
        <span class="eyebrow">Open Source</span>
        <h2 class="h-2">Built in the open under the MIT License</h2>
        <p class="text-lead">The complete source code, build workflow and release history are public on GitHub. Anyone can review how SellQuanta works, build it themselves and contribute improvements.</p>
        <div class="sq-actions">
          <a class="btn btn-primary btn-lg" href="${SELLQUANTA.repo}" target="_blank" rel="noopener">View Source on GitHub</a>
          <a class="btn btn-secondary btn-lg" href="/sellquanta/code-signing.html">Code Signing Policy</a>
        </div>
      </div>
      <div class="card sq-facts">
        ${kvList([
          { k: "Latest version", v: SELLQUANTA.version },
          { k: "Platform", v: "Windows 10 / 11 (64-bit)" },
          { k: "License", v: "MIT" },
          { k: "Source code", v: `<a href="${SELLQUANTA.repo}" target="_blank" rel="noopener">GitHub</a>` },
          { k: "Publisher", v: "InfoBridgeIndia" },
        ])}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="sq-cta">${ctaBand({ title: "Get SellQuanta for Windows", desc: "Free and open source. Your data stays on your PC.", primary: { href: "/sellquanta/download.html", label: "Download for Windows" }, secondary: { href: SELLQUANTA.repo, label: "View Source on GitHub" } })}</div>
      <p class="sq-footnote">${TRADEMARK_NOTE}</p>
    </div>
  </section>`;
  return {
    route: "/sellquanta.html",
    title: "SellQuanta – E-commerce Order & Inventory Management for Windows | InfoBridge India",
    exactTitle: true,
    description: "SellQuanta is free, open-source Windows software for e-commerce sellers to manage orders, inventory, marketplace SKU mappings, refunds and agent wallets, with data stored locally.",
    active: "products",
    extraHead: EXTRA_HEAD,
    body,
  };
}

export function sellquantaDownloadPage() {
  const ready = Boolean(SELLQUANTA.installerUrl);
  const button = ready
    ? `<a class="btn btn-accent btn-lg sq-download-btn" href="${SELLQUANTA.installerUrl}" rel="noopener">${small("download")} Download for Windows</a>`
    : `<span class="btn btn-secondary btn-lg sq-download-btn" aria-disabled="true">Installer publication in progress</span>
       <p class="sq-muted">The first public installer is being published from the open-source repository. Until it is available you can build SellQuanta from the <a href="${SELLQUANTA.repo}" target="_blank" rel="noopener">source code on GitHub</a>.</p>`;
  const body = `
  ${subNav("/sellquanta/download.html")}
  <section class="service-hero sq-hero">
    <div class="container">
      ${breadcrumbs([...crumbBase, { label: "Download", href: "#" }])}
      <div style="margin-top:18px; max-width:720px;">
        <span class="eyebrow">Download</span>
        <h1 class="h-1">SellQuanta for Windows</h1>
        <p class="text-lead">Version ${SELLQUANTA.version} &middot; Windows 10/11 64-bit</p>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="container grid g-2 sq-split">
      <div class="card sq-download-card">
        <h2 class="h-4">SellQuanta ${SELLQUANTA.version}</h2>
        ${kvList([
          { k: "Version", v: SELLQUANTA.version },
          { k: "Operating system", v: "Windows 10/11 64-bit" },
          { k: "Download size", v: SELLQUANTA.installerSize },
          { k: "License", v: "MIT License" },
          { k: "Source code", v: `<a href="${SELLQUANTA.repo}" target="_blank" rel="noopener">View Source on GitHub</a>` },
        ])}
        <div class="sq-download-action">${button}</div>
        ${SELLQUANTA.installerSha256 ? `<p class="sq-muted">SHA-256: <code class="sq-hash">${SELLQUANTA.installerSha256}</code></p>` : ""}
        ${ready ? `<p class="sq-muted">File: SellQuanta-Setup-${SELLQUANTA.version}.exe &middot; <a href="${SELLQUANTA.releaseUrl}" target="_blank" rel="noopener">Release notes on GitHub</a></p>` : ""}
        ${banner({ tone: "warning", title: "Unsigned installer", body: `<p>${UNSIGNED_NOTE}</p>` })}
      </div>
      <div class="stack-4">
        <h2 class="h-4">Installing SellQuanta</h2>
        <ol class="sq-steps">
          <li>Download the installer and open it.</li>
          <li>If Windows SmartScreen shows <em>Windows protected your PC</em>, check that the file came from this page, then choose <em>More info</em> &rarr; <em>Run anyway</em>.</li>
          <li>Choose the installation folder and finish the setup. SellQuanta is installed for your Windows user account.</li>
          <li>Start SellQuanta from the desktop or Start menu shortcut.</li>
        </ol>
        <p class="sq-muted">Your business data is stored in <code>%APPDATA%\\SellQuanta Data</code> and is kept when you update or uninstall the app. Keep your own backups.</p>
        <p class="sq-muted">Optional: install <a href="https://ollama.com" target="_blank" rel="noopener">Ollama</a> separately if you want local AI-assisted label scanning. It is not required.</p>
        <p class="sq-muted">The installer is built from the public source code by the repository's GitHub Actions workflow. See the <a href="/sellquanta/code-signing.html">Code Signing Policy</a> and <a href="/sellquanta/privacy.html">Privacy Policy</a>.</p>
      </div>
    </div>
  </section>`;
  return {
    route: "/sellquanta/download.html",
    title: "Download SellQuanta for Windows | InfoBridge India",
    exactTitle: true,
    description: `Download SellQuanta ${SELLQUANTA.version}, the free open-source e-commerce order and inventory manager for Windows 10 and 11 (64-bit). MIT licensed.`,
    active: "products",
    extraHead: EXTRA_HEAD,
    body,
  };
}

function legalPage({ route, current, crumbLabel, title, seoTitle, description, introduction, updated, sections }) {
  const body = `${subNav(current)}
  <div class="container sq-legal-crumbs">${breadcrumbs([...crumbBase, { label: crumbLabel, href: "#" }])}</div>
  ${legalDocument({ title, introduction, sections, updated })}`;
  return { route, title: seoTitle, exactTitle: true, description, active: "products", extraHead: LEGAL_HEAD, body };
}

export function sellquantaPrivacyPage() {
  const sections = [
    ["Scope", "This policy covers the SellQuanta desktop application for Windows. Visits to the infobridgeindia.online website are covered separately by the <a href=\"/privacy.html\">InfoBridgeIndia Privacy Policy</a>."],
    ["Local-first by design", "SellQuanta runs on your own computer. There is no SellQuanta cloud account, no sign-in and no SellQuanta server. The application's user interface talks only to a local service that SellQuanta starts on your computer and that listens on 127.0.0.1 (your own machine) only."],
    ["Data SellQuanta stores", "SellQuanta stores the business information you enter or scan: companies, agents and marketplace accounts, warehouse products (including optional product images), Product Master mappings, sales, refunds, stock movements, payments and wallet history.", "In the installed app this data is kept in <code>%APPDATA%\\SellQuanta Data</code> on your computer. That folder also contains automatic daily backups, manual and Month Close backups, Excel exports, and a local scan-diagnostics log used to troubleshoot label scanning, which can include values read from your labels. The desktop app also writes technical log files to its local application folder on your computer."],
    ["Data SellQuanta does not collect", "The SellQuanta source code contains no telemetry, analytics, advertising, crash-reporting or tracking code. SellQuanta does not upload your business data, shipping labels or invoices to InfoBridgeIndia or to any other server, and InfoBridgeIndia cannot see your SellQuanta data."],
    ["Shipping labels and PDFs", "Shipping-label and invoice PDFs you select are read on your computer to extract order details. They are processed locally and are not uploaded by SellQuanta."],
    ["Optional Ollama AI integration", "AI-assisted label scanning is optional. When you use it, SellQuanta sends the label image to the Ollama service configured on your computer (by default <code>http://127.0.0.1:11434</code>, which is your own machine). Ollama is separate software that you install and control; SellQuanta does not download AI models. If you point SellQuanta to an Ollama service on another computer, label images are sent to that service."],
    ["Network activity", "SellQuanta itself only communicates with its own local service and, if you use it, your configured Ollama service. Links to websites you choose to open, such as the GitHub repository, open in your default web browser. SellQuanta does not include an automatic update check; you choose when to download a new version."],
    ["Files you save", "Excel exports, templates and backups you download are saved to your Windows Downloads folder or your data folder. What you do with those files, and who you share them with, is under your control."],
    ["Your responsibilities", "Because your data never leaves your computer, protecting it is up to you: keep your Windows account secure, keep regular copies of the data folder in a safe place, and delete exports you no longer need. Uninstalling SellQuanta does not delete your data folder; delete it yourself if you want to remove all data."],
    ["Children", "SellQuanta is business software intended for adults and is not directed at children."],
    ["Open source verification", "SellQuanta is open source under the MIT License. You can review exactly how data is handled in the <a href=\"https://github.com/infobridgeindiaofficial-rgb/sellquanta\" target=\"_blank\" rel=\"noopener\">public source code on GitHub</a>."],
    ["Changes and contact", "If SellQuanta's data handling changes, this page will be updated before the change is released. Questions can be sent through the <a href=\"/contact.html\">InfoBridgeIndia Contact page</a>; security issues should be reported privately as described in the repository's security policy."],
  ];
  return legalPage({
    route: "/sellquanta/privacy.html",
    current: "/sellquanta/privacy.html",
    crumbLabel: "Privacy",
    title: "SellQuanta Privacy Policy",
    seoTitle: "SellQuanta Privacy Policy | InfoBridge India",
    description: "How the SellQuanta Windows desktop app handles your data: local-first storage on your computer, no cloud account, no telemetry and optional local Ollama AI.",
    introduction: "SellQuanta is a local-first Windows desktop application. Your business data stays on your computer. This policy explains what the application stores, where it is stored and what it does not do.",
    updated: ["2026-09-24", "September 24, 2026"],
    sections,
  });
}

export function sellquantaCodeSigningPage() {
  const sections = [
    ["Current status", "SellQuanta Windows installers are currently <strong>not code-signed</strong>. SellQuanta has <strong>not</strong> yet been approved by, and is not currently signed through, SignPath or any other code-signing service. No code-signing certificate has been issued for SellQuanta.", `${UNSIGNED_NOTE}`],
    ["Planned signing", "InfoBridgeIndia intends to apply for free code signing for open-source projects, for example through the SignPath Foundation. If and when signing is approved, this page will be updated and the rules below will apply."],
    ["What will be signed", "Only binaries built by the public GitHub Actions workflow from the source code in the official repository, <a href=\"https://github.com/infobridgeindiaofficial-rgb/sellquanta\" target=\"_blank\" rel=\"noopener\">infobridgeindiaofficial-rgb/sellquanta</a>, will be signed.", "Signing will happen only for releases built from the <code>main</code> branch or from release tags. No locally built or modified binaries will be signed. Signing credentials will never be stored in the repository."],
    ["Roles", "Committers and reviewers: maintainers of the official GitHub repository.", "Approvers of release signing requests: the repository owner, InfoBridgeIndia.", "All maintainers are expected to use multi-factor authentication on their GitHub accounts."],
    ["Privacy", "SellQuanta does not transfer any information to networked systems unless specifically requested by the user or the person installing or operating it. It stores business data only on the local computer. The optional Ollama integration communicates only with the Ollama server URL configured by the user (by default the local machine, 127.0.0.1). See the <a href=\"/sellquanta/privacy.html\">SellQuanta Privacy Policy</a>."],
    ["Source of this policy", "This page reflects the <a href=\"https://github.com/infobridgeindiaofficial-rgb/sellquanta/blob/main/CODE_SIGNING_POLICY.md\" target=\"_blank\" rel=\"noopener\">CODE_SIGNING_POLICY.md</a> file in the official repository, which remains the source of truth."],
  ];
  return legalPage({
    route: "/sellquanta/code-signing.html",
    current: "/sellquanta/code-signing.html",
    crumbLabel: "Code Signing",
    title: "SellQuanta Code Signing Policy",
    seoTitle: "SellQuanta Code Signing Policy | InfoBridge India",
    description: "SellQuanta's code signing policy: current unsigned status, which official builds will be signed, release roles and privacy commitments.",
    introduction: "This policy explains the current signing status of SellQuanta for Windows and how official releases will be signed once code signing is approved.",
    updated: ["2026-09-24", "September 24, 2026"],
    sections,
  });
}

export function sellquantaPages() {
  return [sellquantaHomePage(), sellquantaDownloadPage(), sellquantaPrivacyPage(), sellquantaCodeSigningPage()];
}
