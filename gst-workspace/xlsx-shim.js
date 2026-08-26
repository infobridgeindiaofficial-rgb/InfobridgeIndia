// Minimal local XLSX read/write engine implementing just the slice of the
// SheetJS ("XLSX") API surface used by the ported Meesho/Flipkart/Combined
// GSTR-1 logic (marketplace-meesho.js, marketplace-flipkart.js,
// marketplace-combined.js), so that logic - originally written against the
// real SheetJS library loaded from a CDN in the old InfoBridgeIndia site -
// can run completely unmodified, with the exact same calculations, entirely
// offline. Reuses the same hand-rolled zip technique already used elsewhere
// in this project (see the inline `unzip()` in gst/app.js, and the fuller
// zip reader/writer in word-to-pdf/core.js and shipping-label-4in1/core.js).

// ---------------------------------------------------------------------------
// ZIP reader (store + deflate methods)
// ---------------------------------------------------------------------------

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const minEocd = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minEocd; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error("Not a valid .xlsx file (no ZIP structure found).");

  const totalEntries = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  const entries = new Map();
  let pos = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = new TextDecoder("utf-8").decode(bytes.subarray(pos + 46, pos + 46 + nameLen));

    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);

    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = await inflateRaw(raw);
    else data = new Uint8Array(0);

    entries.set(name, data);
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Minimal XML parser (same approach as word-to-pdf/core.js)
// ---------------------------------------------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function parseXml(text) {
  let pos = 0;
  const len = text.length;
  function skipMisc() {
    for (;;) {
      while (pos < len && /\s/.test(text[pos])) pos++;
      if (text.startsWith("<?", pos)) { pos = text.indexOf("?>", pos); pos = pos === -1 ? len : pos + 2; continue; }
      if (text.startsWith("<!--", pos)) { pos = text.indexOf("-->", pos); pos = pos === -1 ? len : pos + 3; continue; }
      break;
    }
  }
  function parseElement() {
    pos++;
    const tagStart = pos;
    while (pos < len && !/[\s/>]/.test(text[pos])) pos++;
    const tag = text.slice(tagStart, pos);
    const attrs = {};
    for (;;) {
      while (pos < len && /\s/.test(text[pos])) pos++;
      if (text[pos] === "/" && text[pos + 1] === ">") { pos += 2; return { tag, attrs, children: [] }; }
      if (text[pos] === ">") { pos++; break; }
      if (pos >= len) return { tag, attrs, children: [] };
      const nameStart = pos;
      while (pos < len && text[pos] !== "=" && !/\s/.test(text[pos]) && text[pos] !== ">") pos++;
      const name = text.slice(nameStart, pos);
      while (pos < len && /\s/.test(text[pos])) pos++;
      if (text[pos] !== "=") continue;
      pos++;
      while (pos < len && /\s/.test(text[pos])) pos++;
      const quote = text[pos];
      pos++;
      const valStart = pos;
      while (pos < len && text[pos] !== quote) pos++;
      attrs[name] = decodeEntities(text.slice(valStart, pos));
      pos++;
    }
    const children = [];
    let textContent = "";
    for (;;) {
      if (pos >= len) break;
      if (text.startsWith("</", pos)) { pos = text.indexOf(">", pos); pos = pos === -1 ? len : pos + 1; break; }
      if (text.startsWith("<!--", pos)) { pos = text.indexOf("-->", pos); pos = pos === -1 ? len : pos + 3; continue; }
      if (text[pos] === "<") children.push(parseElement());
      else { const start = pos; while (pos < len && text[pos] !== "<") pos++; textContent += decodeEntities(text.slice(start, pos)); }
    }
    return { tag, attrs, children, text: textContent };
  }
  skipMisc();
  if (pos >= len || text[pos] !== "<") throw new Error("Malformed XML.");
  return parseElement();
}

function child(node, tag) { return node ? node.children.find((c) => c.tag === tag) : undefined; }
function children(node, tag) { return node ? node.children.filter((c) => c.tag === tag) : []; }

// ---------------------------------------------------------------------------
// Cell address helpers (A1 notation)
// ---------------------------------------------------------------------------

function encode_col(c) {
  let s = "";
  let n = c + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function decode_col(letters) {
  let col = 0;
  for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64);
  return col - 1;
}
function encode_cell({ r, c }) { return `${encode_col(c)}${r + 1}`; }
function decode_cell(ref) {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  return { c: decode_col(m[1]), r: Number(m[2]) - 1 };
}
function encode_range({ s, e }) { return `${encode_cell(s)}:${encode_cell(e)}`; }
function decode_range(ref) {
  const [a, b] = ref.split(":");
  return { s: decode_cell(a), e: decode_cell(b || a) };
}

// ---------------------------------------------------------------------------
// Reading: .xlsx bytes -> {SheetNames, Sheets}
// ---------------------------------------------------------------------------

