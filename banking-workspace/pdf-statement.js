const DATE = /^(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}[ -](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[ -]\d{2,4})$/i;
const AMOUNT = /^-?[\d,]+(?:\.\d{1,2})?(?:\s*(?:Cr|Dr))?$/i;
const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

export function groupLines(items) {
  const lines = [];
  for (const item of items.filter((entry) => clean(entry.str))) {
    const x = item.transform[4], y = item.transform[5];
    let line = lines.find((entry) => Math.abs(entry.y - y) <= 2);
    if (!line) { line = { y, items: [] }; lines.push(line); }
    line.items.push({ x, text: clean(item.str) });
  }
  return lines.sort((a, b) => b.y - a.y).map((line) => ({ ...line, items: line.items.sort((a, b) => a.x - b.x) }));
}

export function headerColumns(lines) {
  for (let index = 0; index < lines.length; index++) {
    // Kotak renders parts of Withdrawal (Dr.) / Deposit (Cr.) and sometimes
    // Chq/Ref. No. on adjacent baselines. Inspect a small visual header band.
    const band = lines.slice(index, index + 4).filter((line) => Math.abs(line.y - lines[index].y) <= 28 && !line.items.some((item) => DATE.test(clean(item.text))));
    const items = band.flatMap((line) => line.items);
    const text = items.map((item) => item.text).join(" ");
    if (!/date/i.test(text) || !/(description|narration|particular)/i.test(text) || !/(withdrawal|debit|dr\.)/i.test(text) || !/(deposit|credit|cr\.)/i.test(text)) continue;
    const findX = (pattern, fallback) => items.find((item) => pattern.test(item.text))?.x ?? fallback;
    return {
      date: findX(/^date$/i, items[0].x),
      description: findX(/description|narration|particular/i, items[0].x + 60),
      reference: findX(/chq|ref/i, items[0].x + 260),
      debit: findX(/withdrawal|debit/i, items[0].x + 360),
      credit: findX(/deposit|credit/i, items[0].x + 440),
      balance: findX(/balance/i, items[0].x + 520),
      top: Math.max(...band.map((line) => line.y)),
      bottom: Math.min(...band.map((line) => line.y)),
    };
  }
  return null;
}

export function cellsFor(line, columns) {
  const names = ["date", "description", "reference", "debit", "credit", "balance"];
  const starts = names.map((name) => columns[name]);
  const boundaries = [(starts[0] + starts[1]) / 2, (starts[1] + starts[2]) / 2, (starts[2] + starts[3]) / 2, starts[4], starts[5]];
  const cells = Object.fromEntries(names.map((name) => [name, []]));
  for (const item of line.items) {
    // Kotak includes a serial-number column before Date; it is not transaction data.
    if (item.x < starts[0] - 8) continue;
    // Header coordinates are the left edges of columns. Numeric values are
    // right-aligned, so midpoint boundaries incorrectly move debits into credits.
    let index = boundaries.findIndex((boundary) => item.x < boundary);
    if (index < 0) index = names.length - 1;
    cells[names[index]].push(item.text);
  }
  return Object.fromEntries(names.map((name) => [name, clean(cells[name].join(" "))]));
}

function normalizeRow(row) {
  const movement = [row.debit, row.credit].map((value) => clean(value));
  if (!DATE.test(clean(row.date)) || !movement.some((value) => value && AMOUNT.test(value))) return null;
  if (/^(?:opening balance|balance brought forward|b\/f|brought forward)$/i.test(clean(row.description))) return null;
  return {
    Date: row.date,
    Description: row.description,
    "Chq/Ref. No.": row.reference,
    "Withdrawal (Dr.)": row.debit,
    "Deposit (Cr.)": row.credit,
    Balance: row.balance,
  };
}

export function parseStatementLines(pages) {
  const rows = [];
  let columns = null, current = null;
  for (const pageLines of pages) {
    // Never allow page headings/footers from the next page to join the prior narration.
    if (current) { rows.push(current); current = null; }
    columns = headerColumns(pageLines) || columns;
    if (!columns) continue;
    for (const line of pageLines) {
      if (line.y <= columns.top + 3 && line.y >= columns.bottom - 3) continue;
      const lineText = clean(line.items.map((item) => item.text).join(" "));
      if (current && /(?:End of Statement|Any discrepancy in the statement|For assistance, reach out|Commonly Used Narrations)/i.test(lineText)) break;
      const cells = cellsFor(line, columns);
      if (DATE.test(cells.date)) {
        if (current) rows.push(current);
        current = cells;
      } else if (current && !/^(?:total|closing balance|page \d+|statement summary|statement generated)/i.test(cells.description)) {
        if (cells.description) current.description = clean(`${current.description} ${cells.description}`);
        if (cells.reference) current.reference = clean(`${current.reference} ${cells.reference}`);
        if (!current.debit && AMOUNT.test(cells.debit)) current.debit = cells.debit;
        if (!current.credit && AMOUNT.test(cells.credit)) current.credit = cells.credit;
        if (!current.balance && AMOUNT.test(cells.balance)) current.balance = cells.balance;
      }
    }
  }
  if (current) rows.push(current);
  return rows.map(normalizeRow).filter(Boolean);
}

export async function parsePdfStatement(file) {
  // Resolve from this module rather than the site root so static deployments under a
  // base path (for example /infobridgeindia/) load the same build-local PDF.js assets.
  const pdfModuleUrl = new URL("../vendor/pdf.js", import.meta.url);
  const pdfWorkerUrl = new URL("../vendor/pdf.worker.min.js", import.meta.url);
  const pdfjsLib = await import(pdfModuleUrl.href);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl.href;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const fileFingerprint = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const document = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages = [], allText = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber), content = await page.getTextContent();
    pages.push(groupLines(content.items));
    allText.push(content.items.map((item) => item.str).join(" "));
  }
  const text = allText.join(" "), currency = /(?:₹|\bINR\b|Indian Rupees?)/i.test(text) ? "INR" : /(?:\bAED\b|UAE Dirhams?)/i.test(text) ? "AED" : "";
  const accountMatch = text.match(/(?:account(?:\s+number|\s+no\.?|\s*#)?)[\s:.-]*([X*\d -]{6,})/i);
  return { rows: parseStatementLines(pages), metadata: { currency, bank: /kotak/i.test(text) ? "Kotak Mahindra Bank" : "", account: clean(accountMatch?.[1]), pages: document.numPages }, fileFingerprint };
}
