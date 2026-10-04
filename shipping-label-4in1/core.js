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
      let finalDict = dict;
      if (streamBytes != null) {
        finalDict = dict && typeof dict === "object" && !Array.isArray(dict) ? { ...dict } : {};
        finalDict["/Length"] = streamBytes.length;
      }
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
// Flipkart: crop the shipping label away from the Tax Invoice below it
// ---------------------------------------------------------------------------
// A Flipkart label PDF is one A4 page: the bordered shipping label at the top,
// then a dashed cut line and the Tax Invoice. Only for a confidently detected
// Flipkart page, the label's own drawn border is located and used as the
// source region; content entirely outside it (the invoice) is dropped from the
// copied content stream. Every other format keeps the complete MediaBox.

const FLIPKART_RULE_THICKNESS = 2.5; // border rules are drawn as ~0.75pt filled bars
const FLIPKART_PAD = 1; // keep the border's full stroke, nothing more
const FLIPKART_SLOT_MARGIN = 4; // safe print margin inside the quadrant border

const multiply = (m, n) => [
  m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function bytesToLatin1(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return out;
}

function hexToUnicode(hex) {
  let out = "";
  for (let i = 0; i + 4 <= hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return out;
}

// ToUnicode CMap: bfchar and bfrange entries -> code -> text.
function parseToUnicode(text) {
  const map = new Map();
  let codeBytes = 1;
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) {
      codeBytes = Math.max(codeBytes, m[1].length / 2);
      map.set(parseInt(m[1], 16), hexToUnicode(m[2]));
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]*>|\[[^\]]*\])/g)) {
      codeBytes = Math.max(codeBytes, m[1].length / 2);
      const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16);
      if (hi - lo > 65535) continue;
      if (m[3][0] === "[") {
        const items = [...m[3].matchAll(/<([0-9A-Fa-f]*)>/g)];
        items.forEach((item, i) => map.set(lo + i, hexToUnicode(item[1])));
      } else {
        const base = m[3].slice(1, -1);
        const first = hexToUnicode(base);
        for (let code = lo; code <= hi; code++) {
          map.set(code, first.slice(0, -1) + String.fromCharCode(first.charCodeAt(first.length - 1) + (code - lo)));
        }
      }
    }
  }
  return { map, codeBytes };
}

// Embedded TrueType 'cmap' table, inverted to glyph id -> character. Used for
// Identity-H fonts that carry no ToUnicode map (e.g. a label re-saved by iOS).
function trueTypeGlyphToUnicode(font) {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const u16 = (o) => view.getUint16(o), u32 = (o) => view.getUint32(o);
  const glyphs = new Map();
  let cmap = -1;
  for (let i = 0, n = u16(4); i < n; i++) {
    const rec = 12 + i * 16;
    if (String.fromCharCode(font[rec], font[rec + 1], font[rec + 2], font[rec + 3]) === "cmap") cmap = u32(rec + 8);
  }
  if (cmap < 0) return glyphs;
  const subtables = [];
  for (let i = 0, n = u16(cmap + 2); i < n; i++) {
    const rec = cmap + 4 + i * 8;
    subtables.push({ platform: u16(rec), encoding: u16(rec + 2), offset: cmap + u32(rec + 4) });
  }
  const rank = (t) => (t.platform === 3 && t.encoding === 10 ? 0 : t.platform === 3 && t.encoding === 1 ? 1 : t.platform === 0 ? 2 : 3);
  for (const table of subtables.sort((a, b) => rank(a) - rank(b))) {
    const o = table.offset, format = u16(o);
    const set = (gid, code) => { if (gid && !glyphs.has(gid)) glyphs.set(gid, String.fromCodePoint(code)); };
    if (format === 4) {
      const segs = u16(o + 6) / 2, ends = o + 14, starts = ends + segs * 2 + 2, deltas = starts + segs * 2, ranges = deltas + segs * 2;
      for (let s = 0; s < segs; s++) {
        const end = u16(ends + s * 2), start = u16(starts + s * 2), delta = view.getInt16(deltas + s * 2), rangeOffset = u16(ranges + s * 2);
        for (let code = start; code <= end && code !== 0xffff; code++) {
          let gid;
          if (!rangeOffset) gid = (code + delta) & 0xffff;
          else {
            const at = ranges + s * 2 + rangeOffset + (code - start) * 2;
            gid = at + 1 < font.length ? u16(at) : 0;
            if (gid) gid = (gid + delta) & 0xffff;
          }
          set(gid, code);
        }
      }
    } else if (format === 12) {
      for (let g = 0, n = u32(o + 12); g < n; g++) {
        const rec = o + 16 + g * 12, start = u32(rec), end = u32(rec + 4), gid = u32(rec + 8);
        for (let code = start; code <= end && code - start < 65536; code++) set(gid + code - start, code);
      }
    } else if (format === 0) {
      for (let code = 0; code < 256; code++) set(font[o + 6 + code], code);
    } else if (format === 6) {
      const first = u16(o + 6);
      for (let i = 0, n = u16(o + 8); i < n; i++) set(u16(o + 10 + i * 2), first + i);
    }
  }
  return glyphs;
}

