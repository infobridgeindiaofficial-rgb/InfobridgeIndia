import { isPdfFile, hasPdfSignature, formatSize, classifyPdfLoadError } from "./core.js";

const $ = (id) => document.getElementById(id);
const selected = [];
let processing = false, downloadUrl = "", draggedId = null;

function message(text = "", type = "error") { const el = $("mpdf-message"); el.textContent = text; el.className = text ? `mpdf-message ${type}` : "mpdf-message"; }
function revokeDownload() { if (downloadUrl) URL.revokeObjectURL(downloadUrl); downloadUrl = ""; $("mpdf-download-btn").style.display = "none"; }
function report(category, userMessage, error, details = {}) { console.error(`[Merge PDF] ${category}`, { ...details, error }); message(userMessage); }
function pdfLib() { return window.PDFLib && window.PDFLib.PDFDocument ? window.PDFLib : null; }

function render() {
  const list = $("mpdf-list"); list.innerHTML = "";
  selected.forEach((item, index) => {
    const row = document.createElement("div"); row.className = "mpdf-file-row"; row.draggable = true; row.dataset.id = item.id;
    const icon = document.createElement("div"); icon.className = "mpdf-file-icon"; icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h7l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z"/><path d="M14 3.5V8h4"/><path d="M9 13h6M9 16h4"/></svg>';
    const meta = document.createElement("div"); meta.className = "mpdf-file-meta"; const name = document.createElement("strong"); name.textContent = item.file.name; const details = document.createElement("span"); details.textContent = `File ${index + 1} · ${item.pageCount} page${item.pageCount === 1 ? "" : "s"} · ${formatSize(item.file.size)}`; meta.append(name, details);
    const order = document.createElement("div"); order.className = "mpdf-order";
    [["↑", "Move up", -1], ["↓", "Move down", 1]].forEach(([text, label, delta]) => { const button = document.createElement("button"); button.type = "button"; button.className = "btn btn-ghost btn-sm"; button.textContent = text; button.title = label; button.setAttribute("aria-label", `${label} ${item.file.name}`); button.disabled = delta < 0 ? index === 0 : index === selected.length - 1; button.addEventListener("click", () => move(index, index + delta)); order.appendChild(button); });
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "btn btn-ghost btn-sm"; remove.textContent = "Remove"; remove.addEventListener("click", () => removeItem(item.id)); row.append(icon, meta, order, remove); list.appendChild(row);
  });
  $("mpdf-selection").style.display = selected.length ? "" : "none"; const pages = selected.reduce((sum, item) => sum + item.pageCount, 0); $("mpdf-count").textContent = `${selected.length} PDF${selected.length === 1 ? "" : "s"} · ${pages} total page${pages === 1 ? "" : "s"} · displayed order becomes merged order`;
}

function move(from, to) { if (to < 0 || to >= selected.length) return; selected.splice(to, 0, selected.splice(from, 1)[0]); revokeDownload(); message(); render(); }
function removeItem(id) { const index = selected.findIndex((item) => item.id === id); if (index < 0) return; selected.splice(index, 1); revokeDownload(); message(); render(); }

async function addFiles(files) {
  message(); revokeDownload(); const library = pdfLib();
  if (!library) { report("PDF library load failure", "The PDF processing library did not load. Please refresh the page and try again.", new Error("window.PDFLib.PDFDocument is unavailable"), { pdfLibGlobal: typeof window.PDFLib }); return; }
  const unsupported = [];
  for (const file of files) {
    if (!isPdfFile(file)) { unsupported.push(file.name); continue; }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasPdfSignature(bytes)) throw Object.assign(new Error("Missing %PDF- file signature."), { code: "CORRUPTED" });
      const document = await library.PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
      selected.push({ id: `${Date.now()}-${Math.random()}`, file, bytes, pageCount: document.getPageCount() });
    } catch (error) {
      const kind = error.code || classifyPdfLoadError(error);
      if (kind === "ENCRYPTED") report("Encrypted PDF", `“${file.name}” is password-protected or encrypted and cannot be merged in the browser.`, error, { fileName: file.name, fileSize: file.size });
      else report("PDF decode failure", `“${file.name}” is corrupted or is not a readable PDF.`, error, { fileName: file.name, fileSize: file.size });
    }
  }
  if (unsupported.length) { console.warn("[Merge PDF] Unsupported file type", { files: unsupported }); message(`Unsupported file type: ${unsupported.join(", ")}. Please choose PDF files only.`); }
  $("mpdf-file-input").value = ""; render();
}

