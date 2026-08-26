import { convertDocxToHtml } from "./core.js";

const $ = (id) => document.getElementById(id);
const MAX_SIZE = 30 * 1024 * 1024; // 30 MB
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const states = {
  idle: $("wtp-state-idle"),
  selected: $("wtp-state-selected"),
  converting: $("wtp-state-converting"),
  success: $("wtp-state-success"),
  error: $("wtp-state-error"),
};

const previewWrap = $("wtp-preview-wrap");
const wordPreview = $("wordPreview");

let selectedFile = null;
let outputBaseName = "document";
let isConverting = false;

function showState(name) {
  for (const [key, el] of Object.entries(states)) el.style.display = key === name ? "" : "none";
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isDocxFile(file) {
  if (!file) return false;
  if (file.type === DOCX_MIME) return true;
  return /\.docx$/i.test(file.name || "");
}

function selectFile(file) {
  if (!isDocxFile(file)) {
    showError('Only Word (.docx) files are supported. Please choose a file ending in ".docx".');
    return;
  }
  if (file.size > MAX_SIZE) {
    showError(`This file is ${formatSize(file.size)}, which is over the ${formatSize(MAX_SIZE)} limit for browser-side conversion.`);
    return;
  }
  selectedFile = file;
  outputBaseName = file.name.replace(/\.docx$/i, "") || "document";
  $("wtp-file-name").textContent = file.name;
  $("wtp-file-size").textContent = `DOCX • ${formatSize(file.size)}`;
  previewWrap.style.display = "none";
  showState("selected");
}

function showError(message) {
  $("wtp-error-message").textContent = " " + message;
  showState("error");
}

function resetToIdle() {
  selectedFile = null;
  $("wtp-file-input").value = "";
  previewWrap.style.display = "none";
  wordPreview.innerHTML = "";
  showState("idle");
}

function setPageStyle(pageSetup) {
  let styleEl = document.getElementById("wtpPageSizeStyle");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "wtpPageSizeStyle";
    document.head.appendChild(styleEl);
  }
  const { widthIn, heightIn, marginTopIn, marginRightIn, marginBottomIn, marginLeftIn } = pageSetup;
  styleEl.textContent = `@media print { @page { size: ${widthIn}in ${heightIn}in; margin: ${marginTopIn}in ${marginRightIn}in ${marginBottomIn}in ${marginLeftIn}in; } }`;

  // On-screen preview: page width comes from the source document; the
  // padding simulates the source margins for an accurate live preview. The
  // print stylesheet strips this padding again since @page margin (set
  // above) becomes the real print margin - see word-to-pdf/styles.css.
  wordPreview.style.width = `${widthIn}in`;
  wordPreview.style.minHeight = `${heightIn}in`;
  wordPreview.style.padding = `${marginTopIn}in ${marginRightIn}in ${marginBottomIn}in ${marginLeftIn}in`;
}

async function runConversion() {
  if (!selectedFile || isConverting) return;
  isConverting = true;
  showState("converting");

  try {
    const buffer = await selectedFile.arrayBuffer();
    const result = await convertDocxToHtml(buffer);

    wordPreview.innerHTML = result.bodyHtml || "<p>&nbsp;</p>";
    if (result.footerHtml) {
      const footerEl = document.createElement("div");
      footerEl.className = "wtp-footer";
      footerEl.innerHTML = result.footerHtml;
      wordPreview.appendChild(footerEl);
    }
    setPageStyle(result.pageSetup);
    previewWrap.style.display = "";

    $("wtp-success-meta").textContent = ` "${selectedFile.name}" converted and ready below.`;

    const warningBanner = $("wtp-warning-banner");
    if (result.warnings.length) {
      warningBanner.innerHTML = `<div class="banner banner-warning"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 15.5H3L12 4z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.4" fill="currentColor"/></svg><div><strong>Heads up</strong> ${result.warnings.join(" ")}</div></div>`;
      warningBanner.style.display = "";
    } else {
      warningBanner.style.display = "none";
      warningBanner.innerHTML = "";
    }

    showState("success");
    previewWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    previewWrap.style.display = "none";
    showError(err && err.message ? err.message : "Something went wrong while converting this file.");
  } finally {
    isConverting = false;
  }
}

function downloadPdf() {
  if (!wordPreview.innerHTML.trim()) return;
  const pdfStatus = $("wtpPdfStatus");
  if (pdfStatus) pdfStatus.textContent = 'Opening the print dialog — choose "Save as PDF" as the destination.';
  const originalTitle = document.title;
  document.title = outputBaseName; // Chrome/Edge/Firefox suggest document.title as the save-as filename
  window.print();
  document.title = originalTitle;
}

function wire() {
  const dropzone = $("wtp-dropzone");
  const fileInput = $("wtp-file-input");

  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) selectFile(fileInput.files[0]);
  });

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("wtp-dragover");
    })
  );
  ["dragleave", "dragend"].forEach((evt) =>
    dropzone.addEventListener(evt, () => dropzone.classList.remove("wtp-dragover"))
  );
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("wtp-dragover");
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) selectFile(file);
  });

  $("wtp-file-remove").addEventListener("click", resetToIdle);
  $("wtp-convert-btn").addEventListener("click", runConversion);
  $("wtp-convert-another-btn").addEventListener("click", resetToIdle);
  $("wtp-error-retry-btn").addEventListener("click", resetToIdle);
  $("wtp-download-btn").addEventListener("click", downloadPdf);
}

showState("idle");
wire();
