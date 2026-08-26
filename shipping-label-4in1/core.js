// Shipping Label 4-in-1 PDF â€” engine.
// Runs entirely client-side (or under Node for testing): parses the object/
// content-stream structure of each uploaded PDF by hand (same technique as
// ../pdf-to-word/core.js), then builds a brand-new PDF that places each
// source PAGE, byte-for-byte, as a vector Form XObject inside a quarter of
// an A4 sheet. No external libraries, no rasterization â€” barcodes, QR codes,
// fonts and text stay exactly as sharp as the source PDF.

const BYTE_ENCODING = "windows-1252"; // 1 byte <-> 1 char, safe for structural scanning

// ---------------------------------------------------------------------------
// Low-level PDF object model parsing (mirrors ../pdf-to-word/core.js)
// ---------------------------------------------------------------------------

function isWhitespace(ch) {
  return ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === "\f" || ch === "\0";
}
function isDelimiter(ch) {
  return "()<>[]{}/%".includes(ch);
}

function parseValue(s, pos) {
  pos = skipWs(s, pos);
  const ch = s[pos];
  if (ch === undefined) return [null, pos];
  if (ch === "<" && s[pos + 1] === "<") return parseDict(s, pos);
  if (ch === "<") return parseHexString(s, pos);
  if (ch === "(") return parseLiteralString(s, pos);
  if (ch === "/") return parseName(s, pos);
  if (ch === "[") return parseArray(s, pos);
  if (/[0-9+\-.]/.test(ch)) return parseNumberOrRef(s, pos);
  if (s.startsWith("true", pos)) return [true, pos + 4];
  if (s.startsWith("false", pos)) return [false, pos + 5];
  if (s.startsWith("null", pos)) return [null, pos + 4];
  let p = pos;
  while (p < s.length && !isWhitespace(s[p]) && !isDelimiter(s[p])) p++;
  return [{ raw: s.slice(pos, Math.max(p, pos + 1)) }, Math.max(p, pos + 1)];
}

function skipWs(s, pos) {
  for (;;) {
    while (pos < s.length && isWhitespace(s[pos])) pos++;
    if (s[pos] === "%") {
      while (pos < s.length && s[pos] !== "\n" && s[pos] !== "\r") pos++;
      continue;
    }
    return pos;
  }
}

function parseDict(s, pos) {
  pos += 2; // skip <<
  const dict = {};
  for (;;) {
    pos = skipWs(s, pos);
    if (s.startsWith(">>", pos)) return [dict, pos + 2];
    if (pos >= s.length) return [dict, pos];
    if (s[pos] !== "/") {
      pos++;
      continue;
    }
    const [key, p1] = parseName(s, pos);
    const [val, p2] = parseValue(s, p1);
    dict[key] = val;
    pos = p2;
  }
}

function parseArray(s, pos) {
  pos += 1;
  const arr = [];
  for (;;) {
    pos = skipWs(s, pos);
    if (s[pos] === "]") return [arr, pos + 1];
    if (pos >= s.length) return [arr, pos];
    const [val, p2] = parseValue(s, pos);
    arr.push(val);
    pos = p2;
  }
}

function parseName(s, pos) {
  pos += 1; // skip /
  let out = "";
  while (pos < s.length && !isWhitespace(s[pos]) && !isDelimiter(s[pos])) {
    if (s[pos] === "#" && /[0-9A-Fa-f]{2}/.test(s.slice(pos + 1, pos + 3))) {
      out += String.fromCharCode(parseInt(s.slice(pos + 1, pos + 3), 16));
      pos += 3;
    } else {
      out += s[pos];
      pos++;
    }
  }
  return ["/" + out, pos];
}

function parseHexString(s, pos) {
  pos += 1;
  let start = pos;
  while (pos < s.length && s[pos] !== ">") pos++;
  let hex = s.slice(start, pos).replace(/[^0-9A-Fa-f]/g, "");
  if (hex.length % 2) hex += "0";
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  return [{ isString: true, bytes }, pos + 1];
}

