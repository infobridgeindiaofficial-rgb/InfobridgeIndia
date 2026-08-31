export const A4 = { width: 210, height: 297, marginX: 18, headerY: 18, bodyTop: 72, bodyBottom: 260, footerY: 280 };
export const FOOTER_LAYOUT = { top: 268, waveTop: 273, darkWaveTop: 287, textTop: 277, safeMargin: 18, textWidth: 174, fontSize: 7.4, lineHeight: 3.8 };
export const IMAGE_LIMIT = 5 * 1024 * 1024;
export const THEMES = {
  ocean: { name: "Ocean Blue", primary: "#0A4F82", secondary: "#2F80C9", rgb: [10,79,130], secondaryRgb: [47,128,201] },
  forest: { name: "Forest Green", primary: "#17633D", secondary: "#3A9564", rgb: [23,99,61], secondaryRgb: [58,149,100] },
  maroon: { name: "Royal Maroon", primary: "#7B1931", secondary: "#B13B55", rgb: [123,25,49], secondaryRgb: [177,59,85] },
  purple: { name: "Deep Purple", primary: "#512A82", secondary: "#7650A8", rgb: [81,42,130], secondaryRgb: [118,80,168] },
};

export const TEMPLATES = {
  custom: "",
  general: "<p>Dear Sir/Madam,</p><p>We are writing regarding [purpose of this letter].</p><p>Please let us know if you require any additional information.</p>",
  request: "<p>Dear Sir/Madam,</p><p>We kindly request [describe your request].</p><p>We would appreciate your consideration and look forward to your response.</p>",
  payment: "<p>Dear Sir/Madam,</p><p>This is a friendly reminder that payment for [invoice/reference] is currently due.</p><p>Please arrange payment at your earliest convenience or contact us if you need clarification.</p>",
  confirmation: "<p>Dear Sir/Madam,</p><p>We are pleased to confirm [details being confirmed].</p><p>Please retain this letter for your records.</p>",
  quotation: "<p>Dear Sir/Madam,</p><p>Please find our quotation for [products/services] attached for your consideration.</p><p>We would be pleased to answer any questions and look forward to working with you.</p>",
  thanks: "<p>Dear Sir/Madam,</p><p>Thank you for [reason]. We sincerely appreciate your support and continued association.</p><p>We look forward to serving you again.</p>",
};

