import { breadcrumbs, renderHead, renderHeader, renderFooter, renderClientScript } from "../../components/layout.js";

export function wordToPdfPageHtml() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Business Tools", href: "/solutions.html" }, { label: "Word to PDF", href: "#" }])}
      <div style="margin-top:18px; max-width:640px;">
        <span class="eyebrow">Business Tools</span>
        <h1 class="h-1">Word to PDF</h1>
        <p class="text-lead">Convert Word documents into printable PDF files while preserving document formatting. Everything runs in your browser &mdash; your file is never uploaded or stored on our servers.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container" style="max-width:900px;">
      <div class="card" id="wtp-card">

        <div id="wtp-state-idle">
          <label class="wtp-dropzone" id="wtp-dropzone" for="wtp-file-input" tabindex="0">
            <div class="state-icon" style="margin:0 auto var(--sp-4);">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 20h16"/></svg>
            </div>
            <h4>Drag and drop a Word document here</h4>
            <p>or click to browse &middot; up to 30&nbsp;MB</p>
            <span class="btn btn-secondary btn-sm" style="margin-top:var(--sp-4); pointer-events:none;">Choose Word File</span>
            <span class="wtp-format-badge">Supported format: DOCX</span>
            <input type="file" id="wtp-file-input" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none;" />
          </label>
        </div>

        <div id="wtp-state-selected" style="display:none;">
          <div class="wtp-file-row">
            <div class="wtp-file-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h7l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z"/><path d="M14 3.5V8h4"/><path d="M9 12.5h6M9 16h6"/></svg>
            </div>
            <div class="wtp-file-meta">
              <strong id="wtp-file-name"></strong>
              <span id="wtp-file-size"></span>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" id="wtp-file-remove">Remove</button>
          </div>
          <div class="row-gap-3" style="margin-top:var(--sp-5);">
            <button type="button" class="btn btn-accent" id="wtp-convert-btn">Convert to PDF</button>
          </div>
        </div>

        <div id="wtp-state-converting" style="display:none;" class="state-block">
          <div class="wtp-spinner"></div>
          <h4>Converting document&hellip;</h4>
          <p>Reading formatting, tables and images from your Word file.</p>
          <div class="wtp-progress-track" style="width:220px;"><div class="wtp-progress-fill"></div></div>
        </div>

        <div id="wtp-state-success" style="display:none;">
          <div class="banner banner-success">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.6 2.6L16.5 9"/></svg>
            <div><strong>Conversion complete</strong><span id="wtp-success-meta"></span></div>
          </div>
          <div id="wtp-warning-banner" class="wtp-warning-banner" style="display:none;"></div>
          <div class="row-gap-3" style="margin-top:var(--sp-5);">
            <button type="button" class="btn btn-secondary" id="wtp-convert-another-btn">Convert another file</button>
          </div>
        </div>

        <div id="wtp-state-error" style="display:none;">
          <div class="banner banner-danger">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5"/><circle cx="12" cy="16" r="0.4" fill="currentColor"/></svg>
            <div><strong>Couldn&rsquo;t convert this file</strong><span id="wtp-error-message"></span></div>
          </div>
          <div class="row-gap-3" style="margin-top:var(--sp-5);">
            <button type="button" class="btn btn-secondary" id="wtp-error-retry-btn">Try again</button>
          </div>
        </div>

      </div>

      <div class="wtp-note" id="wtp-note">
        <p><strong>How it works:</strong> paragraphs, headings, bold/italic/underline, alignment, bullet and numbered lists, tables with borders, embedded images and manual page breaks are read directly from the .docx file and rebuilt as a real formatted document, entirely in your browser. The page is then sent to your browser's own Print dialog &mdash; choose <b>Save as PDF</b> as the destination.</p>
        <p><strong>Known limitation:</strong> a document footer is shown once at the end of the content rather than repeated on every printed page, because browsers don't allow web pages to control custom running footers in the print dialog. Very complex layouts (text boxes, floating images, footnotes, tracked changes) are not supported.</p>
      </div>

      <div class="wtp-preview-wrap" id="wtp-preview-wrap" style="display:none;">
        <div class="wtp-preview-top"><div><b>DOCUMENT PREVIEW</b><span>This is what will be printed</span></div></div>
        <div class="wtp-preview-scroll">
          <article id="wordPreview" class="wtp-sheet"></article>
        </div>
        <div class="wtp-preview-actions">
          <button type="button" class="btn btn-accent" id="wtp-download-btn">Download PDF</button>
        </div>
        <p id="wtpPdfStatus" class="wtp-pdf-status"></p>
      </div>
    </div>
  </section>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
${renderHead({ title: "Word to PDF", description: "Convert a Word (.docx) document into a printable PDF while preserving formatting, tables and images, entirely in your browser." })}
<link rel="stylesheet" href="/word-to-pdf/styles.css" />
</head>
<body>
${renderHeader("solutions")}
${body}
${renderFooter()}
${renderClientScript()}
<script type="module" src="/word-to-pdf/app.js"></script>
</body>
</html>`;
}