async function readWorkbook(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const entries = await readZip(bytes);
  const decode = (name) => (entries.has(name) ? new TextDecoder("utf-8").decode(entries.get(name)) : null);

  const workbookXmlText = decode("xl/workbook.xml");
  if (!workbookXmlText) throw new Error("This does not look like a valid .xlsx workbook.");
  const workbookXml = parseXml(workbookXmlText);

  const relsText = decode("xl/_rels/workbook.xml.rels");
  const relMap = {};
  if (relsText) {
    for (const rel of children(parseXml(relsText), "Relationship")) relMap[rel.attrs["Id"]] = rel.attrs["Target"];
  }

  const sharedStringsText = decode("xl/sharedStrings.xml");
  let sharedStrings = [];
  if (sharedStringsText) {
    const sstRoot = parseXml(sharedStringsText);
    sharedStrings = children(sstRoot, "si").map((si) => {
      const tNodes = children(si, "t");
      if (tNodes.length) return tNodes.map((t) => t.text).join("");
      // rich text run (<r><t>...</t></r>...)
      return children(si, "r").map((r) => child(r, "t")?.text || "").join("");
    });
  }

  const sheetNodes = children(child(workbookXml, "sheets"), "sheet");
  const SheetNames = [];
  const Sheets = {};

  sheetNodes.forEach((sheetNode, index) => {
    const name = sheetNode.attrs["name"] || `Sheet${index + 1}`;
    const rId = sheetNode.attrs["r:id"];
    const target = relMap[rId] || `worksheets/sheet${index + 1}.xml`;
    const path = `xl/${target.replace(/^\/?xl\//, "")}`;
    const sheetXmlText = decode(path);
    if (!sheetXmlText) return;

    const sheetXml = parseXml(sheetXmlText);
    const sheet = {};
    let maxR = 0, maxC = 0, any = false;

    for (const row of children(child(sheetXml, "sheetData"), "row")) {
      for (const c of children(row, "c")) {
        const ref = c.attrs["r"];
        if (!ref) continue;
        const { r, c: col } = decode_cell(ref);
        const type = c.attrs["t"];
        let v;
        if (type === "s") {
          const idx = Number(child(c, "v")?.text ?? "0");
          v = sharedStrings[idx] ?? "";
        } else if (type === "inlineStr") {
          v = child(child(c, "is"), "t")?.text ?? "";
        } else if (type === "str" || type === "b") {
          v = child(c, "v")?.text ?? "";
        } else {
          const raw = child(c, "v")?.text;
          v = raw === undefined || raw === "" ? undefined : Number(raw);
        }
        if (v === undefined) continue;
        sheet[encode_cell({ r, c: col })] = { v, t: typeof v === "number" ? "n" : "s" };
        maxR = Math.max(maxR, r); maxC = Math.max(maxC, col); any = true;
      }
    }

    if (any) sheet["!ref"] = encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    SheetNames.push(name);
    Sheets[name] = sheet;
  });

  return { SheetNames, Sheets };
}

// ---------------------------------------------------------------------------
// sheet_to_json (first row = headers, matches XLSX.utils.sheet_to_json
// with {defval, raw} used by the ported code)
// ---------------------------------------------------------------------------

function sheet_to_json(sheet, { defval = "", raw = true } = {}) {
  if (!sheet || !sheet["!ref"]) return [];
  const range = decode_range(sheet["!ref"]);
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[encode_cell({ r: range.s.r, c })];
    headers[c] = cell ? String(cell.v).trim() : "";
  }
  const rows = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const obj = {};
    let hasValue = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const header = headers[c];
      if (!header) continue;
      const cell = sheet[encode_cell({ r, c })];
      if (cell) { obj[header] = raw ? cell.v : String(cell.v); hasValue = true; }
      else obj[header] = defval;
    }
    if (hasValue) rows.push(obj);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Writing: book_new / aoa_to_sheet / book_append_sheet -> .xlsx bytes
// ---------------------------------------------------------------------------

function book_new() {
  return { SheetNames: [], Sheets: {}, Props: {} };
}

function aoa_to_sheet(aoa) {
  const sheet = {};
  let maxR = 0, maxC = 0, any = false;
  aoa.forEach((row, r) => {
    (row || []).forEach((val, c) => {
      if (val === undefined || val === null || val === "") return;
      const t = typeof val === "number" && Number.isFinite(val) ? "n" : "s";
      sheet[encode_cell({ r, c })] = { v: val, t };
      maxR = Math.max(maxR, r); maxC = Math.max(maxC, c); any = true;
    });
  });
  if (any) sheet["!ref"] = encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  return sheet;
}

function book_append_sheet(workbook, sheet, name) {
  const safeName = String(name).slice(0, 31);
  workbook.SheetNames.push(safeName);
  workbook.Sheets[safeName] = sheet;
}

