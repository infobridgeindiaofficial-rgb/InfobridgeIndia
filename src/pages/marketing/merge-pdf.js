import { breadcrumbs, renderHead, renderHeader, renderFooter, renderClientScript } from "../../components/layout.js";

export function mergePdfPageHtml() {
  const body = `
  <section class="service-hero"><div class="container">
    ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Business Tools", href: "/gst-calculator.html" }, { label: "Merge PDF", href: "#" }])}
    <div style="margin-top:18px; max-width:640px;"><span class="eyebrow">Business Tools</span><h1 class="h-1">Merge PDF</h1>
      <p class="text-lead">Combine two or more PDF files into one document in the order you choose. Everything runs in your browser &mdash; your documents are never uploaded or stored on our servers.</p>
    </div>
  </div></section>

  <section class="section"><div class="container" style="max-width:900px;">
    <div class="card" id="mpdf-card">
      <label class="mpdf-dropzone" id="mpdf-dropzone" for="mpdf-file-input" tabindex="0">
        <div class="state-icon" style="margin:0 auto var(--sp-4);"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 20h16"/></svg></div>
        <h4>Drag and drop PDF files here</h4><p>or click to browse &middot; choose at least 2 files</p>
        <span class="btn btn-secondary btn-sm" style="margin-top:var(--sp-4); pointer-events:none;">Choose PDF Files</span>
        <span class="mpdf-format-badge">Supported format: PDF</span>
        <input type="file" id="mpdf-file-input" accept=".pdf,application/pdf" multiple style="display:none;" />
      </label>

      <div id="mpdf-selection" style="display:none;">
        <div class="mpdf-selection-head"><div><h4>Selected PDFs</h4><p id="mpdf-count"></p></div><button type="button" class="btn btn-secondary btn-sm" id="mpdf-add-btn">Add more PDFs</button></div>
        <div id="mpdf-list" class="mpdf-list" aria-live="polite"></div>
      </div>

      <div id="mpdf-message" class="mpdf-message" role="alert" aria-live="assertive"></div>
      <div class="row-gap-3 mpdf-actions"><button type="button" class="btn btn-accent" id="mpdf-merge-btn">Merge PDF</button><a class="btn btn-secondary" id="mpdf-download-btn" download="merged.pdf" style="display:none;">Download PDF</a></div>
      <div id="mpdf-processing" class="state-block mpdf-processing" style="display:none;" aria-live="polite"><div class="mpdf-spinner"></div><h4>Merging PDFs&hellip;</h4><p>Copying pages securely in your browser.</p></div>
    </div>
    <div class="mpdf-note"><p><strong>Tip:</strong> Use the arrow buttons or drag file rows to arrange them. Every page from the first file is added before every page from the next file.</p></div>
  </div></section>`;

  return `<!DOCTYPE html><html lang="en"><head>${renderHead({ title: "Merge PDF", description: "Combine multiple PDF files into one document securely in your browser.", route: "/merge-pdf.html" })}<link rel="stylesheet" href="/merge-pdf/styles.css" /></head>
<body>${renderHeader("solutions")}${body}${renderFooter()}${renderClientScript()}<script src="/vendor/pdf-lib.min.js"></script><script type="module" src="/merge-pdf/app.js"></script></body></html>`;
}