export function sanitizeRichText(html = "") {
  return String(html)
    .replace(/<\/?(?:script|style|iframe|object|embed|form)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(?:href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, "")
    .replace(/<(p|div)\b[^>]*(?:text-align\s*:\s*(left|center|right)|align\s*=\s*["']?(left|center|right))[^>]*>/gi, (_, tag, cssAlign, attrAlign) => `<${tag} data-align="${cssAlign || attrAlign}">`)
    .replace(/<(p|div)(?! data-align)\b[^>]*>/gi, "<$1>")
    .replace(/<(strong|b|em|i|u|ul|ol|li)\b[^>]*>/gi, "<$1>")
    .replace(/<(?!\/?(?:p|br|strong|b|em|i|u|ul|ol|li|div)\b)[^>]+>/gi, "");
}

function decodeEntities(text) {
  return String(text).replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'");
}

function blockFromHtml(html, type = "paragraph", align = "left") {
  const text = decodeEntities(html.replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]*>/g,""));
  return { type: type === "paragraph" && !text.trim() ? "blank" : type, align, html, text };
}

export function richTextToBlocks(html = "") {
  const safe = sanitizeRichText(html).replace(/\r/g, "");
  const blocks = [];
  const token = /<(ul|ol)>([\s\S]*?)<\/\1>|<(p|div)(?: data-align="(left|center|right)")?>([\s\S]*?)<\/\3>/gi;
  let match;
  while ((match = token.exec(safe))) {
    if (match[1]) {
      const type = match[1] === "ol" ? "number" : "bullet";
      const itemRe = /<li>([\s\S]*?)<\/li>/gi;
      let item;
      while ((item = itemRe.exec(match[2]))) blocks.push(blockFromHtml(item[1], type));
    } else {
      blocks.push(blockFromHtml(match[5], "paragraph", match[4] || "left"));
    }
  }
  if (!blocks.length) {
    const plain = richTextToPlain(safe);
    for (const line of plain.split("\n")) blocks.push({ type: line.trim() ? "paragraph" : "blank", align: "left", html: line, text: line });
  }
  return blocks;
}

export function plainTextToRichText(text = "") {
  const escape = (value) => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const lines = String(text).replace(/\r/g, "").split("\n");
  let html = "", list = null;
  const close = () => { if (list) html += `</${list}>`; list = null; };
  for (const raw of lines) {
    const bullet = /^\s*[•*-]\s+(.+)$/.exec(raw);
    const numbered = /^\s*\d+[.)]\s+(.+)$/.exec(raw);
    if (bullet || numbered) {
      const next = bullet ? "ul" : "ol";
      if (list !== next) { close(); list = next; html += `<${list}>`; }
      html += `<li>${escape((bullet || numbered)[1])}</li>`;
    } else {
      close();
      html += raw.trim() ? `<p>${escape(raw)}</p>` : "<p><br></p>";
    }
  }
  close();
  return html;
}

export function richTextToPlain(html = "") {
  return sanitizeRichText(html)
    .replace(/<li[^>]*>/gi, "\n• ").replace(/<\/(?:p|div|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n").trim();
}

export function inlineTextRuns(html = "") {
  const safe = sanitizeRichText(html), runs = [], style = { bold: false, italic: false, underline: false };
  for (const token of safe.match(/<[^>]+>|[^<]+/g) || []) {
    const tag = token.toLowerCase();
    if (tag === "<strong>" || tag === "<b>") style.bold = true;
    else if (tag === "</strong>" || tag === "</b>") style.bold = false;
    else if (tag === "<em>" || tag === "<i>") style.italic = true;
    else if (tag === "</em>" || tag === "</i>") style.italic = false;
    else if (tag === "<u>") style.underline = true;
    else if (tag === "</u>") style.underline = false;
    else if (/^<br\s*\/?\s*>$/.test(tag)) runs.push({ text: "\n", ...style });
    else if (!tag.startsWith("<")) runs.push({ text: decodeEntities(token), ...style });
  }
  return runs;
}

export function validateLetter(state) {
  return state?.companyName?.trim() ? [] : ["Company Name is required."];
}

export function wrapText(text, maxChars = 88) {
  const lines = [];
  for (const paragraph of String(text || "").split("\n")) {
    if (!paragraph) { lines.push(""); continue; }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (line && `${line} ${word}`.length > maxChars) { lines.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines;
}

export function buildLetterPages(state, { blank = false } = {}) {
  if (blank) return [{ lines: [], items: [], first: true, last: true }];
  const items = [];
  if (state.date || state.reference) items.push({type:"meta",text:state.date?`Date: ${state.date}`:"",right:state.reference?`Ref No: ${state.reference}`:""});
  const recipient = [state.recipientName,state.recipientDesignation,state.recipientCompany,state.recipientAddress].filter(Boolean);
  if (recipient.length) items.push({type:"recipient",text:["To,",...recipient].join("\n")});
  if (state.subject) items.push({type:"subject",text:`Subject: ${state.subject}`});
  items.push(...richTextToBlocks(state.message));
  items.push({type:"closing",text:state.closing||"Sincerely,"});
  if (state.authorizedName) items.push({type:"signatory",text:state.authorizedName});
  if (state.designation) items.push({type:"designation",text:state.designation});
  const expanded=[];
  for(const item of items){const lines=item.type==="blank"?[]:wrapText(item.text,88);if(lines.length<=12)expanded.push({...item,lines});else for(let i=0;i<lines.length;i+=12)expanded.push({...item,lines:lines.slice(i,i+12),continuation:i>0});}
  const pages=[];let current=[],used=0,capacity=38;
  for(const item of expanded){const gap=item.type==="blank"?.3:item.type==="paragraph"?.55:["bullet","number"].includes(item.type)?.2:1;const units=(item.type==="blank"?0:item.lines.length)+gap;if(current.length&&used+units>capacity){pages.push({items:current,lines:current.flatMap(x=>x.lines),first:pages.length===0,last:false});current=[];used=0;capacity=46}current.push(item);used+=units}
  pages.push({items:current,lines:current.flatMap(x=>x.lines),first:pages.length===0,last:false});
  pages[pages.length - 1].last = true;
  return pages;
}

export function optionalCompanyLines(state) {
  return [
    [state.address1, state.address2].filter(Boolean).join(", "),
    [state.city, state.region, state.postalCode, state.country].filter(Boolean).join(", "),
    [state.phone, state.email, state.website].filter(Boolean).join("  •  "),
    [state.taxId && `Tax ID: ${state.taxId}`, state.registrationNo && `Registration: ${state.registrationNo}`].filter(Boolean).join("  •  "),
  ].filter(Boolean);
}

export function companyAddressLines(state = {}) {
  const locality = [state.city, state.region].filter(Boolean).join(", ");
  const localityWithPostal = [locality, state.postalCode].filter(Boolean).join(locality && state.postalCode ? " \u2013 " : "");
  return [
    state.address1,
    state.address2,
    [localityWithPostal, state.country].filter(Boolean).join(", "),
  ].map(value => String(value || "").trim()).filter(Boolean);
}

export function buildFooterLines(state = {}) {
  const locality = [state.city, state.region, state.postalCode, state.country].filter(Boolean).join(", ");
  const items = [state.address1, locality, state.phone, state.email, state.website].map(value => String(value || "").trim()).filter(Boolean);
  if (!items.length) return [];
  const separator = " · ", target = Math.ceil((items.join(separator).length - separator.length) / 2);
  const lines = [""];
  for (const item of items) {
    const candidate = [lines[0], item].filter(Boolean).join(separator);
    if (lines.length === 1 && lines[0] && candidate.length > target) lines.push(item);
    else lines[lines.length - 1] = [lines[lines.length - 1], item].filter(Boolean).join(separator);
  }
  return lines.slice(0, 2);
}