async function fontDecoder(sourceCtx, fontRef) {
  const { objects, bytes } = sourceCtx;
  const font = resolve(objects, fontRef) || {};
  const type0 = font["/Subtype"] === "/Type0";
  const decoder = { codeBytes: type0 ? 2 : 1, map: new Map(), widths: new Map(), defaultWidth: type0 ? 1000 : 500 };
  const toUnicode = font["/ToUnicode"];
  if (toUnicode && typeof toUnicode === "object" && "ref" in toUnicode) {
    const parsed = parseToUnicode(bytesToLatin1(await decodeStream(bytes, objects.get(toUnicode.ref))));
    decoder.map = parsed.map;
    if (!type0) decoder.codeBytes = parsed.codeBytes;
  }
  if (type0) {
    const descendants = resolve(objects, font["/DescendantFonts"]);
    const cid = resolve(objects, Array.isArray(descendants) ? descendants[0] : null) || {};
    decoder.defaultWidth = typeof cid["/DW"] === "number" ? cid["/DW"] : 1000;
    const w = resolve(objects, cid["/W"]);
    if (Array.isArray(w)) {
      for (let i = 0; i < w.length;) {
        const first = resolve(objects, w[i]), next = resolve(objects, w[i + 1]);
        if (Array.isArray(next)) { next.forEach((v, k) => decoder.widths.set(first + k, resolve(objects, v))); i += 2; }
        else { for (let c = first; c <= next; c++) decoder.widths.set(c, resolve(objects, w[i + 2])); i += 3; }
      }
    }
    if (!decoder.map.size) {
      const descriptor = resolve(objects, cid["/FontDescriptor"]) || {};
      const file = descriptor["/FontFile2"];
      const identity = !cid["/CIDToGIDMap"] || cid["/CIDToGIDMap"] === "/Identity";
      if (identity && file && typeof file === "object" && "ref" in file) {
        const fontBytes = await decodeStream(bytes, objects.get(file.ref));
        if (fontBytes.length > 12) decoder.map = trueTypeGlyphToUnicode(fontBytes);
      }
    }
  } else {
    const first = resolve(objects, font["/FirstChar"]), widths = resolve(objects, font["/Widths"]);
    if (typeof first === "number" && Array.isArray(widths)) widths.forEach((v, k) => decoder.widths.set(first + k, resolve(objects, v)));
    if (!decoder.map.size) for (let c = 32; c < 256; c++) decoder.map.set(c, String.fromCharCode(c));
  }
  return decoder;
}

