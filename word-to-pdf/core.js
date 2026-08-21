// Word to PDF - DOCX reading + HTML reconstruction engine.
// Runs entirely client-side (or under Node for testing): reads the .docx
// ZIP container and its WordprocessingML XML parts by hand (same technique
// as ../pdf-to-word/core.js and ../shipping-label-4in1/core.js elsewhere in
// this project), then rebuilds the document as semantic HTML+CSS that
// reproduces headings, bold/italic/underline, alignment, bullet/numbered
// lists, tables with borders, embedded images (as data URIs) and manual
// page breaks. The user's own browser then performs the actual pixel-exact
// text layout/pagination via its native print engine (window.print -> Save
// as PDF) - the same mechanism already used by the GST Invoice Generator
// and Quotation Generator tools in this project. No external libraries,
// nothing uploaded anywhere.

// ---------------------------------------------------------------------------
// ZIP reader (central-directory based; supports store + deflate methods)
// ---------------------------------------------------------------------------

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let eocd = -1;
  const minEocd = Math.max(0, bytes.length - 65557); // max comment length 65535 + 22-byte record
  for (let i = bytes.length - 22; i >= minEocd; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) {
    throw Object.assign(new Error("This file is not a valid .docx package (no ZIP structure found)."), { code: "NOT_DOCX" });
  }

  const totalEntries = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);

  const entries = new Map();
  let pos = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break; // malformed - stop gracefully
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
    else data = new Uint8Array(0); // unsupported method (rare for docx) - skip rather than corrupt

    entries.set(name, data);
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Minimal generic XML tree parser (namespace prefixes kept literal, e.g.
// "w:p" is treated as one opaque tag name - sufficient for WordprocessingML,
// which always uses the same fixed prefixes).
// ---------------------------------------------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseXml(text) {
  let pos = 0;
  const len = text.length;
  let truncated = false; // set when an element's closing tag is never found (corrupted/incomplete XML)

  function skipMisc() {
    for (;;) {
      while (pos < len && /\s/.test(text[pos])) pos++;
      if (text.startsWith("<?", pos)) { pos = text.indexOf("?>", pos); pos = pos === -1 ? len : pos + 2; continue; }
      if (text.startsWith("<!--", pos)) { pos = text.indexOf("-->", pos); pos = pos === -1 ? len : pos + 3; continue; }
      if (text.startsWith("<!DOCTYPE", pos)) { pos = text.indexOf(">", pos); pos = pos === -1 ? len : pos + 1; continue; }
      break;
    }
  }

  function parseElement() {
    pos++; // skip '<'
    const tagStart = pos;
    while (pos < len && !/[\s/>]/.test(text[pos])) pos++;
    const tag = text.slice(tagStart, pos);
    const attrs = {};
    for (;;) {
      while (pos < len && /\s/.test(text[pos])) pos++;
      if (text[pos] === "/" && text[pos + 1] === ">") { pos += 2; return { tag, attrs, children: [], text: "" }; }
      if (text[pos] === ">") { pos++; break; }
      if (pos >= len) { truncated = true; return { tag, attrs, children: [], text: "" }; }
      const nameStart = pos;
      while (pos < len && text[pos] !== "=" && !/\s/.test(text[pos]) && text[pos] !== ">") pos++;
      const name = text.slice(nameStart, pos);
      while (pos < len && /\s/.test(text[pos])) pos++;
      if (text[pos] !== "=") continue; // malformed attr (e.g. bare boolean) - skip token
      pos++;
      while (pos < len && /\s/.test(text[pos])) pos++;
      const quote = text[pos];
      pos++;
      const valStart = pos;
      while (pos < len && text[pos] !== quote) pos++;
      attrs[name] = decodeEntities(text.slice(valStart, pos));
      pos++; // closing quote
    }

    const children = [];
    let textContent = "";
    for (;;) {
      if (pos >= len) { truncated = true; break; }
      if (text.startsWith("</", pos)) {
        pos = text.indexOf(">", pos);
        pos = pos === -1 ? len : pos + 1;
        break;
      }
      if (text.startsWith("<!--", pos)) { pos = text.indexOf("-->", pos); pos = pos === -1 ? len : pos + 3; continue; }
      if (text[pos] === "<") {
        children.push(parseElement());
      } else {
        const start = pos;
        while (pos < len && text[pos] !== "<") pos++;
        textContent += decodeEntities(text.slice(start, pos));
      }
    }
    return { tag, attrs, children, text: textContent };
  }

  skipMisc();
  if (pos >= len || text[pos] !== "<") {
    throw Object.assign(new Error("Malformed XML part inside the document."), { code: "MALFORMED_XML" });
  }
  const root = parseElement();
  if (truncated) {
    throw Object.assign(new Error("Malformed XML part inside the document (an element was never closed)."), { code: "MALFORMED_XML" });
  }
  return root;
}

