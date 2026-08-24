import { breadcrumbs, renderHead, renderHeader, renderFooter, renderClientScript } from "../../components/layout.js";

export function jpgToPdfPageHtml() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Business Tools", href: "/solutions.html" }, { label: "JPG to PDF", href: "#" }])}
      <div style="margin-top:18px; max-width:640px;">
        <span class="eyebrow">Business Tools</span>
        <h1 class="h-1">JPG to PDF</h1>
        <p class="text-lead">Combine JPG, JPEG and PNG images into one clean PDF. Everything runs in your browser &mdash; your images are never uploaded or stored on our servers.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container" style="max-width:900px;">
      <div class="card" id="jtp-card">
        <label class="jtp-dropzone" id="jtp-dropzone" for="jtp-file-input" tabindex="0">
          <div class="state-icon" style="margin:0 auto var(--sp-4);">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 20h16"/></svg>
          </div>
          <h4>Drag and drop images here</h4>
          <p>or click to browse</p>
          <span class="btn btn-secondary btn-sm" style="margin-top:var(--sp-4); pointer-events:none;">Choose Images</span>
          <span class="jtp-format-badge">Supported formats: JPG, JPEG, PNG</span>
          <input type="file" id="jtp-file-input" accept=".jpg,.jpeg,.png,image/jpeg,image/png" multiple style="display:none;" />
        </label>

        <div id="jtp-selection" style="display:none;">
          <div class="jtp-selection-head">
            <div><h4>Selected images</h4><p id="jtp-count"></p></div>
            <button type="button" class="btn btn-secondary btn-sm" id="jtp-add-btn">Add more images</button>
          </div>
          <div id="jtp-list" class="jtp-list" aria-live="polite"></div>
        </div>

        <div id="jtp-message" class="jtp-message" role="alert" aria-live="assertive"></div>
        <div class="row-gap-3 jtp-actions">
          <button type="button" class="btn btn-accent" id="jtp-convert-btn">Convert to PDF</button>
          <a class="btn btn-secondary" id="jtp-download-btn" download="jpg-to-pdf.pdf" style="display:none;">Download PDF</a>
        </div>
        <div id="jtp-processing" class="state-block jtp-processing" style="display:none;" aria-live="polite">
          <div class="jtp-spinner"></div><h4>Creating your PDF&hellip;</h4><p>Processing images securely in your browser.</p>
        </div>
      </div>
      <div class="jtp-note"><p><strong>Tip:</strong> Use the arrow buttons or drag image rows to set the PDF page order. Each image is placed on its own portrait or landscape page without cropping or distortion.</p></div>
    </div>
  </section>`;

  return `<!DOCTYPE html><html lang="en"><head>
${renderHead({ title: "JPG to PDF", description: "Combine JPG, JPEG and PNG images into one PDF securely in your browser." })}
<link rel="stylesheet" href="/jpg-to-pdf/styles.css" />
</head><body>${renderHeader("solutions")}${body}${renderFooter()}${renderClientScript()}
<script src="/vendor/jspdf.umd.min.js"></script><script type="module" src="/jpg-to-pdf/app.js"></script>
</body></html>`;
}
