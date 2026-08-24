// PDF -> Word (.docx) conversion engine.
// Runs entirely client-side (or under Node for testing): parses PDF object/content
// stream structure by hand, extracts text with positioning, and writes a minimal
// valid OOXML .docx package. No external libraries.

const BYTE_ENCODING = "windows-1252"; // 1 byte <-> 1 char, safe for structural scanning

// ---------------------------------------------------------------------------
// Low-level PDF object model parsing
// ---------------------------------------------------------------------------

function isWhitespace(ch) {
  return ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === "\f" || ch === "\0";
}
function isDelimiter(ch) {
  return "()<>[]{}/%".includes(ch);
}

// Parses a single PDF value (dict, array, name, string, number, ref, bool, null)
// starting at `pos` in `s`. Returns [value, nextPos].
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
  // Unknown token (likely a stray operator/keyword) - skip one token.
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
      // malformed - bail defensively
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
        pos += next === "\r" && s[pos + 2] === "\n" ? 3 : 2; // line continuation, no byte
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
  // Could be "N G R" (indirect reference) or "N G obj" - only handle ref here.
  const after = skipWs(s, next);
  const m2 = /^(\d+)[ \t\r\n]+([RG])/.exec(s.slice(after)); // R for ref
  if (!Number.isNaN(Number(numText)) && Number.isInteger(Number(numText))) {
    const genMatch = /^(\d+)\s+R\b/.exec(s.slice(after));
    if (genMatch) {
      return [{ ref: Number(numText), gen: Number(genMatch[1]) }, after + genMatch[0].length];
    }
  }
  return [Number(numText), next];
}

function stringBytes(val) {
  return val && val.isString ? val.bytes : [];
}
function stringToLatin(val) {
  return String.fromCharCode(...stringBytes(val));
}

// ---------------------------------------------------------------------------
// Document object scanning
// ---------------------------------------------------------------------------

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
        length = null; // resolved in a second pass once all objects are scanned
      }
      let endStreamIdx = text.indexOf("endstream", sPos);
      let sEnd = typeof length === "number" ? sPos + length : endStreamIdx;
      if (typeof length === "number") {
        // sanity-check the declared length against the real endstream marker
        const check = text.slice(sPos + length, sPos + length + 20);
        if (!/^\s*endstream/.test(check)) sEnd = endStreamIdx === -1 ? boundary : endStreamIdx;
      }
      if (sEnd === -1) sEnd = boundary;
      stream = { byteStart: sPos, byteEnd: sEnd, lengthRef: length === null ? dict["/Length"] : null };
    }
    objects.set(cur.num, { dict, stream });
  }
  // Resolve any /Length values that were indirect references.
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
      return new Uint8Array(0); // unsupported filter (images, LZW, CCITT...) - skip content
    }
  }
  return data;
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

// ---------------------------------------------------------------------------
// Font / encoding resolution
// ---------------------------------------------------------------------------

// A small set of common /Differences glyph names not already covered by
// windows-1252 (best-effort - not the full Adobe Glyph List).
const GLYPH_NAME_MAP = {
  bullet: "•", endash: "–", emdash: "—",
  quoteleft: "‘", quoteright: "’", quotedblleft: "“", quotedblright: "”",
  ellipsis: "…", fi: "ﬁ", fl: "ﬂ", nbspace: " ",
  minus: "−", trademark: "™", copyright: "©", registered: "®",
};

