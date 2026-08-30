import { breadcrumbs, renderHead, renderHeader, renderFooter, renderClientScript } from "../../components/layout.js";

const ROUTE = "/pdf-to-word.html";

export function pdfToWordPageHtml() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Business Tools", href: "/gst-calculator.html" }, { label: "PDF to Word", href: "#" }])}
      <div style="margin-top:18px; max-width:640px;">
        <span class="eyebrow">Business Tools</span>
        <h1 class="h-1">PDF to Word</h1>
        <p class="text-lead">Convert a PDF into an editable .docx file. Everything runs in your browser &mdash; your file is never uploaded or stored on our servers.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container" style="max-width:720px;">
      <div class="card" id="ptw-card">

        <div id="ptw-state-idle">
          <label class="ptw-dropzone" id="ptw-dropzone" for="ptw-file-input" tabindex="0">
            <div class="state-icon" style="margin:0 auto var(--sp-4);">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 20h16"/></svg>
            </div>
            <h4>Drag and drop a PDF here</h4>
            <p>or click to browse &middot; PDF files only, up to 30&nbsp;MB</p>
            <span class="btn btn-secondary btn-sm" style="margin-top:var(--sp-4); pointer-events:none;">Choose PDF file</span>
            <input type="file" id="ptw-file-input" accept="application/pdf,.pdf" style="display:none;" />
          </label>
        </div>

        <div id="ptw-state-selected" style="display:none;">
          <div class="ptw-file-row">
            <div class="ptw-file-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h7l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z"/><path d="M14 3.5V8h4"/><path d="M9 13h6M9 16.5h6"/></svg>
            </div>
            <div class="ptw-file-meta">
              <strong id="ptw-file-name"></strong>
              <span id="ptw-file-size"></span>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" id="ptw-file-remove">Remove</button>
          </div>
          <div class="row-gap-3" style="margin-top:var(--sp-5);">
            <button type="button" class="btn btn-accent" id="ptw-convert-btn">Convert to Word</button>
          </div>
        </div>

        <div id="ptw-state-converting" style="display:none;" class="state-block">
          <div class="ptw-spinner"></div>
          <h4 id="ptw-progress-text">Reading your PDF&hellip;</h4>
          <p>This can take a moment for longer documents.</p>
          <div class="ptw-progress-track" style="width:220px;"><div class="ptw-progress-fill"></div></div>
        </div>

        <div id="ptw-state-success" style="display:none;">
          <div class="banner banner-success">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.6 2.6L16.5 9"/></svg>
            <div><strong>Conversion complete</strong><span id="ptw-success-meta"></span></div>
          </div>
          <div id="ptw-warning-banner" style="display:none; margin-top:var(--sp-3);"></div>
          <div class="row-gap-3" style="margin-top:var(--sp-5);">
            <button type="button" class="btn btn-accent" id="ptw-download-btn">Download Word File</button>
            <button type="button" class="btn btn-secondary" id="ptw-convert-another-btn">Convert another file</button>
          </div>
        </div>

        <div id="ptw-state-error" style="display:none;">
          <div class="banner banner-danger">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5"/><circle cx="12" cy="16" r="0.4" fill="currentColor"/></svg>
            <div><strong>Couldn&rsquo;t convert this file</strong><span id="ptw-error-message"></span></div>
          </div>
          <div class="row-gap-3" style="margin-top:var(--sp-5);">
            <button type="button" class="btn btn-secondary" id="ptw-error-retry-btn">Try again</button>
          </div>
        </div>

      </div>

      <div class="ptw-note">
        <p><strong>How it works:</strong> text, headings, bold/italic and page breaks are read directly from the PDF and rebuilt as a real, editable Word document &mdash; entirely in your browser. Scanned/image-only PDFs and complex multi-column or table layouts are not supported yet.</p>
      </div>
    </div>
  </section>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
${renderHead({ title: "PDF to Word", description: "Convert a PDF into an editable Word (.docx) file, entirely in your browser. No upload, no server storage." })}
<link rel="stylesheet" href="/pdf-to-word/styles.css" />
</head>
<body>
${renderHeader("solutions")}
${body}
${renderFooter()}
${renderClientScript()}
<script type="module" src="/pdf-to-word/app.js"></script>
</body>
</html>`;
}

export const pdfToWordRoute = ROUTE;
