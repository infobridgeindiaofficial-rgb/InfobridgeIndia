import { isSupportedImage, formatSize, fitInside, detectImageFormat } from "./core.js";

const $ = (id) => document.getElementById(id);
const selected = [];
let processing = false;
let downloadUrl = "";
let draggedId = null;

function message(text = "", type = "error") { const el = $("jtp-message"); el.textContent = text; el.className = text ? `jtp-message ${type}` : "jtp-message"; }
function revokeDownload() { if (downloadUrl) URL.revokeObjectURL(downloadUrl); downloadUrl = ""; $("jtp-download-btn").style.display = "none"; }
function imageType(file) { return (file.type || "").toLowerCase() === "image/png" || /\.png$/i.test(file.name) ? "PNG" : "JPEG"; }

function reportError(category, userMessage, error, details = {}) {
  console.error(`[JPG to PDF] ${category}`, { ...details, error });
  message(userMessage);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); if (!img.naturalWidth || !img.naturalHeight) reject(new Error(`“${file.name}” has no readable image data.`)); else resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`“${file.name}” is corrupted or cannot be read as an image.`)); };
    img.src = url;
  });
}

function render() {
  const list = $("jtp-list"); list.innerHTML = "";
  selected.forEach((item, index) => {
    const row = document.createElement("div"); row.className = "jtp-file-row"; row.draggable = true; row.dataset.id = item.id;
    const thumb = document.createElement("img"); thumb.className = "jtp-thumb"; thumb.src = item.preview; thumb.alt = "";
    const meta = document.createElement("div"); meta.className = "jtp-file-meta";
    const name = document.createElement("strong"); name.textContent = item.file.name;
    const details = document.createElement("span"); details.textContent = `Page ${index + 1} · ${imageType(item.file)} · ${formatSize(item.file.size)}`;
    meta.append(name, details);
    const order = document.createElement("div"); order.className = "jtp-order";
    [["↑", "Move up", -1], ["↓", "Move down", 1]].forEach(([text, label, delta]) => { const button = document.createElement("button"); button.type = "button"; button.className = "btn btn-ghost btn-sm"; button.textContent = text; button.title = label; button.setAttribute("aria-label", `${label} ${item.file.name}`); button.disabled = delta < 0 ? index === 0 : index === selected.length - 1; button.addEventListener("click", () => move(index, index + delta)); order.appendChild(button); });
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "btn btn-ghost btn-sm"; remove.textContent = "Remove"; remove.addEventListener("click", () => removeItem(item.id));
    row.append(thumb, meta, order, remove); list.appendChild(row);
  });
  $("jtp-selection").style.display = selected.length ? "" : "none";
  $("jtp-count").textContent = `${selected.length} image${selected.length === 1 ? "" : "s"} · displayed order becomes PDF page order`;
}

function move(from, to) { if (to < 0 || to >= selected.length) return; selected.splice(to, 0, selected.splice(from, 1)[0]); revokeDownload(); message(); render(); }
function removeItem(id) { const i = selected.findIndex((x) => x.id === id); if (i < 0) return; URL.revokeObjectURL(selected[i].preview); selected.splice(i, 1); revokeDownload(); message(); render(); }

async function addFiles(files) {
  message(); revokeDownload();
  const unsupported = [];
  for (const file of files) {
    if (!isSupportedImage(file)) { unsupported.push(file.name); continue; }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const format = detectImageFormat(bytes);
      if (!format) throw Object.assign(new Error("The file signature is not a valid PNG or JPEG."), { code: "IMAGE_DECODE" });
      const img = await loadImage(file);
      selected.push({ id: `${Date.now()}-${Math.random()}`, file, bytes, format, width: img.naturalWidth, height: img.naturalHeight, preview: URL.createObjectURL(file) });
    } catch (error) {
      reportError("Image decode failure", `“${file.name}” could not be decoded as a valid PNG or JPEG image.`, error, { fileName: file.name, fileType: file.type, fileSize: file.size });
    }
  }
  if (unsupported.length) {
    console.warn("[JPG to PDF] Unsupported image", { files: unsupported });
    message(`Unsupported file type: ${unsupported.join(", ")}. Please choose JPG, JPEG or PNG images.`);
  }
  $("jtp-file-input").value = ""; render();
}

