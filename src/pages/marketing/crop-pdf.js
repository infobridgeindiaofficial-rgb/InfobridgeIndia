import { breadcrumbs, renderHead, renderHeader, renderFooter, renderClientScript } from '../../components/layout.js';

export function cropPdfPageHtml() {
  const button=(id,text)=>`<button type="button" class="btn btn-secondary btn-sm" id="${id}">${text}</button>`;
  const region=(key,name)=>`<fieldset class="cp-region cp-${key}"><legend>Region ${key.toUpperCase()}</legend><label for="cp-name-${key}">Region name</label><input class="form-input" id="cp-name-${key}" value="${name}" maxlength="80" /><div class="cp-row">${button('cp-select-'+key,'Select '+key.toUpperCase())}${button('cp-clear-'+key,'Clear')}</div><p id="cp-size-${key}" class="cp-muted">No selection</p></fieldset>`;
  const body=`<main class="cp-main"><div class="container">
    ${breadcrumbs([{label:'Home',href:'/index.html'},{label:'Business Tools',href:'/resources.html#business-tools'},{label:'Crop PDF',href:'#'}])}
    <div class="cp-heading"><span class="eyebrow">Business Tools · PDF &amp; Documents</span><h1 class="h-2">Crop PDF</h1><p>Visually crop PDF pages and save selected areas as separate PDFs.</p></div>
    <label class="cp-drop" id="cp-drop" for="cp-file" tabindex="0"><strong>Upload PDF</strong><span>Choose a file or drag and drop it here · processed locally</span><input id="cp-file" type="file" accept=".pdf,application/pdf" /></label>
    <p id="cp-status" role="status" aria-live="polite"></p><p id="cp-error" role="alert" hidden></p>
    <section id="cp-workspace" hidden aria-label="PDF crop workspace">
      <div class="cp-file-row"><div><strong id="cp-filename"></strong><p id="cp-details" class="cp-muted"></p></div><div class="cp-row">${button('cp-replace','Replace PDF')}${button('cp-remove','Remove PDF')}</div></div>
      <div class="cp-layout"><div class="cp-preview-panel">
        <div class="cp-toolbar">${button('cp-prev','Previous')}<label>Page <input id="cp-page" type="number" min="1" value="1" /></label><span id="cp-page-count"></span>${button('cp-next','Next')}${button('cp-out','Zoom −')}<span id="cp-zoom"></span>${button('cp-in','Zoom +')}${button('cp-width','Fit to Width')}${button('cp-fit','Fit to Page')}${button('cp-reset','Reset View')}</div>
        <p class="cp-instruction">Drag on the PDF to select the area you want to keep. Drag a selection to move it; use its handles to resize.</p>
        <div id="cp-scroll" class="cp-scroll"><div id="cp-stage" class="cp-stage"><canvas id="cp-canvas" aria-label="Original PDF page"></canvas><div id="cp-overlay" aria-label="Crop selection surface"></div></div></div>
      </div><aside class="card cp-controls" aria-label="Crop controls">
        <label for="cp-mode">Crop regions</label><select class="form-input" id="cp-mode"><option value="single">Single region</option><option value="dual">Two regions</option></select>
        ${region('a','Shipping Label')}<div id="cp-region-b" hidden>${region('b','Tax Invoice')}</div>
        <label for="cp-scope">Apply crop to</label><select class="form-input" id="cp-scope"><option value="current">Current Page Only</option><option value="all">Apply to All Pages</option></select>
        <p id="cp-compatibility" class="cp-muted"></p>
        <div class="cp-exports">${button('cp-preview','Preview Selected Crop')}<button type="button" class="btn btn-accent" id="cp-export-a">Download Region A PDF</button><button type="button" class="btn btn-accent" id="cp-export-b" hidden>Download Region B PDF</button>${button('cp-export-both','Download Both PDFs')}</div>
        <div id="cp-downloads" aria-live="polite"></div>
        <p class="cp-muted">Cropping hides content outside the selected area. It is not redaction: hidden content may remain recoverable.</p>
      </aside></div>
    </section>
    <dialog id="cp-dialog"><div class="cp-row"><strong id="cp-preview-title">Crop preview</strong>${button('cp-close','Close')}</div><p id="cp-preview-info" class="cp-muted"></p><div class="cp-crop-preview"><canvas id="cp-result-canvas"></canvas></div></dialog>
  </div></main>`;
  return `<!DOCTYPE html><html lang="en"><head>${renderHead({title:'Crop PDF',description:'Visually crop PDF pages into separate PDFs locally in your browser. Preserve text, vectors and barcode quality.',route:'/crop-pdf.html'})}<link rel="stylesheet" href="/crop-pdf/styles.css" /></head><body>${renderHeader('solutions')}${body}${renderFooter()}${renderClientScript()}<script src="/vendor/pdf-lib.min.js"></script><script type="module" src="/crop-pdf/app.js"></script></body></html>`;
}