async function buildFont(objects, bytes, fontDict) {
  const font = {
    bold: false,
    italic: false,
    toUnicode: null,
    twoByte: false,
    differences: null,
  };
  const baseFont = typeof fontDict["/BaseFont"] === "string" ? fontDict["/BaseFont"] : "";
  const lower = baseFont.toLowerCase();
  font.bold = /bold|black|heavy/.test(lower);
  font.italic = /italic|oblique/.test(lower);

  const subtype = fontDict["/Subtype"];
  if (subtype === "/Type0") {
    font.twoByte = true;
    // Composite (Type0/CID) fonts carry their real glyph widths on the
    // DESCENDANT CIDFont dictionary as a /W array (PDF 32000-1 9.7.4.3),
    // not on the Type0 dict itself. This is the width source for the
    // overwhelming majority of real-world PDFs (Word/Chrome/InDesign all
    // emit Identity-H CIDFontType2 subset fonts) and must be used - a
    // per-character estimate cannot reconstruct correct word boundaries
    // from CID codes, which are arbitrary glyph IDs, not character codes.
    const descendants = resolve(objects, fontDict["/DescendantFonts"]);
    const descRef = Array.isArray(descendants) ? descendants[0] : descendants;
    const descDict = descRef && typeof descRef === "object" && "ref" in descRef ? objects.get(descRef.ref)?.dict : descRef;
    if (descDict) {
      const dw = descDict["/DW"];
      font.dw = typeof dw === "number" ? dw : 1000;
      const wArr = resolve(objects, descDict["/W"]);
      if (Array.isArray(wArr)) {
        font.cidWidths = new Map();
        let i = 0;
        while (i < wArr.length) {
          const c = wArr[i];
          const next = wArr[i + 1];
          if (typeof c !== "number") { i++; continue; }
          if (Array.isArray(next)) {
            next.forEach((w, k) => { if (typeof w === "number") font.cidWidths.set(c + k, w); });
            i += 2;
          } else if (typeof next === "number" && typeof wArr[i + 2] === "number") {
            const cLast = next, w = wArr[i + 2];
            for (let cid = c; cid <= cLast; cid++) font.cidWidths.set(cid, w);
            i += 3;
          } else {
            i++;
          }
        }
      }
    }
  }

  const encoding = resolve(objects, fontDict["/Encoding"]);
  if (encoding && typeof encoding === "object" && !Array.isArray(encoding)) {
    const diffs = encoding["/Differences"];
    if (Array.isArray(diffs)) {
      const map = {};
      let code = 0;
      for (const item of diffs) {
        if (typeof item === "number") code = item;
        else if (typeof item === "string") { map[code] = item.slice(1); code++; }
      }
      font.differences = map;
    }
  }

  const toUnicodeRef = fontDict["/ToUnicode"];
  const toUnicodeObj = toUnicodeRef && typeof toUnicodeRef === "object" && "ref" in toUnicodeRef ? objects.get(toUnicodeRef.ref) : null;
  if (toUnicodeObj && toUnicodeObj.stream) {
    const data = await decodeStream(bytes, toUnicodeObj);
    const text = new TextDecoder(BYTE_ENCODING).decode(data);
    font.toUnicode = parseCMap(text);
  }

  // Real glyph widths (in 1000-unit glyph space) beat any estimate - PDFs
  // embed /Widths specifically so viewers/extractors can lay text out
  // correctly, which is exactly what's needed to tell "next glyph of the
  // same word" apart from "start of a new word" when text arrives as many
  // small Tj/TJ fragments.
  const firstChar = resolve(objects, fontDict["/FirstChar"]);
  const widthsArr = resolve(objects, fontDict["/Widths"]);
  if (typeof firstChar === "number" && Array.isArray(widthsArr)) {
    font.firstChar = firstChar;
    font.widths = widthsArr.map((w) => (typeof w === "number" ? w : null));
  }
  const descriptor = resolve(objects, fontDict["/FontDescriptor"]);
  if (descriptor && typeof descriptor["/MissingWidth"] === "number") {
    font.missingWidth = descriptor["/MissingWidth"];
  }

  return font;
}

// Width of a raw (pre-decode) byte string in text-space units at the given
// font size, using the font's real /Widths table when available.
function measureBytesWidth(bytes, font, fontSize) {
  if (!bytes.length) return 0;
  if (font && font.twoByte && font.cidWidths) {
    let total = 0;
    for (let i = 0; i < bytes.length; i += 2) {
      const cid = ((bytes[i] || 0) << 8) | (bytes[i + 1] || 0);
      const w1000 = font.cidWidths.get(cid) ?? font.dw ?? 1000;
      total += (w1000 / 1000) * fontSize;
    }
    return total;
  }
  if (font && !font.twoByte && font.widths) {
    let total = 0;
    for (const b of bytes) {
      const idx = b - font.firstChar;
      const w1000 = (idx >= 0 && idx < font.widths.length ? font.widths[idx] : null) ?? font.missingWidth ?? 500;
      total += (w1000 / 1000) * fontSize;
    }
    return total;
  }
  const charCount = font && font.twoByte ? bytes.length / 2 : bytes.length;
  return Math.max(1, charCount) * fontSize * 0.5;
}

