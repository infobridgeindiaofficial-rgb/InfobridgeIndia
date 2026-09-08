import { breadcrumbs } from "../../components/layout.js";

// WhatsApp brand mark from Simple Icons (CC0); no external icon script required.
const whatsappIcon = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M20.52 3.48A11.87 11.87 0 0012.05 0C5.47 0 .11 5.35.1 11.93c0 2.1.55 4.16 1.6 5.98L0 24l6.24-1.64a11.9 11.9 0 005.8 1.48h.01C18.63 23.84 24 18.49 24 11.91c0-3.19-1.24-6.18-3.48-8.43zM12.05 21.82h-.01a9.9 9.9 0 01-5.04-1.38l-.36-.21-3.7.97.99-3.61-.24-.37a9.87 9.87 0 01-1.52-5.29c0-5.47 4.46-9.92 9.93-9.92a9.85 9.85 0 017.02 2.91 9.87 9.87 0 012.91 7.02c0 5.47-4.46 9.92-9.98 9.88zm5.44-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.09 4.49.71.31 1.27.49 1.71.62.72.23 1.37.19 1.88.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z"/></svg>`;

export function contactPage() {
  return {
    route: "/contact.html",
    title: "Contact InfoBridgeIndia",
    description: "Get help with InfoBridgeIndia and our business tools. Send a message through our contact form or contact us on WhatsApp.",
    active: "",
    extraHead: `<style>
      .contact-whatsapp { margin-top:48px; padding-top:32px; border-top:1px solid var(--border); }
      .contact-whatsapp h2 { margin:0 0 8px; font-size:22px; line-height:1.4; color:var(--ink-900); }
      .contact-whatsapp p { margin:0 0 20px; }
      .contact-whatsapp-button { display:inline-flex; align-items:center; justify-content:center; gap:12px; max-width:100%; padding:16px 24px; border-radius:12px; background:#128c4a; color:#fff; font-size:16px; font-weight:650; line-height:1.5; text-decoration:none; transition:background-color 150ms ease; }
      .contact-whatsapp-button svg { flex:none; }
      .contact-whatsapp-button:hover { background:#0d703b; color:#fff; }
      .contact-whatsapp-button:focus-visible { outline:3px solid #128c4a; outline-offset:4px; background:#0d703b; }
      @media (max-width:480px) { .contact-whatsapp { margin-top:36px; padding-top:28px; } .contact-whatsapp-button { padding:14px 18px; gap:10px; } }
    </style>`,
    extraScripts: '<script type="module" src="/scripts/contact.js"></script>',
    body: `<section class="section">
      <div class="container" style="max-width:760px;">
        ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Contact", href: "#" }])}
        <h1 class="h-3" style="margin-top:var(--sp-5);">Contact InfoBridgeIndia</h1>
        <p class="text-lead" style="margin-top:var(--sp-3);">Need help with InfoBridgeIndia or our business tools? Send us a message or contact us on WhatsApp.</p>
        <div class="card" style="margin-top:var(--sp-6);">
          <form id="contact-form" method="post" aria-label="Contact form">
            <div class="field"><label for="contact-name">Name</label><input class="input" id="contact-name" name="name" autocomplete="name" maxlength="120" required></div>
            <div class="field" style="margin-top:var(--sp-4);"><label for="contact-email">Email Address</label><input class="input" id="contact-email" name="email" type="email" autocomplete="email" maxlength="254" required></div>
            <div class="field" style="margin-top:var(--sp-4);"><label for="contact-message">Message</label><textarea class="input" id="contact-message" name="message" rows="6" maxlength="5000" required></textarea></div>
            <p class="text-small" style="margin-top:var(--sp-4);">Please do not include passwords or sensitive business records. See our <a href="/privacy.html">Privacy Policy</a>.</p>
            <button class="btn btn-primary" type="submit" style="margin-top:var(--sp-5);" disabled>Send Message</button>
            <p id="contact-status" class="text-small" role="status" aria-live="polite" aria-atomic="true" style="margin-top:var(--sp-4);"></p>
            <noscript><p class="text-small">Please enable JavaScript to send this form, or contact us on WhatsApp below.</p></noscript>
          </form>
        </div>
        <section class="contact-whatsapp" aria-labelledby="whatsapp-heading">
          <h2 id="whatsapp-heading">Prefer WhatsApp?</h2>
          <p class="text-small">For quick questions, you can message us directly on WhatsApp.</p>
          <a class="contact-whatsapp-button" href="https://wa.me/971521185821?text=Hello%20InfoBridgeIndia%2C%20I%20need%20help%20with%20InfoBridgeIndia." target="_blank" rel="noopener noreferrer">${whatsappIcon}<span>Message us on WhatsApp</span></a>
        </section>
      </div>
    </section>`,
  };
}
