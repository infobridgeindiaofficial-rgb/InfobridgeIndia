import { buildFourInOnePdf, getPageCount } from "./core.js?v=20261021-page-downloads";
import { extractLabelIdentities, findDuplicateLabels } from "./duplicates.js?v=20261021-couriers";
import { courierCounts, compareCouriers, UNKNOWN_COURIER } from "./couriers.js";

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

let items = []; // { id, file, name, size, pageCount, error }
let resultBlobUrl = null;
let generatedFiles = null;
let generatedGroupByCourier = false;
const individualBlobUrls = new Map();
let previewBlobUrl = null;
let previewPage = 1;
let previewPageCount = 0;
let previewRevision = 0;
const duplicateDecisions = new Map();

function duplicateReview() {
  const labels = items.filter(item => !item.error && item.pageCount != null).flatMap(item =>
    item.identities.map((identity, pageIndex) => ({ ...identity, key: `${item.id}:${pageIndex}`, name: item.name, pageIndex })));
  const duplicates = findDuplicateLabels(labels).map(pair => ({ ...pair, key: `${pair.original.key}|${pair.duplicate.key}` }));
  const excluded = new Set(duplicates.filter(pair => duplicateDecisions.get(pair.key) === "remove").map(pair => pair.duplicate.key));
  return { labels, duplicates, excluded, pending: duplicates.filter(pair => !duplicateDecisions.has(pair.key)).length };
}

function selectedFiles() {
  const { excluded } = duplicateReview();
  return items.filter(item => !item.error && item.pageCount != null && item.bytes).map(item => ({
    name: item.name, bytes: item.bytes,
    couriers: item.identities.map(identity => identity.courier),
    pageIndices: Array.from({ length: item.pageCount }, (_, index) => index).filter(index => !excluded.has(`${item.id}:${index}`)),
  }));
}

function renderDuplicateReview() {
  const summary = $("sl4-duplicate-summary");
  const { labels, duplicates, excluded, pending } = duplicateReview();
  summary.hidden = !labels.length;
  summary.textContent = `${duplicates.length} ${duplicates.length === 1 ? "duplicate" : "duplicates"} found · ${pending} awaiting review${excluded.size ? ` · ${excluded.size} excluded` : ""}`;
  for (const button of $("sl4-file-list").querySelectorAll("[data-duplicate]")) {
    button.addEventListener("click", () => {
      duplicateDecisions.set(duplicates[Number(button.dataset.duplicate)].key, button.dataset.choice);
      render();
      const replacement = [...$("sl4-file-list").querySelectorAll("[data-duplicate]")].find(candidate => candidate.dataset.duplicate === button.dataset.duplicate && candidate.dataset.choice === button.dataset.choice);
      replacement?.focus();
    });
  }
}

function duplicateInfoHtml(pair, index) {
  const identity = pair.duplicate;
  return `<div class="sl4-duplicate-info">
    <span class="sl4-duplicate-badge" title="Original: ${escapeHtml(pair.original.name)} · Page ${pair.original.pageIndex + 1}">Duplicate${identity.pageIndex ? ` · Page ${identity.pageIndex + 1}` : ""}</span>
    <div class="sl4-duplicate-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-duplicate="${index}" data-choice="remove" aria-label="Remove duplicate page ${identity.pageIndex + 1}">Remove</button>
      <button type="button" class="btn btn-ghost btn-sm" data-duplicate="${index}" data-choice="keep" aria-label="Keep duplicate page ${identity.pageIndex + 1}">Keep</button>
    </div>
  </div>`;
}

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
  for (const url of individualBlobUrls.values()) URL.revokeObjectURL(url);
  individualBlobUrls.clear();
  generatedFiles = null;
  $("sl4-download-options").hidden = true;
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
    const result = await buildFourInOnePdf(selectedFiles(), { groupByCourier: $("sl4-sort-order").value === "courier" });
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
  const slipCount = validItems.reduce((n, it) => n + it.pageCount, 0) - duplicateReview().excluded.size;
  const pageCount = slipCount > 0 ? Math.ceil(slipCount / 4) : 0;
  const excluded = duplicateReview().excluded;
  const fileCount = items.filter(item => item.pageCount == null || Array.from({ length: item.pageCount }, (_, index) => index).some(index => !excluded.has(`${item.id}:${index}`))).length;
  return { fileCount, slipCount, pageCount, hasErrors: items.some((it) => it.error), isReading: items.some((it) => it.pageCount == null && !it.error) };
}