// Minimal content-stream tokenizer: yields operands and operators with their
// source offsets so individual painting operators can be removed later.
function* contentTokens(s) {
  const number = /[+\-]?(?:\d+\.?\d*|\.\d+)/y, name = /\/[^\s()<>\[\]{}\/%]*/y, word = /[A-Za-z'"][A-Za-z0-9*'"]*/y;
  let pos = 0;
  const stack = [];
  let operands = [], operandStart = -1;
  while (pos < s.length) {
    pos = skipWs(s, pos);
    if (pos >= s.length) break;
    const start = pos, ch = s[pos];
    let value;
    if (ch === "[") { stack.push({ operands, operandStart }); operands = []; operandStart = -1; pos++; if (stack.length === 1) stack[0].arrayStart = start; continue; }
    if (ch === "]") {
      const frame = stack.pop(); pos++;
      if (!frame) continue;
      const arr = operands; operands = frame.operands; operandStart = frame.operandStart;
      if (operandStart < 0) operandStart = frame.arrayStart ?? start;
      operands.push(arr);
      continue;
    }
    if (ch === "<" && s[pos + 1] === "<") {
      let depth = 0;
      while (pos < s.length) {
        if (s.startsWith("<<", pos)) { depth++; pos += 2; }
        else if (s.startsWith(">>", pos)) { depth--; pos += 2; if (!depth) break; }
        else if (s[pos] === "(") pos = parseLiteralString(s, pos)[1];
        else pos++;
      }
      value = null;
    } else if (ch === "<") [value, pos] = parseHexString(s, pos);
    else if (ch === "(") [value, pos] = parseLiteralString(s, pos);
    else if (ch === "/") { name.lastIndex = pos; const m = name.exec(s); value = m[0]; pos += m[0].length; }
    else {
      number.lastIndex = pos;
      const n = number.exec(s);
      if (n && n[0].length) { value = Number(n[0]); pos += n[0].length; }
      else {
        word.lastIndex = pos;
        const w = word.exec(s);
        if (!w) { pos++; continue; }
        pos += w[0].length;
        if (stack.length) continue; // stray operator inside an array: ignore
        if (w[0] === "BI") { // inline image: skip its binary payload
          const id = s.indexOf("ID", pos);
          const ei = id < 0 ? -1 : s.slice(id + 2).search(/\sEI(?=[\s]|$)/);
          pos = ei < 0 ? s.length : id + 2 + ei + 3;
          yield { op: "BI", operands: [], start: operandStart < 0 ? start : operandStart, end: pos };
        } else yield { op: w[0], operands, start: operandStart < 0 ? start : operandStart, opStart: start, end: pos };
        operands = []; operandStart = -1;
        continue;
      }
    }
    if (operandStart < 0 && !stack.length) operandStart = start;
    operands.push(value);
  }
}

const PAINT_FILL = new Set(["f", "F", "f*", "B", "B*", "b", "b*"]);
const PAINT_ANY = new Set([...PAINT_FILL, "S", "s"]);

// Interprets one page: decoded text (with page-space glyph positions), filled
// path parts and every painting operator's page-space bounds.
async function interpretPage(sourceCtx, pageDict, content) {
  const { objects } = sourceCtx;
  const resources = inheritedResources(objects, pageDict);
  const fonts = resolve(objects, resources["/Font"]) || {};
  const xobjects = resolve(objects, resources["/XObject"]) || {};
  const decoders = new Map();
  const glyphs = []; // { ch, x, y, size }
  const fills = []; // { x0, y0, x1, y1 } per filled subpath
  const paints = []; // { start, end, opStart, op, box, name? }
  let ctm = [1, 0, 0, 1, 0, 0];
  let font = null, size = 0, leading = 0, charSpace = 0, wordSpace = 0, hScale = 1, rise = 0;
  const stack = [];
  let tm = [1, 0, 0, 1, 0, 0], tlm = tm;
  let subpaths = [], current = null;
  const point = (x, y) => { const [px, py] = apply(ctm, x, y); if (!current) { current = [px, py, px, py]; subpaths.push(current); } else { current[0] = Math.min(current[0], px); current[1] = Math.min(current[1], py); current[2] = Math.max(current[2], px); current[3] = Math.max(current[3], py); } };
  const union = (boxes) => boxes.length ? [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))] : null;
  const show = async (str, token, boxes) => {
    if (!font) return;
    if (!decoders.has(font)) decoders.set(font, await fontDecoder(sourceCtx, fonts[font]).catch(() => ({ codeBytes: 1, map: new Map(), widths: new Map(), defaultWidth: 500 })));
    const dec = decoders.get(font), b = str.bytes || [];
    for (let i = 0; i + dec.codeBytes <= b.length; i += dec.codeBytes) {
      let code = 0;
      for (let k = 0; k < dec.codeBytes; k++) code = code * 256 + b[i + k];
      const m = multiply(tm, ctm);
      const [x, y] = apply(m, 0, rise);
      const scaleY = Math.hypot(m[2], m[3]) * size;
      const width = (dec.widths.get(code) ?? dec.defaultWidth) / 1000;
      const [x2, y2] = apply(m, width * size, rise + size);
      glyphs.push({ ch: dec.map.get(code) ?? "", x, y, size: scaleY });
      boxes.push([Math.min(x, x2), Math.min(y, y2), Math.max(x, x2), Math.max(y, y2)]);
      const advance = (width * size + charSpace + (dec.codeBytes === 1 && code === 32 ? wordSpace : 0)) * hScale;
      tm = multiply([1, 0, 0, 1, advance, 0], tm);
    }
  };
  for (const t of contentTokens(content)) {
    const a = t.operands;
    switch (t.op) {
      case "q": stack.push({ ctm, font, size, leading, charSpace, wordSpace, hScale, rise }); break;
      case "Q": if (stack.length) ({ ctm, font, size, leading, charSpace, wordSpace, hScale, rise } = stack.pop()); break;
      case "cm": if (a.length === 6) ctm = multiply(a, ctm); break;
      case "m": current = null; point(a[0], a[1]); break;
      case "l": point(a[0], a[1]); break;
      case "c": point(a[0], a[1]); point(a[2], a[3]); point(a[4], a[5]); break;
      case "v": case "y": point(a[0], a[1]); point(a[2], a[3]); break;
      case "re": current = null; point(a[0], a[1]); point(a[0] + a[2], a[1] + a[3]); current = null; break;
      case "h": break;
      case "n": subpaths = []; current = null; break;
      case "BT": tm = tlm = [1, 0, 0, 1, 0, 0]; break;
      case "Tf": font = a[0]; size = a[1]; break;
      case "TL": leading = a[0]; break;
      case "Tc": charSpace = a[0]; break;
      case "Tw": wordSpace = a[0]; break;
      case "Tz": hScale = a[0] / 100; break;
      case "Ts": rise = a[0]; break;
      case "Td": tm = tlm = multiply([1, 0, 0, 1, a[0], a[1]], tlm); break;
      case "TD": leading = -a[1]; tm = tlm = multiply([1, 0, 0, 1, a[0], a[1]], tlm); break;
      case "Tm": if (a.length === 6) tm = tlm = [...a]; break;
      case "T*": tm = tlm = multiply([1, 0, 0, 1, 0, -leading], tlm); break;
      case "Tj": case "'": case "\"": case "TJ": {
        if (t.op === "'" || t.op === "\"") tm = tlm = multiply([1, 0, 0, 1, 0, -leading], tlm);
        if (t.op === "\"") { wordSpace = a[0]; charSpace = a[1]; }
        const boxes = [];
        const items = t.op === "TJ" ? a[0] || [] : [a[a.length - 1]];
        for (const item of items) {
          if (typeof item === "number") tm = multiply([1, 0, 0, 1, -item / 1000 * size * hScale, 0], tm);
          else if (item && item.isString) await show(item, t, boxes);
        }
        paints.push({ ...t, box: union(boxes) });
        break;
      }
      case "Do": {
        const xobj = resolve(objects, xobjects[a[0]]) || {};
        let corners = [[0, 0], [1, 0], [0, 1], [1, 1]], m = ctm;
        if (xobj["/Subtype"] === "/Form" && Array.isArray(xobj["/BBox"])) {
          const [x0, y0, x1, y1] = xobj["/BBox"].map((v) => resolve(objects, v));
          corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
          if (Array.isArray(xobj["/Matrix"])) m = multiply(xobj["/Matrix"], ctm);
        }
        const pts = corners.map(([x, y]) => apply(m, x, y));
        paints.push({ ...t, name: a[0], box: union(pts.map(([x, y]) => [x, y, x, y])) });
        break;
      }
      case "BI": paints.push({ ...t, box: union([[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => apply(ctm, x, y)).map(([x, y]) => [x, y, x, y])) }); break;
      default:
        if (PAINT_ANY.has(t.op)) {
          if (PAINT_FILL.has(t.op)) for (const sp of subpaths) fills.push({ x0: sp[0], y0: sp[1], x1: sp[2], y1: sp[3] });
          paints.push({ ...t, box: union(subpaths) });
          subpaths = []; current = null;
        }
    }
  }
  return { glyphs, fills, paints };
}