function child(node, tag) {
  return node ? node.children.find((c) => c.tag === tag) : undefined;
}
function children(node, tag) {
  return node ? node.children.filter((c) => c.tag === tag) : [];
}
function descendants(node, tag, out = []) {
  if (!node) return out;
  for (const c of node.children) {
    if (c.tag === tag) out.push(c);
    descendants(c, tag, out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Base64 (universal - works identically under Node and in the browser)
// ---------------------------------------------------------------------------

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function toBase64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 3) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    out += b1 === undefined ? "=" : B64_CHARS[((b1 & 15) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    out += b2 === undefined ? "=" : B64_CHARS[b2 & 63];
  }
  return out;
}

function mimeFromExt(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff" }[ext] || "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Relationships / styles / numbering
// ---------------------------------------------------------------------------

function parseRelationships(xmlText) {
  const map = new Map();
  if (!xmlText) return map;
  const root = parseXml(xmlText);
  for (const rel of children(root, "Relationship")) {
    map.set(rel.attrs["Id"], rel.attrs["Target"]);
  }
  return map;
}

function hasFlag(rPr, tag) {
  const el = child(rPr, tag);
  if (!el) return false;
  const v = el.attrs["w:val"];
  return v === undefined || v === "1" || v === "true" || v === "on";
}

// Built-in heading/title style fallbacks (used only when a paragraph
// references one of these style IDs without its own direct run formatting -
// most real documents override size/bold directly, as the reference file
// does, but this keeps other uploaded DOCX files reasonable too).
const BUILTIN_STYLE_DEFAULTS = {
  Title: { sizePt: 28, bold: true },
  Subtitle: { sizePt: 15, italic: true },
  Heading1: { sizePt: 20, bold: true },
  Heading2: { sizePt: 16, bold: true },
  Heading3: { sizePt: 13, bold: true },
  Heading4: { sizePt: 12, bold: true },
};

// Word's own built-in fallback (used only if the document has no styles.xml
// docDefaults at all) - matches what Word itself applies in that case.
const FALLBACK_SPACING = { beforePt: 0, afterPt: 10, lineHeight: 276 / 240 };

function parseStyles(xmlText) {
  const byId = {};
  let defaultSizePt = 11;
  let defaultFont = "Calibri";
  let defaultSpacing = FALLBACK_SPACING;
  if (!xmlText) return { byId, defaultSizePt, defaultFont, defaultSpacing };

  const root = parseXml(xmlText);
  const docDefaults = child(root, "w:docDefaults");
  const rPrDefault = docDefaults && child(child(docDefaults, "w:rPrDefault"), "w:rPr");
  if (rPrDefault) {
    const sz = child(rPrDefault, "w:sz");
    if (sz) defaultSizePt = Number(sz.attrs["w:val"]) / 2;
    const fonts = child(rPrDefault, "w:rFonts");
    if (fonts) defaultFont = fonts.attrs["w:ascii"] || fonts.attrs["w:hAnsi"] || defaultFont;
  }
  const pPrDefault = docDefaults && child(child(docDefaults, "w:pPrDefault"), "w:pPr");
  if (pPrDefault) {
    const resolved = paragraphSpacing(pPrDefault);
    defaultSpacing = {
      beforePt: resolved.beforePt ?? FALLBACK_SPACING.beforePt,
      afterPt: resolved.afterPt ?? FALLBACK_SPACING.afterPt,
      lineHeight: resolved.lineHeight ?? FALLBACK_SPACING.lineHeight,
    };
  }

  for (const styleNode of children(root, "w:style")) {
    const id = styleNode.attrs["w:styleId"];
    if (!id) continue;
    const pPr = child(styleNode, "w:pPr");
    const rPr = child(styleNode, "w:rPr");
    const numPr = pPr && child(pPr, "w:numPr");
    const numIdNode = numPr && child(numPr, "w:numId");
    const info = {
      basedOn: child(styleNode, "w:basedOn")?.attrs["w:val"] || null,
      numId: numIdNode ? numIdNode.attrs["w:val"] : null,
      align: (pPr && child(pPr, "w:jc")?.attrs["w:val"]) || null,
      sizePt: rPr && child(rPr, "w:sz") ? Number(child(rPr, "w:sz").attrs["w:val"]) / 2 : null,
      bold: rPr ? hasFlag(rPr, "w:b") || null : null,
      italic: rPr ? hasFlag(rPr, "w:i") || null : null,
      spacing: pPr ? paragraphSpacing(pPr) : null,
    };
    const builtin = BUILTIN_STYLE_DEFAULTS[id];
    if (builtin) {
      if (info.sizePt == null) info.sizePt = builtin.sizePt;
      if (info.bold == null) info.bold = builtin.bold || null;
      if (info.italic == null) info.italic = builtin.italic || null;
    }
    byId[id] = info;
  }

  // Resolve numId through basedOn chains (e.g. a style with no own numPr
  // that's based on one that does).
  function resolveNumId(id, depth = 0) {
    const info = byId[id];
    if (!info || depth > 20) return null;
    if (info.numId) return info.numId;
    return info.basedOn ? resolveNumId(info.basedOn, depth + 1) : null;
  }
  for (const id of Object.keys(byId)) byId[id].resolvedNumId = resolveNumId(id);

  return { byId, defaultSizePt, defaultFont, defaultSpacing };
}

function parseNumbering(xmlText) {
  const numToAbstract = new Map();
  const abstractFormat = new Map(); // abstractNumId -> 'bullet' | 'number' | other
  if (!xmlText) return { numToAbstract, abstractFormat };

  const root = parseXml(xmlText);
  for (const abs of children(root, "w:abstractNum")) {
    const id = abs.attrs["w:abstractNumId"];
    const lvl0 = children(abs, "w:lvl").find((l) => l.attrs["w:ilvl"] === "0") || children(abs, "w:lvl")[0];
    const fmt = lvl0 && child(lvl0, "w:numFmt")?.attrs["w:val"];
    abstractFormat.set(id, fmt === "bullet" ? "bullet" : fmt === "decimal" ? "number" : fmt ? "number" : null);
  }
  for (const num of children(root, "w:num")) {
    const numId = num.attrs["w:numId"];
    const absId = child(num, "w:abstractNumId")?.attrs["w:val"];
    if (numId && absId) numToAbstract.set(numId, absId);
  }
  return { numToAbstract, abstractFormat };
}

// ---------------------------------------------------------------------------
// Paragraph / run / table extraction
// ---------------------------------------------------------------------------

const EMU_PER_PX = 9525; // 1 px at 96dpi = 9525 EMU

function extractImage(drawingNode, ctx) {
  const blip = descendants(drawingNode, "a:blip")[0];
  const relId = blip && blip.attrs["r:embed"];
  if (!relId) return null;
  const target = ctx.rels.get(relId);
  if (!target) return null;
  const path = "word/" + target.replace(/^\.\.\//, "");
  const bytes = ctx.entries.get(path);
  if (!bytes) return null;

  const extent = descendants(drawingNode, "wp:extent")[0];
  const cx = extent ? Number(extent.attrs["cx"]) : 0;
  const cy = extent ? Number(extent.attrs["cy"]) : 0;

  return {
    type: "image",
    dataUrl: `data:${mimeFromExt(path)};base64,${toBase64(bytes)}`,
    // Kept at sub-pixel precision (not rounded to the nearest integer px) so
    // the width/height ratio exactly matches the source image's aspect
    // ratio - rounding both dimensions independently can drift the ratio by
    // up to ~1px, which is visible as slight distortion on small images.
    widthPx: cx ? cx / EMU_PER_PX : null,
    heightPx: cy ? cy / EMU_PER_PX : null,
  };
}

function resolveListType(numId, ctx) {
  if (!numId) return null;
  const absId = ctx.numbering.numToAbstract.get(numId);
  if (!absId) return null;
  return ctx.numbering.abstractFormat.get(absId) || "number";
}

function parseRun(rNode, ctx, inheritedSizePt) {
  const rPr = child(rNode, "w:rPr");
  const bold = rPr ? hasFlag(rPr, "w:b") : false;
  const italic = rPr ? hasFlag(rPr, "w:i") : false;
  const uNode = rPr && child(rPr, "w:u");
  const underline = Boolean(uNode && uNode.attrs["w:val"] && uNode.attrs["w:val"] !== "none");
  const szNode = rPr && child(rPr, "w:sz");
  const sizePt = szNode ? Number(szNode.attrs["w:val"]) / 2 : inheritedSizePt;

  const items = [];
  for (const node of rNode.children) {
    if (node.tag === "w:t") {
      items.push({ type: "text", text: node.text, bold, italic, underline, sizePt });
    } else if (node.tag === "w:tab") {
      items.push({ type: "tab" });
    } else if (node.tag === "w:br") {
      items.push({ type: node.attrs["w:type"] === "page" ? "pageBreak" : "br" });
    } else if (node.tag === "w:drawing") {
      const img = extractImage(node, ctx);
      if (img) items.push(img);
    }
  }
  return items;
}

function paragraphAlign(pPr) {
  const jc = pPr && child(pPr, "w:jc");
  if (!jc) return null;
  const v = jc.attrs["w:val"];
  return v === "both" || v === "distribute" ? "justify" : v === "center" || v === "right" || v === "left" ? v : null;
}

// Reads an explicit w:spacing element (used both for a single paragraph's
// own pPr and, from parseStyles, for the document-wide pPrDefault). Returns
// nulls for anything not explicitly set - callers fall back to inherited
// defaults themselves, since "not specified here" is different from "zero".
function paragraphSpacing(pPr) {
  const spacing = pPr && child(pPr, "w:spacing");
  if (!spacing) return { beforePt: null, afterPt: null, lineHeight: null };
  const twipsToPt = (t) => (t == null ? null : Number(t) / 20);
  let lineHeight = null;
  const line = spacing.attrs["w:line"];
  const lineRule = spacing.attrs["w:lineRule"];
  if (line) {
    if (!lineRule || lineRule === "auto") lineHeight = Number(line) / 240;
    else lineHeight = `${twipsToPt(line)}pt`;
  }
  return { beforePt: twipsToPt(spacing.attrs["w:before"]), afterPt: twipsToPt(spacing.attrs["w:after"]), lineHeight };
}

// A paragraph's effective spacing cascades through several layers, exactly
// like Word itself: its own explicit w:spacing first, then its paragraph
// style's spacing, then (for table cells only) the enclosing table's own
// style default, then finally the document-wide docDefaults spacing. Getting
// this right (rather than one arbitrary guess) is what determines how many
// lines/paragraphs fit per page, which is what keeps generated page breaks
// landing close to where Word itself would put them.
function pickSpacing(...layers) {
  const result = { beforePt: null, afterPt: null, lineHeight: null };
  for (const key of ["beforePt", "afterPt", "lineHeight"]) {
    for (const layer of layers) {
      if (layer && layer[key] != null) { result[key] = layer[key]; break; }
    }
  }
  return result;
}

function parseParagraph(pNode, ctx, contextSpacing = null) {
  const pPr = child(pNode, "w:pPr");
  const pStyleId = pPr && child(pPr, "w:pStyle")?.attrs["w:val"];
  const styleInfo = pStyleId ? ctx.styles.byId[pStyleId] : null;

  const ownNumPr = pPr && child(pPr, "w:numPr");
  const ownNumId = ownNumPr && child(ownNumPr, "w:numId")?.attrs["w:val"];
  const effectiveNumId = ownNumId || styleInfo?.resolvedNumId || null;
  const listType = resolveListType(effectiveNumId, ctx);

  const align = paragraphAlign(pPr) || styleInfo?.align || null;
  const inheritedSizePt = styleInfo?.sizePt || ctx.styles.defaultSizePt;
  const styleBold = styleInfo?.bold || false;
  const styleItalic = styleInfo?.italic || false;

  const spacing = pickSpacing(paragraphSpacing(pPr), styleInfo?.spacing, contextSpacing, ctx.styles.defaultSpacing);

  let inlines = [];
  for (const node of pNode.children) {
    if (node.tag === "w:r") {
      const runItems = parseRun(node, ctx, inheritedSizePt);
      for (const item of runItems) {
        if (item.type === "text") {
          item.bold = item.bold || styleBold;
          item.italic = item.italic || styleItalic;
        }
      }
      inlines.push(...runItems);
    } else if (node.tag === "w:hyperlink") {
      for (const r of children(node, "w:r")) {
        const runItems = parseRun(r, ctx, inheritedSizePt);
        for (const item of runItems) {
          if (item.type === "text") {
            item.bold = item.bold || styleBold;
            item.italic = item.italic || styleItalic;
          }
        }
        inlines.push(...runItems);
      }
    }
  }

  return { type: "paragraph", align, listType, spacing, inlines };
}

// Table styles (e.g. "Table Grid") conventionally reset paragraph spacing
// to compact/single-line for their cell content - the reference document's
// own TableGrid style declares exactly this (w:after="0" w:line="240"). This
// project doesn't fully resolve arbitrary table-style pPr defaults, but this
// is by far the most common convention, so it's used as the fallback layer
// for any table cell rather than letting cells inherit the (much larger)
// body-paragraph default and bloat every row.
const TABLE_CELL_SPACING = { beforePt: 0, afterPt: 0, lineHeight: 1 };

function parseTable(tblNode, ctx) {
  const tblPr = child(tblNode, "w:tblPr");
  const align = (tblPr && child(tblPr, "w:jc")?.attrs["w:val"]) || null;
  const tblGrid = child(tblNode, "w:tblGrid");
  const gridCols = tblGrid ? children(tblGrid, "w:gridCol").map((g) => Number(g.attrs["w:w"]) || 0) : [];

  const rows = children(tblNode, "w:tr").map((tr) => ({
    cells: children(tr, "w:tc").map((tc) => {
      const tcPr = child(tc, "w:tcPr");
      const vAlignNode = tcPr && child(tcPr, "w:vAlign");
      const gridSpanNode = tcPr && child(tcPr, "w:gridSpan");
      return {
        vAlign: vAlignNode ? vAlignNode.attrs["w:val"] : "top",
        colSpan: gridSpanNode ? Number(gridSpanNode.attrs["w:val"]) || 1 : 1,
        paragraphs: children(tc, "w:p").map((p) => parseParagraph(p, ctx, TABLE_CELL_SPACING)),
      };
    }),
  }));

  return { type: "table", align, gridCols, rows };
}

function parseSectPr(sectPrNode) {
  const twipsToIn = (t) => (t == null ? null : Number(t) / 1440);
  const pgSz = child(sectPrNode, "w:pgSz");
  const pgMar = child(sectPrNode, "w:pgMar");
  const footerRef = child(sectPrNode, "w:footerReference");
  return {
    widthIn: pgSz ? twipsToIn(pgSz.attrs["w:w"]) : 8.5,
    heightIn: pgSz ? twipsToIn(pgSz.attrs["w:h"]) : 11,
    marginTopIn: pgMar ? twipsToIn(pgMar.attrs["w:top"]) : 1,
    marginRightIn: pgMar ? twipsToIn(pgMar.attrs["w:right"]) : 1,
    marginBottomIn: pgMar ? twipsToIn(pgMar.attrs["w:bottom"]) : 1,
    marginLeftIn: pgMar ? twipsToIn(pgMar.attrs["w:left"]) : 1,
    footerRelId: footerRef ? footerRef.attrs["r:id"] : null,
  };
}

const DEFAULT_SECT = { widthIn: 8.5, heightIn: 11, marginTopIn: 1, marginRightIn: 1, marginBottomIn: 1, marginLeftIn: 1, footerRelId: null };

// ---------------------------------------------------------------------------
// Top-level parse
// ---------------------------------------------------------------------------

export async function parseDocx(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let entries;
  try {
    entries = await readZip(bytes);
  } catch (err) {
    if (err.code) throw err;
    throw Object.assign(new Error("This file could not be read as a .docx package."), { code: "NOT_DOCX" });
  }

  if (!entries.has("word/document.xml")) {
    throw Object.assign(new Error("This doesn't look like a Word (.docx) file - the document content could not be found."), { code: "NOT_DOCX" });
  }

  const decode = (name) => (entries.has(name) ? new TextDecoder("utf-8").decode(entries.get(name)) : null);

  let doc;
  try {
    doc = parseXml(decode("word/document.xml"));
  } catch {
    throw Object.assign(new Error("This .docx file's content is malformed or corrupted and could not be parsed."), { code: "CORRUPTED" });
  }

  const rels = parseRelationships(decode("word/_rels/document.xml.rels"));
  const styles = parseStyles(decode("word/styles.xml"));
  const numbering = parseNumbering(decode("word/numbering.xml"));
  const ctx = { rels, styles, numbering, entries };

  const body = child(doc, "w:body");
  if (!body) {
    throw Object.assign(new Error("This .docx file has no readable document body."), { code: "EMPTY" });
  }

  const blocks = [];
  let sectPr = null;
  for (const node of body.children) {
    if (node.tag === "w:p") {
      const pPrSect = child(child(node, "w:pPr"), "w:sectPr");
      if (pPrSect) sectPr = parseSectPr(pPrSect); // multi-section documents (not otherwise supported) - at least capture page setup
      blocks.push(parseParagraph(node, ctx));
    } else if (node.tag === "w:tbl") {
      blocks.push(parseTable(node, ctx));
    } else if (node.tag === "w:sectPr") {
      sectPr = parseSectPr(node);
    }
  }

  let footerBlocks = [];
  if (sectPr?.footerRelId) {
    const target = rels.get(sectPr.footerRelId);
    const footerXml = target && decode("word/" + target);
    if (footerXml) {
      try {
        const footerDoc = parseXml(footerXml);
        footerBlocks = children(footerDoc, "w:p").map((p) => parseParagraph(p, ctx));
      } catch {
        // footer couldn't be parsed - safe to omit, does not affect main content
      }
    }
  }

  const warnings = [];
  const hasAnyContent = blocks.some(
    (b) => (b.type === "paragraph" && b.inlines.some((i) => i.type !== "pageBreak")) || (b.type === "table" && b.rows.length)
  );
  if (!hasAnyContent) warnings.push("This document appears to be empty or contains no readable text, tables or images.");

  return { blocks, footerBlocks, pageSetup: sectPr || DEFAULT_SECT, warnings };
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderInlineItems(items) {
  let html = "";
  for (const item of items) {
    if (item.type === "br") html += "<br>";
    else if (item.type === "tab") html += '<span class="wtp-tab"></span>';
    else if (item.type === "image") {
      const w = item.widthPx ? `width:${item.widthPx.toFixed(2)}px;` : "";
      const h = item.heightPx ? `height:${item.heightPx.toFixed(2)}px;` : "";
      html += `<img class="wtp-img" src="${item.dataUrl}" style="${w}${h}max-width:100%;">`;
    } else if (item.type === "text") {
      if (!item.text) continue;
      const style = [];
      if (item.bold) style.push("font-weight:bold");
      if (item.italic) style.push("font-style:italic");
      if (item.underline) style.push("text-decoration:underline");
      if (item.sizePt) style.push(`font-size:${item.sizePt}pt`);
      html += `<span style="${style.join(";")}">${escapeHtml(item.text)}</span>`;
    }
  }
  return html;
}

// A paragraph containing a manual page break is split at that point into
// separate <p> segments with a break-marker div between them, so the break
// lands exactly where it did in the source instead of being lost or shifting
// to the nearest paragraph boundary.
function splitOnPageBreaks(inlines) {
  const segments = [[]];
  for (const item of inlines) {
    if (item.type === "pageBreak") segments.push([]);
    else segments[segments.length - 1].push(item);
  }
  return segments;
}

function paragraphStyleAttr(p) {
  const style = [];
  if (p.align) style.push(`text-align:${p.align}`);
  if (p.spacing.beforePt != null) style.push(`margin-top:${p.spacing.beforePt}pt`);
  if (p.spacing.afterPt != null) style.push(`margin-bottom:${p.spacing.afterPt}pt`);
  if (p.spacing.lineHeight != null) style.push(`line-height:${p.spacing.lineHeight}`);
  return style.join(";");
}

function renderParagraph(p) {
  const segments = splitOnPageBreaks(p.inlines);
  if (segments.length === 1) {
    const inner = renderInlineItems(p.inlines);
    return `<p class="wtp-p" style="${paragraphStyleAttr(p)}">${inner || "&nbsp;"}</p>`;
  }
  let html = "";
  segments.forEach((seg, i) => {
    const inner = renderInlineItems(seg);
    if (inner) html += `<p class="wtp-p" style="${paragraphStyleAttr(p)}">${inner}</p>`;
    if (i < segments.length - 1) html += '<div class="wtp-page-break"></div>';
  });
  return html || '<div class="wtp-page-break"></div>';
}

function renderTable(t) {
  const totalWidth = t.gridCols.reduce((a, b) => a + b, 0);
  const colgroup = t.gridCols.length
    ? `<colgroup>${t.gridCols.map((w) => `<col style="width:${((w / (totalWidth || 1)) * 100).toFixed(3)}%;">`).join("")}</colgroup>`
    : "";
  const rowsHtml = t.rows
    .map((row) => {
      const cellsHtml = row.cells
        .map((cell) => {
          const vAlign = cell.vAlign === "center" ? "middle" : cell.vAlign === "bottom" ? "bottom" : "top";
          const inner = cell.paragraphs.map(renderParagraph).join("") || "&nbsp;";
          const colspanAttr = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : "";
          return `<td${colspanAttr} style="vertical-align:${vAlign};">${inner}</td>`;
        })
        .join("");
      return `<tr>${cellsHtml}</tr>`;
    })
    .join("");
  const alignStyle = t.align === "center" ? "margin-left:auto;margin-right:auto;" : t.align === "right" ? "margin-left:auto;" : "";
  return `<table class="wtp-table" style="${alignStyle}">${colgroup}<tbody>${rowsHtml}</tbody></table>`;
}

function renderBlocks(blocks) {
  let html = "";
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === "paragraph" && b.listType) {
      const tag = b.listType === "number" ? "ol" : "ul";
      let items = "";
      while (i < blocks.length && blocks[i].type === "paragraph" && blocks[i].listType === b.listType) {
        items += `<li>${renderInlineItems(blocks[i].inlines) || "&nbsp;"}</li>`;
        i++;
      }
      html += `<${tag} class="wtp-list">${items}</${tag}>`;
      continue;
    }
    if (b.type === "paragraph") html += renderParagraph(b);
    else if (b.type === "table") html += renderTable(b);
    i++;
  }
  return html;
}

/**
 * Builds the printable HTML body, a page-setup object for CSS @page sizing,
 * and the footer HTML (rendered once - see the module doc comment above for
 * why a per-physical-page repeating footer isn't achievable with the
 * browser's native print pipeline).
 */
export function renderDocumentHtml(parsed) {
  const bodyHtml = renderBlocks(parsed.blocks);
  const footerHtml = parsed.footerBlocks.length ? renderBlocks(parsed.footerBlocks) : "";
  return { bodyHtml, footerHtml, pageSetup: parsed.pageSetup };
}

export async function convertDocxToHtml(arrayBuffer) {
  const parsed = await parseDocx(arrayBuffer);
  const rendered = renderDocumentHtml(parsed);
  return { ...rendered, warnings: parsed.warnings };
}
