import { convertPdfToDocx } from "./core.js";

const $ = (id) => document.getElementById(id);
const MAX_SIZE = 30 * 1024 * 1024; // 30 MB
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const states = {
  idle: $("ptw-state-idle"),
  selected: $("ptw-state-selected"),
  converting: $("ptw-state-converting"),
  success: $("ptw-state-success"),
  error: $("ptw-state-error"),
};

let selectedFile = null;
let resultBlobUrl = null;
let resultFileName = "converted.docx";

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
  if (file.type === "application/pdf") return true;
  return /\.pdf$/i.test(file.name || "");
}

function revokeResultUrl() {
  if (resultBlobUrl) {
    URL.revokeObjectURL(resultBlobUrl);
    resultBlobUrl = null;
  }
}

function selectFile(file) {
  if (!isPdfFile(file)) {
    showError("Only PDF files are supported. Please choose a .pdf file.");
    return;
  }
  if (file.size > MAX_SIZE) {
    showError(`This file is ${formatSize(file.size)}, which is over the 30 MB limit for browser-side conversion.`);
    return;
  }
  selectedFile = file;
  $("ptw-file-name").textContent = file.name;
  $("ptw-file-size").textContent = formatSize(file.size);
  showState("selected");
}

function showError(message) {
  $("ptw-error-message").textContent = " " + message;
  showState("error");
}

function resetToIdle() {
  selectedFile = null;
  revokeResultUrl();
  $("ptw-file-input").value = "";
  showState("idle");
}

async function runConversion() {
  if (!selectedFile) return;
  showState("converting");
  $("ptw-progress-text").textContent = "Reading your PDF…";

  try {
    const buffer = await selectedFile.arrayBuffer();
    const result = await convertPdfToDocx(buffer, {
      onProgress: (current, total) => {
        $("ptw-progress-text").textContent = total > 1 ? `Extracting page ${current} of ${total}…` : "Extracting text…";
      },
    });

    $("ptw-progress-text").textContent = "Building Word document…";

    revokeResultUrl();
    const blob = new Blob([result.bytes], { type: DOCX_MIME });
    resultBlobUrl = URL.createObjectURL(blob);
    resultFileName = selectedFile.name.replace(/\.pdf$/i, "") + ".docx";

    $("ptw-success-meta").textContent = ` ${result.pageCount} page${result.pageCount === 1 ? "" : "s"} converted from "${selectedFile.name}".`;

    const warningBanner = $("ptw-warning-banner");
    if (result.warnings.length) {
      warningBanner.innerHTML = `<div class="banner banner-warning"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 15.5H3L12 4z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.4" fill="currentColor"/></svg><div><strong>Heads up</strong> ${result.warnings.join(" ")}</div></div>`;
      warningBanner.style.display = "";
    } else {
      warningBanner.style.display = "none";
      warningBanner.innerHTML = "";
    }

    showState("success");
  } catch (err) {
    showError(err && err.message ? err.message : "Something went wrong while converting this file.");
  }
}

function wire() {
  const dropzone = $("ptw-dropzone");
  const fileInput = $("ptw-file-input");

  // The dropzone is a <label for="ptw-file-input">, so a plain click already
  // opens the file picker natively - only keyboard activation needs wiring.
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
      dropzone.classList.add("ptw-dragover");
    })
  );
  ["dragleave", "dragend"].forEach((evt) =>
    dropzone.addEventListener(evt, () => dropzone.classList.remove("ptw-dragover"))
  );
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("ptw-dragover");
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) selectFile(file);
  });

  $("ptw-file-remove").addEventListener("click", resetToIdle);
  $("ptw-convert-btn").addEventListener("click", runConversion);
  $("ptw-convert-another-btn").addEventListener("click", resetToIdle);
  $("ptw-error-retry-btn").addEventListener("click", resetToIdle);

  $("ptw-download-btn").addEventListener("click", () => {
    if (!resultBlobUrl) return;
    const a = document.createElement("a");
    a.href = resultBlobUrl;
    a.download = resultFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}

showState("idle");
wire();