function parseLiteralString(s, pos) {
  pos += 1;
  let depth = 1;
  const bytes = [];
  while (pos < s.length && depth > 0) {
    const ch = s[pos];
    if (ch === "\\") {
      const next = s[pos + 1];
      if (next === "n") { bytes.push(10); pos += 2; }
      else if (next === "r") { bytes.push(13); pos += 2; }
      else if (next === "t") { bytes.push(9); pos += 2; }
      else if (next === "b") { bytes.push(8); pos += 2; }
      else if (next === "f") { bytes.push(12); pos += 2; }
      else if (next === "(") { bytes.push(40); pos += 2; }
      else if (next === ")") { bytes.push(41); pos += 2; }
      else if (next === "\\") { bytes.push(92); pos += 2; }
      else if (next === "\r" || next === "\n") {
        pos += next === "\r" && s[pos + 2] === "\n" ? 3 : 2;
      } else if (/[0-7]/.test(next)) {
        let oct = "";
        pos += 1;
        for (let i = 0; i < 3 && /[0-7]/.test(s[pos]); i++) { oct += s[pos]; pos++; }
        bytes.push(parseInt(oct, 8) & 0xff);
      } else {
        bytes.push(next.charCodeAt(0));
        pos += 2;
      }
      continue;
    }
    if (ch === "(") { depth++; bytes.push(40); pos++; continue; }
    if (ch === ")") { depth--; pos++; if (depth === 0) break; bytes.push(41); continue; }
    bytes.push(ch.charCodeAt(0) & 0xff);
    pos++;
  }
  return [{ isString: true, bytes }, pos];
}

function parseNumberOrRef(s, pos) {
  const m = /^[+\-]?\d+(\.\d+)?|^[+\-]?\.\d+/.exec(s.slice(pos));
  if (!m) return [0, pos + 1];
  const numText = m[0];
  let next = pos + numText.length;
  const after = skipWs(s, next);
  if (!Number.isNaN(Number(numText)) && Number.isInteger(Number(numText))) {
    const genMatch = /^(\d+)\s+R\b/.exec(s.slice(after));
    if (genMatch) {
      return [{ ref: Number(numText), gen: Number(genMatch[1]) }, after + genMatch[0].length];
    }
  }
  return [Number(numText), next];
}

function scanObjects(text, bytes) {
  const objects = new Map();
  const starts = [];
  const startRe = /(\d+)[ \t]+(\d+)[ \t]+obj\b/g;
  let m;
  while ((m = startRe.exec(text))) {
    starts.push({ num: Number(m[1]), bodyStart: m.index + m[0].length, matchStart: m.index });
  }
  for (let i = 0; i < starts.length; i++) {
    const cur = starts[i];
    const boundary = i + 1 < starts.length ? starts[i + 1].matchStart : text.length;
    let endIdx = text.indexOf("endobj", cur.bodyStart);
    if (endIdx === -1 || endIdx > boundary) endIdx = boundary;
    const body = text.slice(cur.bodyStart, endIdx);
    const [dict] = parseValue(body, 0);
    let stream = null;
    const streamIdx = body.indexOf("stream");
    if (streamIdx !== -1 && dict && typeof dict === "object" && !Array.isArray(dict)) {
      let sPos = cur.bodyStart + streamIdx + "stream".length;
      if (text[sPos] === "\r" && text[sPos + 1] === "\n") sPos += 2;
      else if (text[sPos] === "\n") sPos += 1;
      let length = dict["/Length"];
      if (length && typeof length === "object" && "ref" in length) {
        length = null;
      }
      let endStreamIdx = text.indexOf("endstream", sPos);
      let sEnd = typeof length === "number" ? sPos + length : endStreamIdx;
      if (typeof length === "number") {
        const check = text.slice(sPos + length, sPos + length + 20);
        if (!/^\s*endstream/.test(check)) sEnd = endStreamIdx === -1 ? boundary : endStreamIdx;
      }
      if (sEnd === -1) sEnd = boundary;
      stream = { byteStart: sPos, byteEnd: sEnd, lengthRef: length === null ? dict["/Length"] : null };
    }
    objects.set(cur.num, { dict, stream });
  }
  for (const obj of objects.values()) {
    if (obj.stream && obj.stream.lengthRef) {
      const target = objects.get(obj.stream.lengthRef.ref);
      const len = target && typeof target.dict === "number" ? target.dict : null;
      if (typeof len === "number") {
        obj.stream.byteEnd = obj.stream.byteStart + len;
      }
    }
  }
  return objects;
}

function resolve(objects, val) {
  if (val && typeof val === "object" && "ref" in val && !Array.isArray(val)) {
    const target = objects.get(val.ref);
    return target ? target.dict : null;
  }
  return val;
}