// Finds `needle` (spaces ignored) in the page text; returns the glyph where it starts.
function findText(glyphs, needle) {
  const target = needle.replace(/\s+/g, "");
  const chars = [], owners = [];
  glyphs.forEach((g) => { for (const ch of g.ch.replace(/\s+/g, "")) { chars.push(ch); owners.push(g); } });
  const index = chars.join("").indexOf(target);
  return index < 0 ? null : owners[index];
}

/**
 * Returns the Flipkart shipping-label rectangle (page coordinates) and the
 * decoded content needed to crop it, or null when the page is not a
 * confidently detected Flipkart label - in which case nothing changes.
 */
export async function detectFlipkartLabel(sourceCtx, pageDict) {
  try {
    const { pageBox, rotate } = sourcePageGeometry(sourceCtx.objects, pageDict);
    if (rotate !== 0) return null;
    const contentsVal = pageDict["/Contents"];
    const refs = Array.isArray(contentsVal) ? contentsVal : [contentsVal];
    const parts = [];
    for (const ref of refs) {
      const obj = ref && typeof ref === "object" && "ref" in ref ? sourceCtx.objects.get(ref.ref) : null;
      if (obj?.stream) parts.push(bytesToLatin1(await decodeStream(sourceCtx.bytes, obj)));
    }
    const content = parts.join("\n");
    // Cheap gate: a Flipkart page's text is drawn with Tj (no text, no crop).
    if (!content || !/T[jJ]/.test(content)) return null;
    const page = await interpretPage(sourceCtx, pageDict, content);
    const ekart = findText(page.glyphs, "E-Kart Logistics");
    const notForResale = findText(page.glyphs, "Not for resale.");
    const printedAt = findText(page.glyphs, "Printed at");
    const routing = findText(page.glyphs, "AWB No") || findText(page.glyphs, "HBD:") || findText(page.glyphs, "CPD:");
    if (!ekart || !notForResale || !printedAt || !routing) return null;
    const taxInvoice = findText(page.glyphs, "Tax Invoice");

    // The label's outer border: thin filled rules just above the header and
    // just below the "Not for resale. / Printed at" footer.
    const t = FLIPKART_RULE_THICKNESS;
    const horizontal = page.fills.filter((r) => r.y1 - r.y0 <= t && r.x1 - r.x0 >= 40);
    const vertical = page.fills.filter((r) => r.x1 - r.x0 <= t && r.y1 - r.y0 >= 40);
    const under = (r, g) => r.x0 - 1 <= g.x && g.x <= r.x1 + 1;
    const footerY = Math.min(notForResale.y, printedAt.y);
    const bottom = horizontal.filter((r) => under(r, notForResale) && r.y1 <= footerY && r.y1 >= footerY - 40).sort((p, q) => q.y1 - p.y1)[0];
    const top = horizontal.filter((r) => under(r, ekart) && r.y0 >= ekart.y && r.y0 <= ekart.y + 60).sort((p, q) => p.y0 - q.y0)[0];
    if (!bottom || !top) return null;
    let x0 = Math.min(bottom.x0, top.x0), x1 = Math.max(bottom.x1, top.x1);
    for (const v of vertical) {
      const spans = v.y0 <= bottom.y1 + t && v.y1 >= top.y0 - t;
      if (spans && Math.abs(v.x0 - x0) <= 2 * t) x0 = Math.min(x0, v.x0);
      if (spans && Math.abs(v.x1 - x1) <= 2 * t) x1 = Math.max(x1, v.x1);
    }
    const region = [x0 - FLIPKART_PAD, bottom.y0 - FLIPKART_PAD, x1 + FLIPKART_PAD, top.y1 + FLIPKART_PAD];
    // Sanity: the label must contain its header and footer, sit inside the
    // page, be a plausible label size, and exclude the Tax Invoice.
    const inside = (g) => g.x >= region[0] && g.x <= region[2] && g.y >= region[1] && g.y <= region[3];
    if (![ekart, notForResale, printedAt, routing].every(inside)) return null;
    if (taxInvoice && taxInvoice.y + taxInvoice.size >= region[1]) return null;
    const w = region[2] - region[0], h = region[3] - region[1];
    if (w < 100 || h < 150 || region[0] < pageBox[0] - 1 || region[1] < pageBox[1] - 1 || region[2] > pageBox[2] + 1 || region[3] > pageBox[3] + 1) return null;
    return { region, content, paints: page.paints };
  } catch {
    return null;
  }
}

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Physically crops the decoded content: painting operators whose bounds lie
// entirely outside the label are removed (text/image) or turned into `n`
// (paths, so path syntax stays valid). Returns the new content and the
// XObject names the label still draws.
function cropContent({ region, content, paints }) {
  const outside = (b) => !b || b[2] < region[0] || b[0] > region[2] || b[3] < region[1] || b[1] > region[3];
  const edits = [], used = new Set();
  for (const p of paints) {
    if (!outside(p.box)) { if (p.name) used.add(p.name); continue; }
    if (p.op === "Tj" || p.op === "TJ" || p.op === "Do" || p.op === "BI") edits.push([p.start, p.end, " "]);
    else if (PAINT_ANY.has(p.op)) edits.push([p.opStart, p.end, "n"]);
    else if (p.name) used.add(p.name);
  }
  let out = "", last = 0;
  for (const [start, end, text] of edits.sort((a, b) => a[0] - b[0])) {
    if (start < last) continue;
    out += content.slice(last, start) + text;
    last = end;
  }
  out += content.slice(last);
  return { text: out, used };
}