function parseCMap(text) {
  const map = new Map();
  const charBlocks = text.match(/beginbfchar[\s\S]*?endbfchar/g) || [];
  for (const block of charBlocks) {
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let m;
    while ((m = pairRe.exec(block))) {
      map.set(m[1].toUpperCase(), hexToUnicode(m[2]));
    }
  }
  const rangeBlocks = text.match(/beginbfrange[\s\S]*?endbfrange/g) || [];
  for (const block of rangeBlocks) {
    const arrRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g;
    let m;
    while ((m = arrRe.exec(block))) {
      const lo = parseInt(m[1], 16);
      const items = m[3].match(/<[0-9A-Fa-f]+>/g) || [];
      items.forEach((hex, i) => {
        const code = (lo + i).toString(16).toUpperCase().padStart(m[1].length, "0");
        map.set(code, hexToUnicode(hex.slice(1, -1)));
      });
    }
    const simpleRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let m2;
    while ((m2 = simpleRe.exec(block))) {
      const lo = parseInt(m2[1], 16);
      const hi = parseInt(m2[2], 16);
      const dstStart = parseInt(m2[3], 16);
      for (let code = lo; code <= hi && code - lo < 65536; code++) {
        const key = code.toString(16).toUpperCase().padStart(m2[1].length, "0");
        map.set(key, String.fromCodePoint(dstStart + (code - lo)));
      }
    }
  }
  return map;
}

function hexToUnicode(hex) {
  if (hex.length % 4 !== 0) hex = hex.padStart(hex.length + (4 - (hex.length % 4)), "0");
  let out = "";
  for (let i = 0; i < hex.length; i += 4) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  }
  return out;
}

function decodeTextBytes(bytes, font) {
  if (font.twoByte) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 2) {
      const code = ((bytes[i] || 0) << 8) | (bytes[i + 1] || 0);
      const hex = code.toString(16).toUpperCase().padStart(4, "0");
      out += (font.toUnicode && font.toUnicode.get(hex)) || "";
    }
    return out;
  }
  let out = "";
  for (const b of bytes) {
    const hex = b.toString(16).toUpperCase().padStart(2, "0");
    if (font.toUnicode && font.toUnicode.has(hex)) { out += font.toUnicode.get(hex); continue; }
    if (font.differences && font.differences[b] && GLYPH_NAME_MAP[font.differences[b]]) {
      out += GLYPH_NAME_MAP[font.differences[b]];
      continue;
    }
    out += String.fromCharCode(b); // windows-1252 code point == char code for single bytes
  }
  return out;
}

// ---------------------------------------------------------------------------
// Page tree walking
// ---------------------------------------------------------------------------

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
  // Fallback: any object literally typed /Page, in object-number order.
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
    if (d["/Resources"]) return resolve(objects, d["/Resources"]);
    const parent = d["/Parent"];
    d = parent && typeof parent === "object" && "ref" in parent ? objects.get(parent.ref)?.dict : null;
    depth++;
  }
  return {};
}

// ---------------------------------------------------------------------------
// Content stream interpretation -> paragraphs
// ---------------------------------------------------------------------------

function tokenizeContent(text) {
  const tokens = [];
  let pos = 0;
  while (pos < text.length) {
    pos = skipWs(text, pos);
    if (pos >= text.length) break;
    const ch = text[pos];
    if (ch === "(") { const [v, p] = parseLiteralString(text, pos); tokens.push({ type: "string", value: v }); pos = p; continue; }
    if (ch === "<" && text[pos + 1] !== "<") { const [v, p] = parseHexString(text, pos); tokens.push({ type: "string", value: v }); pos = p; continue; }
    if (ch === "<" && text[pos + 1] === "<") { const [v, p] = parseDict(text, pos); tokens.push({ type: "dict", value: v }); pos = p; continue; }
    if (ch === "[") { const [v, p] = parseArrayOfMixed(text, pos); tokens.push({ type: "array", value: v }); pos = p; continue; }
    if (ch === "/") { const [v, p] = parseName(text, pos); tokens.push({ type: "name", value: v }); pos = p; continue; }
    if (/[0-9+\-.]/.test(ch)) {
      const m = /^[+\-]?\d*\.?\d+/.exec(text.slice(pos));
      if (m) { tokens.push({ type: "number", value: Number(m[0]) }); pos += m[0].length; continue; }
    }
    // operator keyword
    let p = pos;
    while (p < text.length && !isWhitespace(text[p]) && !isDelimiter(text[p])) p++;
    if (p === pos) p++;
    tokens.push({ type: "op", value: text.slice(pos, p) });
    pos = p;
  }
  return tokens;
}