async function inflate(bytes, format) {
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return new Uint8Array(0);
  }
}

function asciiHexDecode(bytes) {
  const text = String.fromCharCode(...bytes).split(">")[0].replace(/[^0-9A-Fa-f]/g, "");
  const out = new Uint8Array(Math.ceil(text.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(text.slice(i * 2, i * 2 + 2).padEnd(2, "0"), 16);
  return out;
}

function ascii85Decode(bytes) {
  const text = String.fromCharCode(...bytes).replace(/~>$/, "");
  const out = [];
  let group = [];
  for (const ch of text) {
    if (ch === "z" && group.length === 0) { out.push(0, 0, 0, 0); continue; }
    if (ch.charCodeAt(0) < 33 || ch.charCodeAt(0) > 117) continue;
    group.push(ch.charCodeAt(0) - 33);
    if (group.length === 5) {
      let val = 0;
      for (const g of group) val = val * 85 + g;
      out.push((val >>> 24) & 0xff, (val >>> 16) & 0xff, (val >>> 8) & 0xff, val & 0xff);
      group = [];
    }
  }
  if (group.length > 1) {
    const n = group.length;
    while (group.length < 5) group.push(84);
    let val = 0;
    for (const g of group) val = val * 85 + g;
    const full = [(val >>> 24) & 0xff, (val >>> 16) & 0xff, (val >>> 8) & 0xff, val & 0xff];
    out.push(...full.slice(0, n - 1));
  }
  return new Uint8Array(out);
}

// Decodes a stream object's content to raw bytes. Only used for the (rare)
// case of a page whose /Contents is an array of several stream objects,
// which must be concatenated as plain operator text before re-embedding.
// The common single-stream case never calls this - it copies the original
// compressed bytes untouched instead, for maximum fidelity and speed.
async function decodeStream(bytes, obj) {
  if (!obj.stream) return new Uint8Array(0);
  const raw = bytes.subarray(obj.stream.byteStart, Math.max(obj.stream.byteStart, obj.stream.byteEnd));
  let filters = obj.dict["/Filter"];
  if (!filters) return raw;
  if (!Array.isArray(filters)) filters = [filters];
  let data = raw;
  for (const f of filters) {
    const name = typeof f === "string" ? f : "";
    if (name === "/FlateDecode" || name === "/Fl") {
      data = await inflate(data, "deflate");
    } else if (name === "/ASCIIHexDecode" || name === "/AHx") {
      data = asciiHexDecode(data);
    } else if (name === "/ASCII85Decode" || name === "/A85") {
      data = ascii85Decode(data);
    } else {
      return new Uint8Array(0); // unsupported filter - skip rather than corrupt
    }
  }
  return data;
}

function findCatalog(objects) {
  for (const obj of objects.values()) {
    if (obj.dict && obj.dict["/Type"] === "/Catalog") return obj.dict;
  }
  return null;
}

function collectPages(objects) {
  const catalog = findCatalog(objects);
  const ordered = [];
  const seen = new Set();
  function walk(nodeRef, depth) {
    if (depth > 64 || !nodeRef) return;
    const node = nodeRef && typeof nodeRef === "object" && "ref" in nodeRef ? objects.get(nodeRef.ref) : null;
    if (!node || !node.dict || seen.has(nodeRef.ref)) return;
    seen.add(nodeRef.ref);
    const dict = node.dict;
    if (dict["/Type"] === "/Page") { ordered.push({ ref: nodeRef.ref, dict }); return; }
    if (Array.isArray(dict["/Kids"])) {
      for (const kid of dict["/Kids"]) walk(kid, depth + 1);
    }
  }
  if (catalog && catalog["/Pages"]) walk(catalog["/Pages"], 0);
  if (ordered.length) return ordered;
  const fallback = [];
  for (const [num, obj] of [...objects.entries()].sort((a, b) => a[0] - b[0])) {
    if (obj.dict && obj.dict["/Type"] === "/Page") fallback.push({ ref: num, dict: obj.dict });
  }
  return fallback;
}

function inheritedResources(objects, pageDict) {
  let d = pageDict;
  let depth = 0;
  while (d && depth < 64) {
    if (d["/Resources"]) return resolve(objects, d["/Resources"]) || {};
    const parent = d["/Parent"];
    d = parent && typeof parent === "object" && "ref" in parent ? objects.get(parent.ref)?.dict : null;
    depth++;
  }
  return {};
}

function inheritedMediaBox(objects, pageDict) {
  let d = pageDict;
  let depth = 0;
  while (d && depth < 64) {
    if (d["/MediaBox"]) {
      const raw = resolve(objects, d["/MediaBox"]);
      if (Array.isArray(raw) && raw.length === 4) {
        const nums = raw.map((v) => { const r = resolve(objects, v); return typeof r === "number" ? r : 0; });
        return [Math.min(nums[0], nums[2]), Math.min(nums[1], nums[3]), Math.max(nums[0], nums[2]), Math.max(nums[1], nums[3])];
      }
    }
    const parent = d["/Parent"];
    d = parent && typeof parent === "object" && "ref" in parent ? objects.get(parent.ref)?.dict : null;
    depth++;
  }
  return [0, 0, 595.28, 841.89]; // fall back to A4
}

function inheritedRotate(objects, pageDict) {
  let d = pageDict;
  let depth = 0;
  while (d && depth < 64) {
    if (d["/Rotate"] !== undefined) {
      const r = resolve(objects, d["/Rotate"]);
      if (typeof r === "number") return r;
    }
    const parent = d["/Parent"];
    d = parent && typeof parent === "object" && "ref" in parent ? objects.get(parent.ref)?.dict : null;
    depth++;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Document parsing entry point
// ---------------------------------------------------------------------------

export async function parsePdfDocument(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const text = new TextDecoder(BYTE_ENCODING).decode(bytes);
  if (!text.startsWith("%PDF-")) throw Object.assign(new Error("This file does not look like a valid PDF."), { code: "NOT_PDF" });

  const objects = scanObjects(text, bytes);
  if (!objects.size) throw Object.assign(new Error("No readable content was found in this PDF."), { code: "EMPTY" });

  for (const obj of objects.values()) {
    if (obj.dict && obj.dict["/Type"] === "/Encrypt") {
      throw Object.assign(new Error("This PDF is password-protected or encrypted and can't be processed in the browser."), { code: "ENCRYPTED" });
    }
  }
  if (/trailer[\s\S]*?\/Encrypt/.test(text)) {
    throw Object.assign(new Error("This PDF is password-protected or encrypted and can't be processed in the browser."), { code: "ENCRYPTED" });
  }

  const pages = collectPages(objects);
  if (!pages.length) throw Object.assign(new Error("No pages could be found in this PDF."), { code: "NO_PAGES" });

  return { objects, bytes, pages, cache: new Map() };
}

/** Lightweight helper for the upload UI: how many shipping slips are in this file. */
export async function getPageCount(arrayBuffer) {
  const doc = await parsePdfDocument(arrayBuffer);
  return doc.pages.length;
}

// ---------------------------------------------------------------------------
// PDF object graph deep-copy (source objects -> new document's object space)
// ---------------------------------------------------------------------------

function createBuilder() {
  const objects = new Map(); // num -> { dict, streamBytes }
  let nextNum = 1;
  return {
    reserve() {
      return nextNum++;
    },
    setObject(num, dict, streamBytes) {
      const finalDict = dict && typeof dict === "object" && !Array.isArray(dict) ? dict : {};
      if (streamBytes != null) finalDict["/Length"] = streamBytes.length;
      objects.set(num, { dict: finalDict, streamBytes: streamBytes || null });
    },
    addObject(dict, streamBytes) {
      const num = nextNum++;
      this.setObject(num, dict, streamBytes);
      return num;
    },
    get maxNum() {
      return nextNum - 1;
    },
    entries() {
      return objects;
    },
  };
}

// Recursively copies a value from a source document into the builder's new
// object space, following indirect references (and copying their targets)
// so the new document is fully self-contained. Names/numbers/strings/arrays/
// dicts are copied structurally; only {ref} markers trigger a subgraph copy.
function transformValue(sourceCtx, builder, val) {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val.map((v) => transformValue(sourceCtx, builder, v));
  if (typeof val === "object") {
    if (val.isString) return val;
    if (val.raw !== undefined) return val;
    if ("ref" in val) return { ref: copySubgraph(sourceCtx, builder, val.ref), gen: 0 };
    const out = {};
    for (const k of Object.keys(val)) out[k] = transformValue(sourceCtx, builder, val[k]);
    return out;
  }
  return val; // number, name-string, boolean
}

// Copies one indirect object (and, transitively, everything it references)
// from the source document into the new document. Reserves the new object
// number before recursing so cyclic references can't cause infinite loops,
// and caches per-source so shared resources (e.g. a font used by every page
// of a multi-page label PDF) are embedded once, not once per slip.
function copySubgraph(sourceCtx, builder, sourceNum) {
  if (sourceCtx.cache.has(sourceNum)) return sourceCtx.cache.get(sourceNum);
  const newNum = builder.reserve();
  sourceCtx.cache.set(sourceNum, newNum);
  const obj = sourceCtx.objects.get(sourceNum);
  if (!obj) {
    builder.setObject(newNum, {}, null);
    return newNum;
  }
  const newDict = transformValue(sourceCtx, builder, obj.dict);
  let streamBytes = null;
  if (obj.stream) {
    streamBytes = sourceCtx.bytes.slice(obj.stream.byteStart, Math.max(obj.stream.byteStart, obj.stream.byteEnd));
  }
  builder.setObject(newNum, newDict, streamBytes);
  return newNum;
}

// ---------------------------------------------------------------------------
// Rotation compensation
// ---------------------------------------------------------------------------

function normalizeRotate(deg) {
  const r = ((Math.round(deg || 0) % 360) + 360) % 360;
  return Math.round(r / 90) * 90 % 360;
}

// Maps a source page's own (unrotated) content-stream coordinate space onto
// a Form XObject's parent space so it displays with the same orientation
// /Rotate asks a normal PDF viewer to apply, with the result's origin moved
// to (0,0) and no negative coordinates - ready to scale straight into an A4
// quadrant. [a b c d e f] per PDF 32000-1 8.3.4: x'=a*x+c*y+e, y'=b*x+d*y+f.
function rotationMatrix(mediabox, rotate) {
  const [x0, y0, x1, y1] = mediabox;
  const W = x1 - x0;
  const H = y1 - y0;
  switch (rotate) {
    case 90: return [0, -1, 1, 0, -y0, W + x0];
    case 180: return [-1, 0, 0, -1, W + x0, H + y0];
    case 270: return [0, 1, -1, 0, H + y0, -x0];
    default: return [1, 0, 0, 1, -x0, -y0];
  }
}

function effectiveSize(mediabox, rotate) {
  const W = mediabox[2] - mediabox[0];
  const H = mediabox[3] - mediabox[1];
  return rotate === 90 || rotate === 270 ? { effW: H, effH: W } : { effW: W, effH: H };
}

// The physical source label is always the complete inherited MediaBox. Never
// substitute CropBox/TrimBox/ArtBox or a content-derived bounding box: blank
// space inside the page is part of the shipping label's original layout.
export function sourcePageGeometry(objects, pageDict) {
  const pageBox = inheritedMediaBox(objects, pageDict);
  const rotate = normalizeRotate(inheritedRotate(objects, pageDict));
  const { effW, effH } = effectiveSize(pageBox, rotate);
  if (!(effW > 0 && effH > 0)) throw Object.assign(new Error("The source PDF page has an invalid MediaBox."), { code: "INVALID_PAGE_BOX" });
  return { pageBox, rotate, effW, effH };
}

// ---------------------------------------------------------------------------
// A4 4-up layout
// ---------------------------------------------------------------------------

export const A4_WIDTH = 595.28; // 210mm in points
export const A4_HEIGHT = 841.89; // 297mm in points
export const PAGE_MARGIN = 20; // outer margin, points
export const SLOT_GAP = 14; // gap between the four slots, points

const COL_W = (A4_WIDTH - 2 * PAGE_MARGIN - SLOT_GAP) / 2;
const ROW_H = (A4_HEIGHT - 2 * PAGE_MARGIN - SLOT_GAP) / 2;
const TOP_Y = A4_HEIGHT - PAGE_MARGIN - ROW_H;

// Slot order is fixed: 0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right.
export function slotBox(index) {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: PAGE_MARGIN + col * (COL_W + SLOT_GAP),
    y: row === 0 ? TOP_Y : PAGE_MARGIN,
    w: COL_W,
    h: ROW_H,
  };
}

// Proportionally fits a effW x effH box into a slot, preserving aspect ratio
// and centring it - never stretches, crops, or overflows the slot.
export function computePlacement(effW, effH, box) {
  const scale = Math.min(box.w / effW, box.h / effH);
  const placedW = effW * scale;
  const placedH = effH * scale;
  return {
    scale,
    placedW,
    placedH,
    offX: box.x + (box.w - placedW) / 2,
    offY: box.y + (box.h - placedH) / 2,
  };
}

// ---------------------------------------------------------------------------
// PDF value serialization (writer side)
// ---------------------------------------------------------------------------

function formatNumber(n) {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  let s = n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return s === "" || s === "-" ? "0" : s;
}

function serializeName(name) {
  let out = "/";
  for (const ch of name.slice(1)) {
    const code = ch.codePointAt(0);
    if (code < 33 || code > 126 || "()<>[]{}/%#".includes(ch)) {
      out += "#" + code.toString(16).padStart(2, "0");
    } else {
      out += ch;
    }
  }
  return out;
}

function serializeHexString(bytes) {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return "<" + hex + ">";
}

function serializeValue(val) {
  if (val === null || val === undefined) return "null";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return formatNumber(val);
  if (typeof val === "string") return val[0] === "/" ? serializeName(val) : val;
  if (Array.isArray(val)) return "[" + val.map(serializeValue).join(" ") + "]";
  if (val.isString) return serializeHexString(val.bytes);
  if (val.raw !== undefined) return val.raw;
  if ("ref" in val) return `${val.ref} 0 R`;
  const parts = [];
  for (const k of Object.keys(val)) parts.push(serializeName(k) + " " + serializeValue(val[k]));
  return "<< " + parts.join(" ") + " >>";
}

// Assembles the finished PDF file (classic cross-reference table) from every
// object the builder has accumulated.
function writePdf(builder, rootNum) {
  const encoder = new TextEncoder();
  const chunks = [];
  let offset = 0;
  const push = (data) => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    chunks.push(bytes);
    offset += bytes.length;
  };

  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // %PDF-1.7\n%<binary>\n

  const maxNum = builder.maxNum;
  const entries = builder.entries();
  const offsets = new Array(maxNum + 1).fill(0);
  for (let num = 1; num <= maxNum; num++) {
    offsets[num] = offset;
    const entry = entries.get(num) || { dict: {}, streamBytes: null };
    push(`${num} 0 obj\n${serializeValue(entry.dict)}\n`);
    if (entry.streamBytes) {
      push("stream\n");
      push(entry.streamBytes);
      push("\nendstream\n");
    }
    push("endobj\n");
  }

  const xrefOffset = offset;
  push(`xref\n0 ${maxNum + 1}\n0000000000 65535 f \n`);
  for (let num = 1; num <= maxNum; num++) {
    push(offsets[num].toString().padStart(10, "0") + " 00000 n \n");
  }
  push(`trailer\n<< /Size ${maxNum + 1} /Root ${rootNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}

// ---------------------------------------------------------------------------
// Embedding one source page as a Form XObject
// ---------------------------------------------------------------------------

async function embedSlipAsForm(builder, sourceCtx, pageDict) {
  const { pageBox, rotate, effW, effH } = sourcePageGeometry(sourceCtx.objects, pageDict);
  const resources = inheritedResources(sourceCtx.objects, pageDict);
  const newResources = transformValue(sourceCtx, builder, resources);

  let contentBytes;
  let filterVal = null;
  let decodeParmsVal = null;
  const contentsVal = pageDict["/Contents"];

  if (contentsVal && typeof contentsVal === "object" && !Array.isArray(contentsVal) && "ref" in contentsVal) {
    // Common case: a single content stream - copy its original (still
    // compressed) bytes untouched for maximum fidelity and speed.
    const obj = sourceCtx.objects.get(contentsVal.ref);
    if (obj && obj.stream) {
      contentBytes = sourceCtx.bytes.slice(obj.stream.byteStart, Math.max(obj.stream.byteStart, obj.stream.byteEnd));
      filterVal = obj.dict["/Filter"] || null;
      decodeParmsVal = obj.dict["/DecodeParms"] || obj.dict["/DP"] || null;
    } else {
      contentBytes = new Uint8Array(0);
    }
  } else if (Array.isArray(contentsVal)) {
    // Multiple content streams: must decode and concatenate as operator
    // text, since each may be independently (and differently) compressed.
    const parts = [];
    for (const ref of contentsVal) {
      const obj = ref && typeof ref === "object" && "ref" in ref ? sourceCtx.objects.get(ref.ref) : null;
      if (obj) {
        parts.push(await decodeStream(sourceCtx.bytes, obj));
        parts.push(new Uint8Array([0x0a]));
      }
    }
    let total = 0;
    for (const p of parts) total += p.length;
    contentBytes = new Uint8Array(total);
    let off = 0;
    for (const p of parts) { contentBytes.set(p, off); off += p.length; }
  } else {
    contentBytes = new Uint8Array(0);
  }

  const formDict = {
    "/Type": "/XObject",
    "/Subtype": "/Form",
    "/FormType": 1,
    "/BBox": pageBox,
    "/Matrix": rotationMatrix(pageBox, rotate),
    "/Resources": newResources,
  };
  if (filterVal) formDict["/Filter"] = transformValue(sourceCtx, builder, filterVal);
  if (decodeParmsVal) formDict["/DecodeParms"] = transformValue(sourceCtx, builder, decodeParmsVal);

  const formNum = builder.addObject(formDict, contentBytes);
  return { formNum, effW, effH };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Builds one printable A4 PDF containing every page of every input PDF,
 * four per sheet (top-left, top-right, bottom-left, bottom-right; a partial
 * final sheet only fills the leading slots and leaves the rest blank).
 *
 * @param {{name:string, bytes:Uint8Array|ArrayBuffer}[]} files
 * @param {{onProgress?: (currentSheet:number, totalSheets:number)=>void}} [opts]
 */
export async function buildFourInOnePdf(files, { onProgress } = {}) {
  if (!files || !files.length) {
    throw Object.assign(new Error("Add at least one shipping-label PDF first."), { code: "NO_FILES" });
  }

  const slips = [];
  for (const file of files) {
    let doc;
    try {
      doc = await parsePdfDocument(file.bytes);
    } catch (err) {
      throw Object.assign(new Error(`"${file.name}": ${err.message}`), { code: err.code || "PARSE_ERROR" });
    }
    for (const page of doc.pages) {
      slips.push({ sourceCtx: doc, pageDict: page.dict });
    }
  }
  if (!slips.length) {
    throw Object.assign(new Error("No pages were found in the selected PDFs."), { code: "NO_PAGES" });
  }

  const builder = createBuilder();
  const catalogNum = builder.reserve();
  const pagesNum = builder.reserve();
  const kids = [];
  const totalSheets = Math.ceil(slips.length / 4);

  for (let i = 0; i < slips.length; i += 4) {
    const group = slips.slice(i, i + 4);
    onProgress?.(Math.floor(i / 4) + 1, totalSheets);

    const xobjectDict = {};
    const contentLines = [];
    for (let slot = 0; slot < group.length; slot++) {
      const slip = group[slot];
      const { formNum, effW, effH } = await embedSlipAsForm(builder, slip.sourceCtx, slip.pageDict);
      const box = slotBox(slot);
      const { scale, offX, offY } = computePlacement(effW, effH, box);
      const name = `S${slot}`;
      xobjectDict["/" + name] = { ref: formNum, gen: 0 };
      // Clip only to the destination slot. The embedded Form's BBox remains
      // the complete source MediaBox, including every blank/white area.
      contentLines.push(`q ${formatNumber(box.x)} ${formatNumber(box.y)} ${formatNumber(box.w)} ${formatNumber(box.h)} re W n\nq ${formatNumber(scale)} 0 0 ${formatNumber(scale)} ${formatNumber(offX)} ${formatNumber(offY)} cm /${name} Do Q\nQ`);
    }

    const contentBytes = new TextEncoder().encode(contentLines.join("\n") + "\n");
    const contentNum = builder.addObject({}, contentBytes);
    const pageDict = {
      "/Type": "/Page",
      "/Parent": { ref: pagesNum, gen: 0 },
      "/MediaBox": [0, 0, A4_WIDTH, A4_HEIGHT],
      "/Resources": { "/XObject": xobjectDict, "/ProcSet": ["/PDF"] },
      "/Contents": { ref: contentNum, gen: 0 },
    };
    const pageNum = builder.addObject(pageDict, null);
    kids.push({ ref: pageNum, gen: 0 });
  }

  builder.setObject(pagesNum, { "/Type": "/Pages", "/Kids": kids, "/Count": kids.length }, null);
  builder.setObject(catalogNum, { "/Type": "/Catalog", "/Pages": { ref: pagesNum, gen: 0 } }, null);

  const bytes = writePdf(builder, catalogNum);
  return { bytes, slipCount: slips.length, pageCount: kids.length };
}
