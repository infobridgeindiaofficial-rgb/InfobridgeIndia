import { breadcrumbs, renderHead, renderHeader, renderFooter, renderClientScript } from "../../components/layout.js";

export function splitPdfPageHtml() {
  const body = `
  <section class="service-hero"><div class="container">
    ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "Business Tools", href: "/solutions.html" }, { label: "Split PDF", href: "#" }])}
    <div style="margin-top:18px; max-width:640px;"><span class="eyebrow">Business Tools</span><h1 class="h-1">Split PDF</h1><p class="text-lead">Extract selected pages or split one PDF into separate documents. Everything runs in your browser &mdash; your document is never uploaded or stored on our servers.</p></div>
  </div></section>

  <section class="section"><div class="container" style="max-width:900px;">
    <div class="card" id="spdf-card">
      <label class="spdf-dropzone" id="spdf-dropzone" for="spdf-file-input" tabindex="0">
        <div class="state-icon" style="margin:0 auto var(--sp-4);"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 20h16"/></svg></div>
        <h4>Drag and drop a PDF file here</h4><p>or click to browse</p><span class="btn btn-secondary btn-sm" style="margin-top:var(--sp-4); pointer-events:none;">Choose PDF</span><span class="spdf-format-badge">Supported format: PDF</span>
        <input type="file" id="spdf-file-input" accept=".pdf,application/pdf" style="display:none;" />
      </label>

      <div id="spdf-selected" style="display:none;"><div class="spdf-file-row"><div class="spdf-file-icon"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h7l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z"/><path d="M14 3.5V8h4"/><path d="M9 13h6M9 16h4"/></svg></div><div class="spdf-file-meta"><strong id="spdf-file-name"></strong><span id="spdf-file-details"></span></div><button type="button" class="btn btn-ghost btn-sm" id="spdf-remove-btn">Remove</button></div>

        <fieldset class="spdf-methods"><legend>Choose how to split</legend>
          <label class="spdf-method active"><input type="radio" name="spdf-method" value="extract" checked /><span><strong>Extract pages</strong><small>Combine selected pages into one PDF</small></span></label>
          <label class="spdf-method"><input type="radio" name="spdf-method" value="every" /><span><strong>Split every page</strong><small>Create one PDF for each page</small></span></label>
          <label class="spdf-method"><input type="radio" name="spdf-method" value="ranges" /><span><strong>Split by range</strong><small>Create a separate PDF for each range</small></span></label>
        </fieldset>
        <div class="spdf-range-field" id="spdf-range-field"><label for="spdf-pages-input" id="spdf-pages-label">Pages to extract</label><input class="form-input" id="spdf-pages-input" type="text" placeholder="Example: 1-3,5,8-10" autocomplete="off" /><p id="spdf-pages-help">Enter page numbers or ranges in the order they should appear.</p></div>
      </div>

      <div id="spdf-message" class="spdf-message" role="alert" aria-live="assertive"></div>
      <div class="row-gap-3 spdf-actions"><button type="button" class="btn btn-accent" id="spdf-split-btn">Split PDF</button></div>
      <div id="spdf-processing" class="state-block spdf-processing" style="display:none;" aria-live="polite"><div class="spdf-spinner"></div><h4>Splitting PDF&hellip;</h4><p>Copying the requested pages securely in your browser.</p></div>
      <div id="spdf-downloads" class="spdf-downloads" style="display:none;"><div class="banner banner-success"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.6 2.6L16.5 9"/></svg><div><strong>Split complete</strong><span id="spdf-success-text"></span></div></div><div id="spdf-download-list" class="spdf-download-list"></div></div>
    </div>
    <div class="spdf-note"><p><strong>Examples:</strong> Extract <b>2-4,7</b> to create one PDF containing pages 2, 3, 4 and 7. Split by range with <b>1-3,4-7,8-10</b> to create three separate PDFs.</p></div>
  </div></section>`;

  return `<!DOCTYPE html><html lang="en"><head>${renderHead({ title: "Split PDF", description: "Extract pages or split a PDF into separate documents securely in your browser." })}<link rel="stylesheet" href="/split-pdf/styles.css" /></head><body>${renderHeader("solutions")}${body}${renderFooter()}${renderClientScript()}<script src="/vendor/pdf-lib.min.js"></script><script type="module" src="/split-pdf/app.js"></script></body></html>`;
}