function parseArrayOfMixed(s, pos) {
  pos += 1;
  const arr = [];
  for (;;) {
    pos = skipWs(s, pos);
    if (s[pos] === "]") return [arr, pos + 1];
    if (pos >= s.length) return [arr, pos];
    const ch = s[pos];
    if (ch === "(") { const [v, p] = parseLiteralString(s, pos); arr.push({ type: "string", value: v }); pos = p; continue; }
    if (ch === "<") { const [v, p] = parseHexString(s, pos); arr.push({ type: "string", value: v }); pos = p; continue; }
    if (/[0-9+\-.]/.test(ch)) {
      const m = /^[+\-]?\d*\.?\d+/.exec(s.slice(pos));
      if (m) { arr.push({ type: "number", value: Number(m[0]) }); pos += m[0].length; continue; }
    }
    pos++;
  }
}

// Fragment = one text-showing operation (Tj/TJ/'/") placed at the text-line
// origin active at the time it ran. PDFs very commonly show a visual "line"
// as MANY small fragments (word-by-word or even glyph-by-glyph), each preceded
// by a tiny Td/TD move for kerning/justification - so fragments must be
// reassembled into rows by Y-proximity before anything else is decided.
async function collectTextFragments(objects, bytes, pageDict, fontCache) {
  const resources = inheritedResources(objects, pageDict);
  const fontsDict = resolve(objects, resources && resources["/Font"]) || {};

  let contentsRef = pageDict["/Contents"];
  if (!contentsRef) return [];
  const refs = Array.isArray(contentsRef) ? contentsRef : [contentsRef];
  let raw = new Uint8Array(0);
  for (const ref of refs) {
    const obj = ref && typeof ref === "object" && "ref" in ref ? objects.get(ref.ref) : null;
    if (!obj) continue;
    const data = await decodeStream(bytes, obj);
    const merged = new Uint8Array(raw.length + data.length + 1);
    merged.set(raw, 0);
    merged.set([32], raw.length);
    merged.set(data, raw.length + 1);
    raw = merged;
  }
  const text = new TextDecoder(BYTE_ENCODING).decode(raw);
  const tokens = tokenizeContent(text);

  const fragments = []; // { text, x, y, fontSize, bold, italic }
  let stack = [];
  let curFont = null;
  let fontSize = 12;
  let leading = 0;
  // PDF text positioning uses TWO matrices (spec 9.4.2): the text LINE matrix
  // (Tlm) - the anchor that Td/TD/Tm/T* offset from - and the text matrix
  // (Tm) - the actual pen position, which auto-advances as glyphs are shown.
  // Td/TD/Tm/T* reset Tm to a NEW Tlm; they are NOT relative to wherever
  // auto-advance left the pen. Conflating the two double-counts every
  // glyph's advance whenever a content stream repositions between every
  // character (extremely common - e.g. Chrome/Skia's PDF output does this),
  // which is exactly what was corrupting spacing here.
  let lineX = 0, lineY = 0; // Tlm
  let penX = 0, penY = 0; // Tm
  let blockIndex = -1; // increments per BT - a proxy for "which text object in the source DOM/paint order"

  function pushFragment(str, width) {
    if (str) fragments.push({ text: str, x: penX, y: penY, width, fontSize, block: blockIndex, bold: curFont?.bold || false, italic: curFont?.italic || false });
    penX += width; // showing text advances Tm, not Tlm
  }

  for (const tok of tokens) {
    if (tok.type !== "op") { stack.push(tok); continue; }
    const op = tok.value;
    if (op === "BT") { lineX = 0; lineY = 0; penX = 0; penY = 0; blockIndex++; stack = []; continue; }
    if (op === "ET") { stack = []; continue; }
    if (op === "Tf") {
      const size = stack[stack.length - 1];
      const name = stack[stack.length - 2];
      fontSize = typeof size?.value === "number" ? size.value : fontSize;
      const fontName = name?.value;
      if (fontName && fontsDict[fontName]) {
        const key = fontName + "|" + JSON.stringify(fontsDict[fontName]);
        if (!fontCache.has(key)) {
          const fontRef = fontsDict[fontName];
          const fontDict = fontRef && typeof fontRef === "object" && "ref" in fontRef ? objects.get(fontRef.ref)?.dict : fontRef;
          fontCache.set(key, fontDict ? await buildFont(objects, bytes, fontDict) : null);
        }
        curFont = fontCache.get(key);
      }
      stack = [];
      continue;
    }
    if (op === "TL") {
      const v = stack[stack.length - 1]?.value;
      if (typeof v === "number") leading = v;
      stack = [];
      continue;
    }
    if (op === "Td" || op === "TD") {
      const ty = stack[stack.length - 1]?.value;
      const tx = stack[stack.length - 2]?.value;
      if (op === "TD" && typeof ty === "number") leading = -ty;
      lineX += typeof tx === "number" ? tx : 0;
      lineY += typeof ty === "number" ? ty : 0;
      penX = lineX;
      penY = lineY;
      stack = [];
      continue;
    }
    if (op === "Tm") {
      const nums = stack.filter((t) => t.type === "number").map((t) => t.value);
      if (nums.length >= 6) { lineX = nums[4]; lineY = nums[5]; }
      penX = lineX;
      penY = lineY;
      stack = [];
      continue;
    }
    if (op === "T*") {
      lineY -= leading;
      penX = lineX;
      penY = lineY;
      stack = [];
      continue;
    }
    if (op === "Tj" || op === "'" || op === "\"") {
      const strTok = stack.find((t) => t.type === "string");
      const decoded = strTok ? (curFont ? decodeTextBytes(strTok.value.bytes, curFont) : stringToLatin(strTok.value)) : "";
      const width = strTok ? measureBytesWidth(strTok.value.bytes, curFont, fontSize) : 0;
      pushFragment(decoded, width);
      stack = [];
      continue;
    }
    if (op === "TJ") {
      const arrTok = stack.find((t) => t.type === "array");
      let buf = "";
      let width = 0;
      if (arrTok) {
        for (const item of arrTok.value) {
          if (item.type === "string") {
            buf += curFont ? decodeTextBytes(item.value.bytes, curFont) : stringToLatin(item.value);
            width += measureBytesWidth(item.value.bytes, curFont, fontSize);
          } else if (item.type === "number") {
            width -= (item.value / 1000) * fontSize;
            if (item.value < -120) buf += " ";
          }
        }
      }
      pushFragment(buf, width);
      stack = [];
      continue;
    }
    stack = [];
  }
  return fragments;
}

