import { breadcrumbs, renderHead, renderHeader, renderFooter, renderClientScript } from "../../components/layout.js";

const ROUTE = "/shipping-label-4in1.html";

export function shippingLabel4in1PageHtml() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Business Tools", href: "/gst-calculator.html" }, { label: "Shipping Label 4-in-1 PDF", href: "#" }])}
      <div style="margin-top:18px; max-width:640px;">
        <span class="eyebrow">Business Tools</span>
        <h1 class="h-1">Shipping Label 4-in-1 PDF</h1>
        <p class="text-lead">Arrange up to 4 marketplace shipping labels on each A4 page for easy printing. Works with Meesho, Amazon, Flipkart and other marketplace label PDFs &mdash; processed entirely in your browser, never uploaded anywhere.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container" style="max-width:720px;">
      <div class="card" id="sl4-card">

        <div id="sl4-state-idle">
          <label class="sl4-dropzone" id="sl4-dropzone" for="sl4-file-input" tabindex="0">
            <div class="state-icon" style="margin:0 auto var(--sp-4);">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 20h16"/></svg>
            </div>
            <h4>Drag and drop shipping-label PDFs here</h4>
            <p>or click to browse &middot; multiple PDF files supported, up to 30&nbsp;MB each</p>
            <span class="btn btn-secondary btn-sm" style="margin-top:var(--sp-4); pointer-events:none;">Choose PDF Files</span>
            <input type="file" id="sl4-file-input" accept="application/pdf,.pdf" multiple style="display:none;" />
          </label>
        </div>

        <div id="sl4-state-files" style="display:none;">
          <div class="sl4-file-list" id="sl4-file-list"></div>

          <div class="sl4-summary">
            <div class="sl4-summary-item"><span>Files selected</span><strong id="sl4-summary-files">0</strong></div>
            <div class="sl4-summary-item"><span>Shipping slips</span><strong id="sl4-summary-slips">0</strong></div>
            <div class="sl4-summary-item"><span>Output A4 pages</span><strong id="sl4-summary-pages">0</strong></div>
          </div>

          <div class="row-gap-3" style="margin-top:var(--sp-5); flex-wrap:wrap;">
            <button type="button" class="btn btn-accent" id="sl4-generate-btn">Create 4-in-1 PDF</button>
            <label class="btn btn-secondary sl4-add-more" for="sl4-add-more-input">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M12 4v16M4 12h16"/></svg>
              Add more files
            </label>
            <input type="file" id="sl4-add-more-input" accept="application/pdf,.pdf" multiple style="display:none;" />
            <button type="button" class="btn btn-ghost" id="sl4-clear-btn">Clear / Start Over</button>
          </div>
        </div>

        <div id="sl4-state-converting" style="display:none;" class="state-block">
          <div class="sl4-spinner"></div>
          <h4 id="sl4-progress-text">Reading your PDFs&hellip;</h4>
          <p>This can take a moment for a large number of slips.</p>
          <div class="sl4-progress-track" style="width:220px;"><div class="sl4-progress-fill"></div></div>
        </div>

        <div id="sl4-state-success" style="display:none;">
          <div class="banner banner-success">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.6 2.6L16.5 9"/></svg>
            <div><strong>4-in-1 PDF ready</strong><span id="sl4-success-meta"></span></div>
          </div>
          <div class="row-gap-3" style="margin-top:var(--sp-5);">
            <button type="button" class="btn btn-accent" id="sl4-download-btn">Download PDF</button>
            <button type="button" class="btn btn-secondary" id="sl4-start-over-btn">Clear / Start Over</button>
          </div>
        </div>

        <div id="sl4-state-error" style="display:none;">
          <div class="banner banner-danger">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5"/><circle cx="12" cy="16" r="0.4" fill="currentColor"/></svg>
            <div><strong>Couldn&rsquo;t build this PDF</strong><span id="sl4-error-message"></span></div>
          </div>
          <div class="row-gap-3" style="margin-top:var(--sp-5);">
            <button type="button" class="btn btn-secondary" id="sl4-error-retry-btn">Try again</button>
          </div>
        </div>

      </div>

      <div class="sl4-note">
        <p><strong>How it works:</strong> every page of every PDF you add is treated as one shipping slip. Four slips are placed per A4 sheet (top-left, top-right, bottom-left, bottom-right), each scaled proportionally to fit without stretching, cropping, or losing any part of the label &mdash; barcode, QR code, addresses and the invoice section all stay intact and attached together, exactly as printed by the marketplace.</p>
        <p><strong>Privacy:</strong> your shipping labels are processed entirely on your device. Nothing is uploaded, stored, or sent anywhere.</p>
      </div>
    </div>
  </section>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
${renderHead({ title: "Shipping Label 4-in-1 PDF", description: "Arrange up to 4 marketplace shipping labels (Meesho, Amazon, Flipkart) on each A4 page for easy printing, entirely in your browser." })}
<link rel="stylesheet" href="/shipping-label-4in1/styles.css" />
</head>
<body>
${renderHeader("solutions")}
${body}
${renderFooter()}
${renderClientScript()}
<script type="module" src="/shipping-label-4in1/app.js"></script>
</body>
</html>`;
}

export const shippingLabel4in1Route = ROUTE;
