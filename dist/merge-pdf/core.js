export function isPdfFile(file) {
  if (!file) return false;
  return (file.type || "").toLowerCase() === "application/pdf" || /\.pdf$/i.test(file.name || "");
}

export function hasPdfSignature(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 5) return false;
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function classifyPdfLoadError(error) {
  const text = `${error?.name || ""} ${error?.message || ""}`.toLowerCase();
  if (text.includes("encrypted") || text.includes("password")) return "ENCRYPTED";
  return "CORRUPTED";
}