// Turns a flat fragment stream into rows (by Y-proximity), rows into
// same-line "segments" (by X-gap), then classifies runs of aligned
// multi-segment rows as tables vs. ordinary paragraph-flow text.
function buildPageBlocks(fragments) {
  if (!fragments.length) return [];

  const rows = [];
  for (const f of fragments) {
    if (!f.text.trim() && rows.length && Math.abs(rows[rows.length - 1].y - f.y) < 1) continue;
    const tolerance = Math.max(2, f.fontSize * 0.35);
    let row = rows.find((r) => Math.abs(r.y - f.y) < tolerance);
    if (!row) { row = { y: f.y, ySum: 0, count: 0, items: [] }; rows.push(row); }
    row.items.push(f);
    row.count++;
    row.ySum += f.y;
    row.y = row.ySum / row.count;
  }
  rows.sort((a, b) => b.y - a.y); // PDF y grows upward; reading order is top -> bottom
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);

  // Merge fragments within a row into segments. Many real PDFs show a single
  // visual line as many separate Tj/TJ calls (per word, or even per glyph),
  // each preceded by a small Td nudge - so consecutive same-row fragments are
  // normally the SAME piece of text and must be rejoined, not treated as
  // separate paragraphs/lines. Since text-showing now auto-advances the pen
  // by each fragment's real glyph-metrics width (see pushFragment/
  // measureBytesWidth), `f.x - (last.x + last.width)` is the genuine extra
  // gap the content stream asked for beyond natural flow - not a guess - so
  // thresholds can be simple, absolute, font-size-relative amounts: near
  // zero means "same run", a modest gap means "insert one space", and only
  // a gap far wider than a space is treated as a real column boundary.
  for (const row of rows) {
    const segments = [];
    for (const f of row.items) {
      const last = segments[segments.length - 1];
      if (!last) {
        segments.push({ text: f.text, xStart: f.x, endX: f.x + f.width, fontSize: f.fontSize, bold: f.bold, italic: f.italic });
        continue;
      }
      const dx = f.x - last.endX;
      const isNewColumn = dx > f.fontSize * 2.5;
      if (isNewColumn) {
        segments.push({ text: f.text, xStart: f.x, endX: f.x + f.width, fontSize: f.fontSize, bold: f.bold, italic: f.italic });
      } else {
        const alreadySpaced = last.text.endsWith(" ") || f.text.startsWith(" ");
        const looksLikeWordGap = dx > f.fontSize * 0.12;
        last.text += (!alreadySpaced && looksLikeWordGap ? " " : "") + f.text;
        last.endX = f.x + f.width;
        last.fontSize = Math.max(last.fontSize, f.fontSize);
        last.bold = last.bold || f.bold;
        last.italic = last.italic || f.italic;
      }
    }
    row.segments = segments.filter((s) => s.text.trim().length);
  }
  const rowsWithContent = rows.filter((r) => r.segments.length);

  function columnsAlign(anchor, candidate) {
    if (anchor.segments.length !== candidate.segments.length) return false;
    for (let i = 0; i < anchor.segments.length; i++) {
      const tol = Math.max(8, anchor.segments[i].fontSize * 2.5);
      if (Math.abs(anchor.segments[i].xStart - candidate.segments[i].xStart) > tol) return false;
    }
    return true;
  }

  // Detects tables (runs of position-aligned multi-segment rows) and groups
  // the remaining single-segment rows into paragraphs via a typical-gap
  // heuristic. Operates on one column stream at a time (see splitColumns
  // below) so unrelated side-by-side content is never row-merged together.
  function groupRows(rowsInStream) {
    const blocks = [];
    let i = 0;
    while (i < rowsInStream.length) {
      const anchor = rowsInStream[i];
      if (anchor.segments.length >= 2) {
        let j = i + 1;
        while (j < rowsInStream.length && columnsAlign(anchor, rowsInStream[j])) j++;
        if (j - i >= 2) {
          blocks.push({ type: "table", rows: rowsInStream.slice(i, j) });
          i = j;
          continue;
        }
      }
      blocks.push({ type: "line", row: anchor });
      i++;
    }

    const out = [];
    let gapHistory = [];
    let current = null;
    let prevY = null;
    for (const block of blocks) {
      if (block.type === "table") {
        out.push(block);
        current = null;
        prevY = null;
        gapHistory = [];
        continue;
      }
      const row = block.row;
      const text = row.segments.map((s) => s.text).join("  ");
      const fontSize = Math.max(...row.segments.map((s) => s.fontSize));
      const bold = row.segments.every((s) => s.bold);
      const italic = row.segments.every((s) => s.italic);
      const gap = prevY === null ? null : prevY - row.y;
      const typical = gapHistory.length ? gapHistory.reduce((a, b) => a + b, 0) / gapHistory.length : fontSize * 1.2;
      const isNewParagraph = !current || gap === null || gap > typical * 1.6 || gap <= 0;
      if (isNewParagraph) {
        current = { type: "paragraph", text, fontSize, bold, italic, y: row.y };
        out.push(current);
      } else {
        current.text += (current.text.endsWith("-") ? "" : " ") + text;
        current.fontSize = Math.max(current.fontSize, fontSize);
      }
      if (gap !== null && gap > 0 && gap < fontSize * 3) gapHistory = [...gapHistory.slice(-6), gap];
      prevY = row.y;
    }
    return out;
  }

  // Real invoices/receipts commonly place a narrow box (an amounts summary,
  // a status panel) beside flowing paragraph text, both in the same Y-range.
  // Rows are already Y-sorted top-to-bottom for a single reading column, but
  // that global Y-order interleaves two side-by-side columns into a
  // scrambled read. Detect a narrow secondary column by its X-start being
  // well to the right of the page's dominant left margin, process each
  // column independently (so tables/paragraphs form correctly within their
  // own column only), then splice the secondary column's content back in
  // right where the main flow's Y reaches it - keeping the two sections
  // intact and adjacent instead of interleaved line-by-line.
  function splitColumns(rowsIn) {
    if (rowsIn.length < 6) return [rowsIn];
    const counts = new Map();
    for (const r of rowsIn) {
      const bucket = Math.round(r.segments[0].xStart / 12) * 12;
      counts.set(bucket, (counts.get(bucket) || 0) + 1);
    }
    let margin = null, marginCount = 0;
    for (const [b, c] of counts) if (c > marginCount) { marginCount = c; margin = b; }
    if (margin === null) return [rowsIn];

    const SECONDARY_OFFSET = 250;
    const primary = [], secondary = [];
    for (const r of rowsIn) (r.segments[0].xStart > margin + SECONDARY_OFFSET ? secondary : primary).push(r);
    // Only treat it as a genuine secondary column when it's a clear minority
    // of the content - otherwise this isn't a floated box, just normal text.
    if (!secondary.length || secondary.length > rowsIn.length * 0.4) return [rowsIn];
    return [primary, secondary];
  }

  const columnRowGroups = splitColumns(rowsWithContent);
  if (columnRowGroups.length === 1) return groupRows(columnRowGroups[0]);

  const [primaryRows, secondaryRows] = columnRowGroups;
  const primaryBlocks = groupRows(primaryRows);
  const secondaryBlocks = groupRows(secondaryRows);
  const blockY = (b) => (b.type === "table" ? b.rows[0].y : b.y);
  const secondaryTopY = Math.max(...secondaryRows.map((r) => r.y));
  let insertAt = primaryBlocks.findIndex((b) => blockY(b) < secondaryTopY);
  if (insertAt === -1) insertAt = primaryBlocks.length;
  primaryBlocks.splice(insertAt, 0, ...secondaryBlocks);
  return primaryBlocks;
}