async function mergePdfs() {
  if (processing) return;
  if (!selected.length) { message("Please select at least two PDF files before merging."); return; }
  if (selected.length === 1) { message("Please add one more PDF. At least two PDF files are required to merge."); return; }
  const library = pdfLib(); if (!library) { report("PDF library load failure", "The PDF processing library did not load. Please refresh the page and try again.", new Error("window.PDFLib.PDFDocument is unavailable")); return; }
  processing = true; revokeDownload(); message(); $("mpdf-merge-btn").disabled = true; $("mpdf-processing").style.display = ""; let currentFileName = null;
  try {
    const output = await library.PDFDocument.create();
    for (const item of selected) {
      currentFileName = item.file.name; const source = await library.PDFDocument.load(item.bytes, { ignoreEncryption: false, updateMetadata: false });
      const pages = await output.copyPages(source, source.getPageIndices()); pages.forEach((page) => output.addPage(page)); await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false });
    if (!bytes?.length) throw new Error("pdf-lib returned an empty document.");
    const blob = new Blob([bytes], { type: "application/pdf" }); downloadUrl = URL.createObjectURL(blob); const link = $("mpdf-download-btn"); link.href = downloadUrl; link.style.display = "inline-flex";
    message(`Merge complete. Your ${output.getPageCount()}-page PDF is ready to download.`, "success");
  } catch (error) { const kind = classifyPdfLoadError(error); if (kind === "ENCRYPTED") report("Encrypted PDF", `“${currentFileName}” is encrypted and cannot be merged.`, error, { currentFileName }); else report("PDF merge failure", "The selected files were read, but the merged PDF could not be generated. See the browser console for technical details.", error, { currentFileName, fileCount: selected.length }); }
  finally { processing = false; $("mpdf-merge-btn").disabled = false; $("mpdf-processing").style.display = "none"; }
}

const input = $("mpdf-file-input"), dropzone = $("mpdf-dropzone"), list = $("mpdf-list"); input.addEventListener("change", () => addFiles([...input.files])); $("mpdf-add-btn").addEventListener("click", () => input.click()); $("mpdf-merge-btn").addEventListener("click", mergePdfs);
dropzone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.click(); } });
["dragenter", "dragover"].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.add("mpdf-dragover"); })); ["dragleave", "dragend"].forEach((name) => dropzone.addEventListener(name, () => dropzone.classList.remove("mpdf-dragover"))); dropzone.addEventListener("drop", (event) => { event.preventDefault(); dropzone.classList.remove("mpdf-dragover"); addFiles([...event.dataTransfer.files]); });
list.addEventListener("dragstart", (event) => { const row = event.target.closest(".mpdf-file-row"); if (row) { draggedId = row.dataset.id; row.classList.add("mpdf-dragging"); } }); list.addEventListener("dragend", (event) => { event.target.closest(".mpdf-file-row")?.classList.remove("mpdf-dragging"); draggedId = null; }); list.addEventListener("dragover", (event) => event.preventDefault()); list.addEventListener("drop", (event) => { event.preventDefault(); const target = event.target.closest(".mpdf-file-row"), from = selected.findIndex((item) => item.id === draggedId), to = target ? selected.findIndex((item) => item.id === target.dataset.id) : -1; if (from >= 0 && to >= 0 && from !== to) move(from, to); }); window.addEventListener("beforeunload", revokeDownload); render();