function fileRowHtml(item, review, pageIndex = null) {
  const errorClass = item.error ? " sl4-file-error" : "";
  const matches = review.duplicates.map((pair, index) => ({ pair, index })).filter(({ pair }) => pageIndex == null ? pair.duplicate.key.startsWith(`${item.id}:`) : pair.duplicate.key === `${item.id}:${pageIndex}`);
  const selectedCount = item.pageCount == null ? null : Array.from({ length: item.pageCount }, (_, index) => index).filter(index => (pageIndex == null || index === pageIndex) && !review.excluded.has(`${item.id}:${index}`)).length;
  if (selectedCount === 0 && !item.error) return "";
  const pendingMatches = matches.filter(({ pair }) => !duplicateDecisions.has(pair.key));
  const pending = matches.some(({ pair }) => !duplicateDecisions.has(pair.key));
  const originals = [...new Set(review.duplicates.filter(pair => pair.original.key.startsWith(`${item.id}:`) && (pageIndex == null || pair.original.pageIndex === pageIndex)).map(pair => pair.original.pageIndex + 1))];
  const unchecked = (item.identities || []).flatMap((identity, index) => identity.comparable || (pageIndex != null && index !== pageIndex) ? [] : [index + 1]);
  const metaLine = item.error
    ? `<span class="sl4-file-err-text">${item.error}</span>`
    : item.pageCount == null
      ? `<span>${formatSize(item.size)} &middot; Readingâ€¦</span>`
      : `<span>${formatSize(item.size)} &middot; ${selectedCount} shipping ${selectedCount === 1 ? "slip" : "slips"}${selectedCount < item.pageCount ? " selected" : ""}</span>`;
  return `
    <article class="sl4-file-row${errorClass}${pending ? " sl4-file-duplicate" : ""}" data-id="${item.id}"${pageIndex == null ? "" : ` data-page="${pageIndex}"`}>
      <div class="sl4-file-header">
      <div class="sl4-file-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h7l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z"/><path d="M14 3.5V8h4"/><path d="M9 12.5h6M9 16h6"/></svg>
      </div>
      <div class="sl4-file-meta">
        <strong>${escapeHtml(item.name)}</strong>
        ${pageIndex != null && item.pageCount > 1 ? `<span>Page ${pageIndex + 1} of ${item.pageCount}</span>` : ""}
        ${metaLine}
        <span class="sl4-courier-badges">${courierCounts((item.identities || []).filter((identity, index) => (pageIndex == null || index === pageIndex) && !review.excluded.has(`${item.id}:${index}`))).map(([name, count]) => `<span class="sl4-courier-badge">${escapeHtml(name)}${pageIndex == null && item.pageCount > 1 ? ` · ${count}` : ""}</span>`).join("")}</span>
        ${matches.length ? `<span>${escapeHtml(matches[0].pair.duplicate.marketplace)} &middot; Order ID: ${escapeHtml(matches[0].pair.duplicate.orderId || "Not available")}</span>` : ""}
        ${originals.length ? `<span class="sl4-original-label">Original ${originals.length === 1 ? "label · Page" : "labels · Pages"} ${originals.join(", ")}</span>` : ""}
      </div>
      </div>
      ${pendingMatches.length ? `<div class="sl4-card-review">${pendingMatches.map(({ pair, index }) => duplicateInfoHtml(pair, index)).join("")}</div>` : ""}
      ${unchecked.length ? `<p class="sl4-manual-review">Pages ${unchecked.join(", ")}: shipment identifiers unavailable or conflicting. Kept selected; review manually.</p>` : ""}
      ${pending ? "" : `<div class="sl4-file-actions"><button type="button" class="btn btn-ghost btn-sm sl4-remove-btn" data-id="${item.id}">Remove file</button></div>`}
    </article>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function selectedLabels(review) {
  const labels = review.labels.filter(label => !review.excluded.has(label.key));
  if ($("sl4-sort-order").value === "courier") labels.sort((first, second) => compareCouriers(first.courier || UNKNOWN_COURIER, second.courier || UNKNOWN_COURIER));
  return labels;
}

function fileListHtml(review) {
  if ($("sl4-sort-order").value !== "courier") return items.map(item => fileRowHtml(item, review)).join("");
  const labels = selectedLabels(review);
  const groups = courierCounts(labels).map(([courier, count]) => {
    const cards = labels.filter(label => (label.courier || UNKNOWN_COURIER) === courier).map(label => {
      const item = items.find(candidate => label.key === `${candidate.id}:${label.pageIndex}`);
      return fileRowHtml(item, review, label.pageIndex);
    }).join("");
    return `<section class="sl4-courier-group"><h3>${escapeHtml(courier)} <span>${count} ${count === 1 ? "label" : "labels"}</span></h3>${cards}</section>`;
  }).join("");
  const reading = items.filter(item => item.error || item.pageCount == null).map(item => fileRowHtml(item, review)).join("");
  return groups + reading;
}

function render() {
  revokeResultUrl();
  if (!items.length) {
    showState("idle");
    updatePreview();
    return;
  }
  showState("files");

  const review = duplicateReview();
  $("sl4-courier-summary").textContent = courierCounts(review.labels.filter(label => !review.excluded.has(label.key))).map(([name, count]) => `${name}: ${count}`).join(" · ");
  $("sl4-file-list").innerHTML = fileListHtml(review);
  for (const btn of $("sl4-file-list").querySelectorAll(".sl4-remove-btn")) {
    btn.addEventListener("click", () => removeItem(btn.dataset.id));
  }

  const t = totals();
  $("sl4-summary-files").textContent = String(t.fileCount);
  $("sl4-summary-slips").textContent = t.isReading ? "â€¦" : String(t.slipCount);
  $("sl4-summary-pages").textContent = t.isReading ? "â€¦" : String(t.pageCount);

  $("sl4-preview-count").textContent = `${t.slipCount} ${t.slipCount === 1 ? "label" : "labels"}`;
  const genBtn = $("sl4-generate-btn");
  const pending = duplicateReview().pending;
  genBtn.disabled = t.hasErrors || t.isReading || t.slipCount === 0 || pending > 0;
  genBtn.textContent = t.hasErrors ? "Remove the failed file to continue" : pending ? "Review duplicate labels to continue" : "Create 4-in-1 PDF";
  renderDuplicateReview();
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
      const pageCount = await getPageCount(buffer);
      try {
        item.identities = await extractLabelIdentities(item.bytes);
        if (item.identities.length !== pageCount) throw new Error("Page count mismatch");
      } catch {
        item.identities = Array.from({ length: pageCount }, () => ({ marketplace: "Unknown", comparable: false }));
      }
      item.pageCount = pageCount;
    } catch (err) {
      item.error = err && err.message ? err.message : "Could not read this PDF.";
    }
    render();
  }
}

function resetAll() {
  $("sl4-sort-order").value = "courier";
  items = [];
  duplicateDecisions.clear();
  revokeResultUrl();
  revokePreviewUrl();
  $("sl4-file-input").value = "";
  render();
}

async function generate() {
  const t = totals();
  if (t.hasErrors || t.isReading || t.slipCount === 0 || duplicateReview().pending) return;

  showState("converting");
  $("sl4-progress-text").textContent = "Reading your PDFsâ€¦";

  try {
    const files = selectedFiles();
    const groupByCourier = $("sl4-sort-order").value === "courier";
    const revision = previewRevision;

    const result = await buildFourInOnePdf(files, {
      groupByCourier,
      onProgress: (current, total) => {
        $("sl4-progress-text").textContent = `Building A4 sheet ${current} of ${total}â€¦`;
      },
    });

    if (revision !== previewRevision) return;
    revokeResultUrl();
    const blob = new Blob([result.bytes], { type: PDF_MIME });
    resultBlobUrl = URL.createObjectURL(blob);
    generatedFiles = files;
    generatedGroupByCourier = groupByCourier;
    $("sl4-download-page").innerHTML = Array.from({ length: result.pageCount }, (_, index) => `<option value="${index + 1}">Page ${index + 1} of ${result.pageCount}</option>`).join("");
    $("sl4-download-page").value = "1";
    $("sl4-download-options").hidden = false;

    $("sl4-success-meta").textContent = ` ${result.slipCount} shipping ${result.slipCount === 1 ? "slip" : "slips"} arranged onto ${result.pageCount} A4 ${result.pageCount === 1 ? "page" : "pages"}.`;

    showState("success");
  } catch (err) {
    $("sl4-error-message").textContent = " " + (err && err.message ? err.message : "Something went wrong while building this PDF.");
    showState("error");
  }
}

function wire() {
  $("sl4-download-page-btn").addEventListener("click", async () => {
    if (!generatedFiles || !resultBlobUrl) return;
    const button = $("sl4-download-page-btn");
    const files = generatedFiles;
    const combinedUrl = resultBlobUrl;
    const page = Number($("sl4-download-page").value);
    button.disabled = true;
    $("sl4-download-page-status").textContent = "";
    try {
      if (!individualBlobUrls.has(page)) {
        const result = await buildFourInOnePdf(files, { groupByCourier: generatedGroupByCourier, selectedSheets: [page] });
        if (combinedUrl !== resultBlobUrl) return;
        individualBlobUrls.set(page, URL.createObjectURL(new Blob([result.bytes], { type: PDF_MIME })));
      }
      const anchor = document.createElement("a");
      anchor.href = individualBlobUrls.get(page);
      anchor.download = `Shipping-Labels-4-in-1-Page-${page}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      $("sl4-download-page-status").textContent = error.message || "Could not download this page.";
    } finally {
      button.disabled = false;
    }
  });
  $("sl4-sort-order").value = "courier";
  $("sl4-sort-order").addEventListener("change", render);
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

  $("sl4-generate-btn").addEventListener("click", generate);
  $("sl4-clear-btn").addEventListener("click", resetAll);
  $("sl4-error-retry-btn").addEventListener("click", () => showState(items.length ? "files" : "idle"));
  $("sl4-start-over-btn").addEventListener("click", resetAll);
  $("sl4-preview-prev").addEventListener("click", () => { previewPage -= 1; showPreviewPage(); });
  $("sl4-preview-next").addEventListener("click", () => { previewPage += 1; showPreviewPage(); });

  $("sl4-download-btn").addEventListener("click", () => {
    if (!resultBlobUrl) return;
    const a = document.createElement("a");
    a.href = resultBlobUrl;
    a.download = OUTPUT_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}

showState("idle");
wire();