async function extractPageBlocks(objects, bytes, pageDict, fontCache) {
  const fragments = await collectTextFragments(objects, bytes, pageDict, fontCache);
  return buildPageBlocks(fragments);
}

// ---------------------------------------------------------------------------
// Top-level PDF parse
// ---------------------------------------------------------------------------

export async function parsePdf(arrayBuffer, { onProgress } = {}) {
  const bytes = new Uint8Array(arrayBuffer);
  const text = new TextDecoder(BYTE_ENCODING).decode(bytes);
  if (!text.startsWith("%PDF-")) throw Object.assign(new Error("This file does not look like a valid PDF."), { code: "NOT_PDF" });

  const objects = scanObjects(text, bytes);
  if (!objects.size) throw Object.assign(new Error("No readable content was found in this PDF."), { code: "EMPTY" });

  for (const obj of objects.values()) {
    if (obj.dict && obj.dict["/Type"] === "/Encrypt") {
      throw Object.assign(new Error("This PDF is password-protected or encrypted and cannot be converted in the browser."), { code: "ENCRYPTED" });
    }
  }
  const trailerEncrypt = /trailer[\s\S]*?\/Encrypt/.test(text);
  if (trailerEncrypt) {
    throw Object.assign(new Error("This PDF is password-protected or encrypted and cannot be converted in the browser."), { code: "ENCRYPTED" });
  }

  const pages = collectPages(objects);
  if (!pages.length) throw Object.assign(new Error("No pages could be found in this PDF."), { code: "NO_PAGES" });

  const fontCache = new Map();
  const result = [];
  for (const [i, page] of pages.entries()) {
    onProgress?.(i + 1, pages.length);
    const blocks = await extractPageBlocks(objects, bytes, page.dict, fontCache);
    result.push(blocks);
  }

  const blockTextLength = (block) =>
    block.type === "table"
      ? block.rows.reduce((n, r) => n + r.segments.reduce((m, s) => m + s.text.trim().length, 0), 0)
      : block.text.trim().length;
  const totalChars = result.reduce((n, page) => n + page.reduce((m, b) => m + blockTextLength(b), 0), 0);
  const warnings = [];
  if (totalChars === 0) {
    warnings.push("No extractable text was found. This PDF may be a scanned image, or use fonts this tool cannot decode.");
  }

  return { pageCount: pages.length, pages: result, warnings };
}