async function convert() {
  if (processing) return;
  if (!selected.length) { message("Please select at least one JPG, JPEG or PNG image before converting."); return; }
  const jsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDF) {
    reportError("PDF library load failure", "The PDF converter library did not load. Please refresh the page and try again.", new Error("window.jspdf.jsPDF is unavailable"), { jspdfGlobal: typeof window.jspdf });
    return;
  }
  processing = true; message(); revokeDownload(); $("jtp-convert-btn").disabled = true; $("jtp-processing").style.display = "";
  let currentFileName = null;
  try {
    let pdf;
    for (let i = 0; i < selected.length; i++) {
      const item = selected[i]; const landscape = item.width > item.height; const orientation = landscape ? "landscape" : "portrait";
      currentFileName = item.file.name;
      if (!pdf) pdf = new jsPDF({ orientation, unit: "mm", format: "a4", compress: true }); else pdf.addPage("a4", orientation);
      const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight(); const margin = 10;
      const fit = fitInside(item.width, item.height, pageWidth - margin * 2, pageHeight - margin * 2);
      // Pass the original bytes directly. Passing an <img> backed by a Blob
      // URL is unreliable because jsPDF reads its src later; if that URL has
      // already been revoked after decoding, addImage throws even though the
      // preview rendered successfully.
      pdf.addImage(item.bytes, item.format, margin + fit.x, margin + fit.y, fit.width, fit.height, undefined, "FAST");
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const blob = pdf.output("blob");
    if (!(blob instanceof Blob) || blob.size === 0) throw new Error("jsPDF returned an empty PDF Blob.");
    downloadUrl = URL.createObjectURL(blob); const link = $("jtp-download-btn"); link.href = downloadUrl; link.style.display = "inline-flex";
    message(`Conversion complete. Your ${selected.length}-page PDF is ready to download.`, "success");
  } catch (error) {
    reportError("PDF generation failure", "The images were decoded, but the PDF could not be generated. Please try again or remove the image named in the browser console.", error, { imageCount: selected.length, currentFileName });
  }
  finally { processing = false; $("jtp-convert-btn").disabled = false; $("jtp-processing").style.display = "none"; }
}

const input = $("jtp-file-input"), dropzone = $("jtp-dropzone"), list = $("jtp-list");
input.addEventListener("change", () => addFiles([...input.files]));
$("jtp-add-btn").addEventListener("click", () => input.click()); $("jtp-convert-btn").addEventListener("click", convert);
dropzone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
["dragenter", "dragover"].forEach((name) => dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.add("jtp-dragover"); }));
["dragleave", "dragend"].forEach((name) => dropzone.addEventListener(name, () => dropzone.classList.remove("jtp-dragover")));
dropzone.addEventListener("drop", (e) => { e.preventDefault(); dropzone.classList.remove("jtp-dragover"); addFiles([...e.dataTransfer.files]); });
list.addEventListener("dragstart", (e) => { const row = e.target.closest(".jtp-file-row"); if (row) { draggedId = row.dataset.id; row.classList.add("jtp-dragging"); } });
list.addEventListener("dragend", (e) => { e.target.closest(".jtp-file-row")?.classList.remove("jtp-dragging"); draggedId = null; });
list.addEventListener("dragover", (e) => e.preventDefault());
list.addEventListener("drop", (e) => { e.preventDefault(); const target = e.target.closest(".jtp-file-row"); const from = selected.findIndex((x) => x.id === draggedId), to = target ? selected.findIndex((x) => x.id === target.dataset.id) : -1; if (from >= 0 && to >= 0 && from !== to) move(from, to); });
window.addEventListener("beforeunload", () => { revokeDownload(); selected.forEach((item) => URL.revokeObjectURL(item.preview)); });
render();