// ---------------------------------------------------------------------------
// A4 4-up layout
// ---------------------------------------------------------------------------

export const A4_WIDTH = 595.28; // 210mm in points
export const A4_HEIGHT = 841.89; // 297mm in points
// Fixed geometry measured from the supplied reference.pdf. These coordinates
// are the source of truth for this tool; do not derive them from generic page
// margins or quarter-page padding.
export const REFERENCE_SCALE = 0.4169;
export const REFERENCE_SOURCE_WIDTH = 595;
export const REFERENCE_SOURCE_HEIGHT = 842;
export const SLOT_WIDTH = 248.03;
export const SLOT_HEIGHT = 351;
export const BORDER_WIDTH = 0.85;
export const PAGE_MARGIN = 42.5197; // retained export for existing consumers
export const SLOT_GAP = 14.1747; // retained export for existing consumers
export const SLOT_POSITIONS = [
  { x: 42.5197, y: 438.2029 },
  { x: 304.7244, y: 438.2029 },
  { x: 42.5197, y: 52.6911 },
  { x: 304.7244, y: 52.6911 },
];

// Slot order is fixed: 0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right.
export function slotBox(index) {
  const position = SLOT_POSITIONS[index];
  if (!position) throw new RangeError("Shipping-label slot index must be between 0 and 3.");
  return {
    x: position.x,
    y: position.y,
    w: SLOT_WIDTH,
    h: SLOT_HEIGHT,
  };
}