// ---------------------------------------------------------------------------
// Minimal ZIP (store method) writer
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime() {
  return { time: 0, date: 0x21 }; // fixed, arbitrary valid date - content has no real timestamp need
}

export function createZip(files) {
  // files: [{ name, data: Uint8Array }]
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, date } = dosDateTime();

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const data = file.data;
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // method: store
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
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
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
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
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  ev.setUint16(20, 0, true);

  const totalLen = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalLen);
  let p = 0;
  for (const part of localParts) { out.set(part, p); p += part.length; }
  for (const part of centralParts) { out.set(part, p); p += part.length; }
  out.set(eocd, p);
  return out;
}

// ---------------------------------------------------------------------------
// DOCX (OOXML) generation
// ---------------------------------------------------------------------------

function xmlEscape(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function medianFontSize(pages) {
  const sizes = [];
  for (const page of pages) {
    for (const block of page) {
      if (block.type === "paragraph" && block.text.trim()) sizes.push(block.fontSize || 12);
      else if (block.type === "table") {
        for (const row of block.rows) for (const s of row.segments) if (s.text.trim()) sizes.push(s.fontSize || 12);
      }
    }
  }
  if (!sizes.length) return 12;
  sizes.sort((a, b) => a - b);
  return sizes[Math.floor(sizes.length / 2)];
}

function paragraphXml(p, bodyMedianSize) {
  const size = p.fontSize || 12;
  let style = "";
  if (size >= bodyMedianSize * 1.6) style = `<w:pStyle w:val="Heading1"/>`;
  else if (size >= bodyMedianSize * 1.25) style = `<w:pStyle w:val="Heading2"/>`;
  const runProps = [p.bold ? "<w:b/>" : "", p.italic ? "<w:i/>" : ""].join("");
  const rPr = runProps ? `<w:rPr>${runProps}</w:rPr>` : "";
  return `<w:p>${style ? `<w:pPr>${style}</w:pPr>` : ""}<w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(p.text.trim())}</w:t></w:r></w:p>`;
}

function tableXml(block) {
  const colCount = Math.max(1, ...block.rows.map((r) => r.segments.length));
  const colWidth = Math.floor(9000 / colCount);
  const gridCols = Array.from({ length: colCount }, () => `<w:gridCol w:w="${colWidth}"/>`).join("");
  const rowsXml = block.rows
    .map((row) => {
      const cells = [];
      for (let c = 0; c < colCount; c++) {
        const seg = row.segments[c];
        const text = seg ? seg.text.trim() : "";
        const rPr = seg && seg.bold ? "<w:rPr><w:b/></w:rPr>" : "";
        cells.push(
          `<w:tc><w:tcPr><w:tcW w:w="${colWidth}" w:type="dxa"/></w:tcPr><w:p><w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p></w:tc>`
        );
      }
      return `<w:tr>${cells.join("")}</w:tr>`;
    })
    .join("");
  const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="B0B7C3"/>`)
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr><w:tblGrid>${gridCols}</w:tblGrid>${rowsXml}</w:tbl><w:p/>`;
}

function blockXml(block, bodyMedianSize) {
  return block.type === "table" ? tableXml(block) : paragraphXml(block, bodyMedianSize);
}

export function buildDocx(parsed) {
  const bodyMedianSize = medianFontSize(parsed.pages);
  const bodyParas = [];
  parsed.pages.forEach((page, i) => {
    const nonEmpty = page.filter((b) => (b.type === "table" ? b.rows.length : b.text.trim().length));
    if (!nonEmpty.length) return;
    for (const b of nonEmpty) bodyParas.push(blockXml(b, bodyMedianSize));
    if (i < parsed.pages.length - 1) {
      bodyParas.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
    }
  });
  if (!bodyParas.length) {
    bodyParas.push(`<w:p><w:r><w:t xml:space="preserve">${xmlEscape("No extractable text was found in this document.")}</w:t></w:r></w:p>`);
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyParas.join("\n    ")}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/></w:rPr>
  </w:style>
</w:styles>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>Converted document</dc:title>
  <dc:creator>InfoBridgeIndia PDF to Word</dc:creator>
</cp:coreProperties>`;

  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>InfoBridgeIndia</Application>
</Properties>`;

  const enc = new TextEncoder();
  return createZip([
    { name: "[Content_Types].xml", data: enc.encode(contentTypesXml) },
    { name: "_rels/.rels", data: enc.encode(rootRelsXml) },
    { name: "word/document.xml", data: enc.encode(documentXml) },
    { name: "word/styles.xml", data: enc.encode(stylesXml) },
    { name: "word/_rels/document.xml.rels", data: enc.encode(documentRelsXml) },
    { name: "docProps/core.xml", data: enc.encode(coreXml) },
    { name: "docProps/app.xml", data: enc.encode(appXml) },
  ]);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function convertPdfToDocx(arrayBuffer, { onProgress } = {}) {
  const parsed = await parsePdf(arrayBuffer, { onProgress });
  const docxBytes = buildDocx(parsed);
  return { bytes: docxBytes, pageCount: parsed.pageCount, warnings: parsed.warnings };
}
