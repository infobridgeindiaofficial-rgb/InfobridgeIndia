import { buildFourInOnePdf, getPageCount } from "./core.js";

const $ = (id) => document.getElementById(id);
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB
const PDF_MIME = "application/pdf";
const OUTPUT_FILENAME = "Shipping-Labels-4-in-1.pdf";

const states = {
  idle: $("sl4-state-idle"),
  files: $("sl4-state-files"),
  converting: $("sl4-state-converting"),
  success: $("sl4-state-success"),
  error: $("sl4-state-error"),
};

let outputMode = "combined";
let splitFiles = [];
let generatedPageCount = 0;
let generatedFiles = [];
let items = []; // { id, file, name, size, pageCount, error }
let resultBlobUrl = null;
let previewBlobUrl = null;
let previewPage = 1;
let previewPageCount = 0;
let previewRevision = 0;

function showState(name) {
  for (const [key, el] of Object.entries(states)) el.style.display = key === name ? "" : "none";
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isPdfFile(file) {
  if (!file) return false;
  if (file.type === PDF_MIME) return true;
  return /\.pdf$/i.test(file.name || "");
}

function revokeResultUrl() {
  for (const entry of splitFiles) URL.revokeObjectURL(entry.url);
  splitFiles = [];
  if (resultBlobUrl) {
    URL.revokeObjectURL(resultBlobUrl);
    resultBlobUrl = null;
  }
}

function revokePreviewUrl() {
  if (previewBlobUrl) {
    URL.revokeObjectURL(previewBlobUrl);
    previewBlobUrl = null;
  }
}

function showPreviewPage() {
  const frame = $("sl4-preview-frame");
  if (!previewBlobUrl || !previewPageCount) return;
  previewPage = Math.min(Math.max(previewPage, 1), previewPageCount);
  frame.src = `${previewBlobUrl}#page=${previewPage}&toolbar=0&navpanes=0&scrollbar=0&view=Fit`;
  frame.hidden = false;
  $("sl4-preview-status").hidden = true;
  $("sl4-preview-page").textContent = `Page ${previewPage} of ${previewPageCount}`;
  $("sl4-preview-prev").disabled = previewPage === 1;
  $("sl4-preview-next").disabled = previewPage === previewPageCount;
  $("sl4-preview-pagination").hidden = previewPageCount <= 1;
}

async function updatePreview() {
  const revision = ++previewRevision;
  const validItems = items.filter((item) => !item.error && item.pageCount != null && item.bytes);
  const reading = items.some((item) => !item.error && item.pageCount == null);
  const preview = $("sl4-live-preview");
  const frame = $("sl4-preview-frame");
  const status = $("sl4-preview-status");

  if (!validItems.length && !reading) {
    preview.hidden = true;
    frame.hidden = true;
    frame.removeAttribute("src");
    revokePreviewUrl();
    return;
  }

  preview.hidden = false;
  frame.hidden = true;
  status.hidden = false;
  status.textContent = reading ? "Reading your shipping labels…" : "Preparing A4 preview…";
  $("sl4-preview-pagination").hidden = true;
  if (reading) return;

  try {
    const result = await buildFourInOnePdf(validItems.map((item) => ({ name: item.name, bytes: item.bytes })));
    if (revision !== previewRevision) return;
    revokePreviewUrl();
    previewBlobUrl = URL.createObjectURL(new Blob([result.bytes], { type: PDF_MIME }));
    previewPageCount = result.pageCount;
    previewPage = Math.min(previewPage, previewPageCount) || 1;
    $("sl4-preview-count").textContent = `${result.slipCount} ${result.slipCount === 1 ? "label" : "labels"}`;
    showPreviewPage();
  } catch (err) {
    if (revision !== previewRevision) return;
    status.textContent = err && err.message ? err.message : "Preview unavailable.";
  }
}

function totals() {
  const validItems = items.filter((it) => !it.error && it.pageCount != null);
  const slipCount = validItems.reduce((n, it) => n + it.pageCount, 0);
  const pageCount = slipCount > 0 ? Math.ceil(slipCount / 4) : 0;
  return { fileCount: items.length, slipCount, pageCount, hasErrors: items.some((it) => it.error), isReading: items.some((it) => it.pageCount == null && !it.error) };
}

function fileRowHtml(item) {
  const errorClass = item.error ? " sl4-file-error" : "";
  const metaLine = item.error
    ? `<span class="sl4-file-err-text">${item.error}</span>`
    : item.pageCount == null
      ? `<span>${formatSize(item.size)} &middot; Reading…</span>`
      : `<span>${formatSize(item.size)} &middot; ${item.pageCount} shipping ${item.pageCount === 1 ? "slip" : "slips"}</span>`;
  const duplicateControls = item.duplicateOf && !item.duplicateResolved
    ? `<div class="sl4-duplicate-choice" style="margin-top:10px;padding:10px 12px;border:1px solid #e5ad49;border-radius:8px;background:#fff8e8">
         <strong>Duplicate PDF detected</strong>
         <div style="font-size:13px;margin:5px 0">Same PDF content as ${escapeHtml(item.duplicateOf)}. Keep both or remove this copy?</div>
         <button type="button" class="btn btn-secondary btn-sm sl4-keep-duplicate" data-id="${item.id}">Keep both</button>
         <button type="button" class="btn btn-ghost btn-sm sl4-drop-duplicate" data-id="${item.id}">Remove duplicate</button>
       </div>` : "";
  return `
    <div class="sl4-file-row${errorClass}" data-id="${item.id}">
      <div class="sl4-file-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h7l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z"/><path d="M14 3.5V8h4"/><path d="M9 12.5h6M9 16h6"/></svg>
      </div>
      <div class="sl4-file-meta">
        <strong>${escapeHtml(item.name)}</strong>
        ${metaLine}
        ${duplicateControls}
      </div>
      <button type="button" class="btn btn-ghost btn-sm sl4-remove-btn" data-id="${item.id}">Remove</button>
    </div>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render() {
  if (!items.length) {
    showState("idle");
    updatePreview();
    return;
  }
  showState("files");

  $("sl4-file-list").innerHTML = items.map(fileRowHtml).join("");
  for (const btn of $("sl4-file-list").querySelectorAll(".sl4-remove-btn")) {
    btn.addEventListener("click", () => removeItem(btn.dataset.id));
  }

  for (const btn of $("sl4-file-list").querySelectorAll(".sl4-keep-duplicate")) {
    btn.addEventListener("click", () => {
      const item = items.find(it => it.id === btn.dataset.id);
      if (item) { item.duplicateResolved = true; render(); }
    });
  }
  for (const btn of $("sl4-file-list").querySelectorAll(".sl4-drop-duplicate")) {
    btn.addEventListener("click", () => removeItem(btn.dataset.id));
  }
  const t = totals();
  $("sl4-summary-files").textContent = String(t.fileCount);
  $("sl4-summary-slips").textContent = t.isReading ? "…" : String(t.slipCount);
  $("sl4-summary-pages").textContent = t.isReading ? "…" : String(t.pageCount);

  const genBtn = $("sl4-generate-btn");
  $("sl4-summary-pages").textContent = outputMode === "split" ? String(t.slipCount) : $("sl4-summary-pages").textContent;
  genBtn.disabled = t.hasErrors || t.isReading || t.slipCount === 0 || items.some(it => it.duplicateOf && !it.duplicateResolved);
  genBtn.textContent = items.some(it => it.duplicateOf && !it.duplicateResolved) ? "Resolve duplicates to continue" : t.hasErrors ? "Remove the failed file to continue" : outputMode === "split" ? "Create Split PDFs" : "Create 4-in-1 PDF";
  updatePreview();
}

function removeItem(id) {
  items = items.filter((it) => it.id !== id);
  render();
}

function newId() {
  return `f${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function addFiles(fileList) {
  const incoming = Array.from(fileList || []);
  for (const file of incoming) {
    if (!isPdfFile(file)) continue; // silently skip non-PDF drops; dropzone label already scopes accept to PDFs
    const item = { id: newId(), file, name: file.name, size: file.size, pageCount: null, error: null, bytes: null };
    items.push(item);
    render();

    try {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`Over the ${formatSize(MAX_FILE_SIZE)} limit.`);
      }
      const buffer = await file.arrayBuffer();
      item.bytes = new Uint8Array(buffer);
      item.pageCount = await getPageCount(buffer);
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      item.hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      const duplicate = items.find(other => other.id !== item.id && other.hash === item.hash && !other.error);
      if (duplicate) {
        item.duplicateOf = duplicate.name;
        item.duplicateResolved = false;
      }
    } catch (err) {
      item.error = err && err.message ? err.message : "Could not read this PDF.";
    }
    render();
  }
}

function resetAll() {
  items = [];
  revokeResultUrl();
  revokePreviewUrl();
  generatedFiles = [];
  generatedPageCount = 0;
  $("sl4-download-options").hidden = true;
  $("sl4-file-input").value = "";
  render();
}

async function generate() {
  const t = totals();
  if (t.hasErrors || t.isReading || t.slipCount === 0 || items.some(it => it.duplicateOf && !it.duplicateResolved)) return;

  showState("converting");
  $("sl4-progress-text").textContent = "Reading your PDFs…";

  try {
    const files = [];
    for (const item of items) {
      files.push({ name: item.name, bytes: item.bytes });
    }

    if (outputMode === "split") {
      revokeResultUrl();
      for (const item of items) {
        const url = URL.createObjectURL(new Blob([item.bytes], { type: PDF_MIME }));
        splitFiles.push({ name: item.name, url });
      }
      $("sl4-success-meta").textContent = ` ${splitFiles.length} original PDF files ready for separate download.`;
      $("sl4-download-btn").textContent = "Download Separate PDFs";
      $("sl4-download-options").hidden = true;
      showState("success");
      return;
    }
    $("sl4-download-btn").textContent = "Download PDF";
    generatedFiles = files;
    const result = await buildFourInOnePdf(files, {
      onProgress: (current, total) => {
        $("sl4-progress-text").textContent = `Building A4 sheet ${current} of ${total}…`;
      },
    });

    revokeResultUrl();
    const blob = new Blob([result.bytes], { type: PDF_MIME });
    resultBlobUrl = URL.createObjectURL(blob);
    generatedPageCount = result.pageCount;
    const picker = $("sl4-download-page");
    picker.innerHTML = `<option value="all">All pages (${result.pageCount})</option>` + Array.from({length: result.pageCount}, (_, i) => `<option value="${i + 1}">Page ${i + 1} only</option>`).join("");
    $("sl4-download-options").hidden = false;

    $("sl4-success-meta").textContent = ` ${result.slipCount} shipping ${result.slipCount === 1 ? "slip" : "slips"} arranged onto ${result.pageCount} A4 ${result.pageCount === 1 ? "page" : "pages"}.`;

    showState("success");
  } catch (err) {
    $("sl4-error-message").textContent = " " + (err && err.message ? err.message : "Something went wrong while building this PDF.");
    showState("error");
  }
}

function wire() {
  const dropzone = $("sl4-dropzone");
  const fileInput = $("sl4-file-input");

  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) addFiles(fileInput.files);
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("sl4-dragover");
    })
  );
  ["dragleave", "dragend"].forEach((evt) =>
    dropzone.addEventListener(evt, () => dropzone.classList.remove("sl4-dragover"))
  );
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("sl4-dragover");
    if (e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  $("sl4-add-more-input").addEventListener("change", (e) => {
    if (e.target.files.length) addFiles(e.target.files);
    e.target.value = "";
  });

  $("sl4-output-mode").addEventListener("change", e => { outputMode = e.target.value; render(); });
  $("sl4-generate-btn").addEventListener("click", generate);
  $("sl4-clear-btn").addEventListener("click", resetAll);
  $("sl4-error-retry-btn").addEventListener("click", () => showState(items.length ? "files" : "idle"));
  $("sl4-start-over-btn").addEventListener("click", resetAll);
  $("sl4-preview-prev").addEventListener("click", () => { previewPage -= 1; showPreviewPage(); });
  $("sl4-preview-next").addEventListener("click", () => { previewPage += 1; showPreviewPage(); });

  $("sl4-download-btn").addEventListener("click", async () => {
    if (outputMode === "split") {
      for (const entry of splitFiles) {
        const a = document.createElement("a"); a.href = entry.url; a.download = entry.name;
        document.body.appendChild(a); a.click(); a.remove();
      }
      return;
    }
    if (!resultBlobUrl) return;
    const choice = $("sl4-download-page").value;
    const button = $("sl4-download-btn");
    let url = resultBlobUrl;
    let filename = OUTPUT_FILENAME;
    if (choice !== "all") {
      button.disabled = true;
      try {
        const selected = Number(choice);
        const result = await buildFourInOnePdf(generatedFiles, { selectedSheets: [selected] });
        url = URL.createObjectURL(new Blob([result.bytes], { type: PDF_MIME }));
        filename = `Shipping-Labels-4-in-1-Page-${selected}.pdf`;
      } catch (err) {
        alert(err?.message || "Could not create selected page.");
        button.disabled = false;
        return;
      }
      button.disabled = false;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (url !== resultBlobUrl) setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}

showState("idle");
wire();
