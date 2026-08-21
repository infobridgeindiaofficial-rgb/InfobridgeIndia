export function isPdfFile(file) { return Boolean(file) && ((file.type || "").toLowerCase() === "application/pdf" || /\.pdf$/i.test(file.name || "")); }
export function hasPdfSignature(bytes) { return bytes instanceof Uint8Array && bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d; }
export function formatSize(bytes) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(2)} MB`; }
export function classifyPdfLoadError(error) { const text = `${error?.name || ""} ${error?.message || ""}`.toLowerCase(); return text.includes("encrypted") || text.includes("password") ? "ENCRYPTED" : "CORRUPTED"; }

function parsePositivePage(value, totalPages) {
  if (!/^\d+$/.test(value)) throw new Error(`“${value}” is not a valid page number.`);
  const page = Number(value); if (page < 1) throw new Error("Page numbers must start at 1."); if (page > totalPages) throw new Error(`Page ${page} is higher than this PDF’s ${totalPages} pages.`); return page;
}

export function parseExtractPages(input, totalPages) {
  const text = String(input || "").trim(); if (!text) throw new Error("Enter at least one page number or range."); const pages = [];
  for (const raw of text.split(",")) { const token = raw.trim(); if (!token) throw new Error("Remove the empty item between commas."); const match = token.match(/^(\d+)\s*-\s*(\d+)$/); if (match) { const start = parsePositivePage(match[1], totalPages), end = parsePositivePage(match[2], totalPages); if (start > end) throw new Error(`Invalid range “${token}”: the first page must not be greater than the last page.`); for (let page = start; page <= end; page++) pages.push(page); } else pages.push(parsePositivePage(token, totalPages)); }
  return pages;
}

export function parseSplitRanges(input, totalPages) {
  const text = String(input || "").trim(); if (!text) throw new Error("Enter at least one page range.");
  return text.split(",").map((raw) => { const token = raw.trim(); const match = token.match(/^(\d+)\s*-\s*(\d+)$/); if (!match) throw new Error(`“${token || "empty item"}” is not a valid range. Use a format such as 1-3.`); const start = parsePositivePage(match[1], totalPages), end = parsePositivePage(match[2], totalPages); if (start > end) throw new Error(`Invalid range “${token}”: the first page must not be greater than the last page.`); return { start, end, pages: Array.from({ length: end - start + 1 }, (_, index) => start + index), filename: `pages-${start}-${end}.pdf` }; });
}