function escapeXml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sheetToXml(sheet) {
  const ref = sheet["!ref"] || "A1:A1";
  const range = decode_range(ref);
  const rowsXml = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    let rowHasCell = false;
    let cellsXml = "";
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = encode_cell({ r, c });
      const cell = sheet[addr];
      if (!cell) continue;
      rowHasCell = true;
      if (cell.t === "n") {
        const styleIdx = cell.z === "#,##0.00" ? 1 : cell.z?.includes("AED") ? 2 : cell.z?.includes("₹") ? 3 : 0;
        cellsXml += `<c r="${addr}" s="${styleIdx}"><v>${cell.v}</v></c>`;
      } else {
        cellsXml += `<c r="${addr}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.v)}</t></is></c>`;
      }
    }
    if (rowHasCell) rowsXml.push(`<row r="${r + 1}">${cellsXml}</row>`);
  }

  let extras = "";
  if (sheet["!freeze"] && sheet["!freeze"].ySplit) {
    extras += `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet["!freeze"].ySplit}" topLeftCell="A${sheet["!freeze"].ySplit + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
  }
  let cols = "";
  if (sheet["!cols"]) {
    cols = `<cols>${sheet["!cols"].map((col, i) => `<col min="${i + 1}" max="${i + 1}" width="${col.wch}" customWidth="1"/>`).join("")}</cols>`;
  }
  let autofilter = "";
  if (sheet["!autofilter"]) {
    autofilter = `<autoFilter ref="${sheet["!autofilter"].ref}"/>`;
  }
  const print = sheet["!print"] || {};
  const printSetup = sheet["!print"] ? `<pageSetup orientation="${print.orientation || "portrait"}" fitToWidth="${print.fitToWidth || 1}" fitToHeight="0"/>` : "";
  const footer = sheet["!footer"] ? `<headerFooter><oddFooter>&amp;C${escapeXml(sheet["!footer"])}</oddFooter></headerFooter>` : "";
  const repeatRows = print.repeatRows ? `<printOptions horizontalCentered="0" verticalCentered="0"/>` : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${extras}${cols}<sheetData>${rowsXml.join("")}</sheetData>${autofilter}${repeatRows}${printSetup}${footer}</worksheet>`;
}

// ---------------------------------------------------------------------------
// ZIP writer (store method - simplest, no compression needed for these
// modestly-sized generated workbooks)
// ---------------------------------------------------------------------------

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const enc = new TextEncoder();
  for (const { name, data } of files) {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x21, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length + data.length;
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const c of centralParts) centralSize += c.length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of [...localParts, ...centralParts, eocd]) { out.set(part, p); p += part.length; }
  return out;
}

function workbookToXlsxBytes(workbook) {
  const enc = new TextEncoder();
  const files = [];

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${workbook.SheetNames.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  files.push({ name: "[Content_Types].xml", data: enc.encode(contentTypes) });

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  files.push({ name: "_rels/.rels", data: enc.encode(rootRels) });

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbook.SheetNames.map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;
  files.push({ name: "xl/workbook.xml", data: enc.encode(workbookXml) });

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbook.SheetNames.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${workbook.SheetNames.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  files.push({ name: "xl/_rels/workbook.xml.rels", data: enc.encode(workbookRels) });

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="[$AED] #,##0.00;[Red]-[$AED] #,##0.00"/><numFmt numFmtId="166" formatCode="[$₹-en-IN]#,##0.00;[Red]-[$₹-en-IN]#,##0.00"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`;
  files.push({ name: "xl/styles.xml", data: enc.encode(stylesXml) });

  workbook.SheetNames.forEach((name, i) => {
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(sheetToXml(workbook.Sheets[name])) });
  });

  const props = workbook.Props || {};
  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(props.Title || "")}</dc:title><dc:subject>${escapeXml(props.Subject || "")}</dc:subject><dc:creator>${escapeXml(props.Author || "")}</dc:creator><dc:description>${escapeXml(props.Comments || "")}</dc:description></cp:coreProperties>`;
  files.push({ name: "docProps/core.xml", data: enc.encode(coreXml) });

  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Company>${escapeXml(props.Company || "")}</Company></Properties>`;
  files.push({ name: "docProps/app.xml", data: enc.encode(appXml) });

  return buildStoredZip(files);
}

function triggerDownload(bytes, fileName) {
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Public shim - drop-in replacement for the subset of the global `XLSX`
// object referenced by the ported marketplace-*.js modules.
// ---------------------------------------------------------------------------

export const XLSX = {
  read(arrayBufferOrBytes) {
    // Synchronous signature to match SheetJS's XLSX.read(), but this shim's
    // actual parsing is async (DecompressionStream). Callers in this project
    // use `await readWorkbook(...)` directly instead - see marketplace-*.js.
    throw new Error("XLSX.read() is synchronous in SheetJS; use XLSX.readAsync() in this local shim.");
  },
  async readAsync(arrayBuffer) {
    return readWorkbook(arrayBuffer);
  },
  utils: {
    sheet_to_json,
    book_new,
    aoa_to_sheet,
    book_append_sheet,
    decode_range,
    encode_range,
    encode_cell,
  },
  writeFile(workbook, fileName) {
    triggerDownload(workbookToXlsxBytes(workbook), fileName);
  },
  writeBytes(workbook) {
    return workbookToXlsxBytes(workbook);
  },
  SSF: {
    parse_date_code(serial) {
      const d = new Date(Date.UTC(1899, 11, 30) + Number(serial) * 86400000);
      if (Number.isNaN(d.getTime())) return null;
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
    },
  },
};