function referencePlacement(effW, effH, box) {
  if (Math.abs(effW - REFERENCE_SOURCE_WIDTH) < 0.01 && Math.abs(effH - REFERENCE_SOURCE_HEIGHT) < 0.01) {
    return {
      scale: REFERENCE_SCALE,
      placedW: effW * REFERENCE_SCALE,
      placedH: effH * REFERENCE_SCALE,
      offX: box.x,
      offY: box.y,
    };
  }
  return computePlacement(effW, effH, box);
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

// Flipkart only: the form is the label rectangle, built from physically
// cropped content and only the XObjects the label still draws.
async function embedFlipkartLabelAsForm(builder, sourceCtx, pageDict, label) {
  const resources = { ...inheritedResources(sourceCtx.objects, pageDict) };
  const { text, used } = cropContent(label);
  const xobjects = resolve(sourceCtx.objects, resources["/XObject"]);
  if (xobjects && typeof xobjects === "object") {
    resources["/XObject"] = Object.fromEntries(Object.entries(xobjects).filter(([name]) => used.has(name)));
  }
  const [x0, y0, x1, y1] = label.region;
  const formDict = {
    "/Type": "/XObject",
    "/Subtype": "/Form",
    "/FormType": 1,
    "/BBox": label.region,
    "/Matrix": [1, 0, 0, 1, -x0, -y0],
    "/Resources": transformValue(sourceCtx, builder, resources),
    "/Filter": "/FlateDecode",
  };
  const formNum = builder.addObject(formDict, await deflate(Uint8Array.from(text, (ch) => ch.charCodeAt(0) & 0xff)));
  return { formNum, effW: x1 - x0, effH: y1 - y0 };
}

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
      const flipkart = await detectFlipkartLabel(slip.sourceCtx, slip.pageDict);
      const { formNum, effW, effH } = flipkart
        ? await embedFlipkartLabelAsForm(builder, slip.sourceCtx, slip.pageDict, flipkart)
        : await embedSlipAsForm(builder, slip.sourceCtx, slip.pageDict);
      const box = slotBox(slot);
      // A cropped Flipkart label is scaled up to fill its slot, centred, inside a small print margin.
      const { scale, offX, offY } = flipkart
        ? computePlacement(effW, effH, { x: box.x + FLIPKART_SLOT_MARGIN, y: box.y + FLIPKART_SLOT_MARGIN, w: box.w - 2 * FLIPKART_SLOT_MARGIN, h: box.h - 2 * FLIPKART_SLOT_MARGIN })
        : referencePlacement(effW, effH, box);
      const name = `S${slot}`;
      xobjectDict["/" + name] = { ref: formNum, gen: 0 };
      // Contain scaling guarantees the complete source MediaBox fits inside
      // its quarter, so no clipping path is needed (or allowed) here.
      contentLines.push(`q ${formatNumber(scale)} 0 0 ${formatNumber(scale)} ${formatNumber(offX)} ${formatNumber(offY)} cm /${name} Do Q`);
      contentLines.push(`q ${formatNumber(BORDER_WIDTH)} w 0 G ${formatNumber(box.x)} ${formatNumber(box.y)} ${formatNumber(box.w)} ${formatNumber(box.h)} re S Q`);
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
