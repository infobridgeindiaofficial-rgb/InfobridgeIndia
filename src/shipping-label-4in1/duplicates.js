import { identifyCourier } from "./couriers.js";

export function normalizeIdentifier(value) {
  return String(value || "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function fieldValues(text, field) {
  const values = new Set();
  const pattern = new RegExp(`\\b(?:${field})\\s*(?:ID|Number|No\\.?)?\\s*[:#.]?\\s*([^\\n:]+)`, "gi");
  for (const match of text.matchAll(pattern)) {
    const tail = match[1].trim().split(/\b(?:Order|Shipment|AWB|Tracking|Invoice|Date|SKU|Qty|Customer|Phone|Weight)\b(?![-_])/i)[0].trim();
    const token = tail.match(/^[A-Z0-9][A-Z0-9_-]*(?:[ \t]+[A-Z0-9_-]+)*/i)?.[0];
    if (!token) continue;
    const parts = token.split(/\s+/);
    const spacedIdentifier = parts.length > 1 && (parts.every(part => /\d/.test(part) || /^[_-]+$/.test(part))
      || (parts.every((part, index) => /^[\d_-]+$/.test(part) || (index === 0 && /^[A-Z]{1,8}$/i.test(part))) && parts.some(part => /\d/.test(part)))
      || (parts.every(part => part.length === 1) && parts.some(part => /\d/.test(part))));
    const value = spacedIdentifier ? parts.join("") : parts[0];
    const normalized = normalizeIdentifier(value);
    if (normalized.length >= 6 && normalized.length <= 40 && /\d/.test(normalized)) values.add(normalized);
  }
  return [...values];
}

export function parseLabelIdentity(input) {
  const text = String(input || "").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/[\u2010-\u2015]/g, "-").replace(/\r/g, "\n");
  const amazonOrders = [...text.matchAll(/\b\d{3}\s*-\s*\d{7}\s*-\s*\d{7}\b/g)].map(match => normalizeIdentifier(match[0]));
  const flipkartOrders = [...text.matchAll(/\bOD\d{12,25}\b/gi)].map(match => normalizeIdentifier(match[0]));
  const meeshoSubOrders = [...text.matchAll(/\b\d{10,22}\s*[_-]\s*\d{1,4}\b/g)].map(match => normalizeIdentifier(match[0]));
  const marketplace = /\bamazon\b/i.test(text) ? "Amazon"
    : /\bflipkart\b/i.test(text) ? "Flipkart"
      : /\bmeesho\b/i.test(text) ? "Meesho"
        : amazonOrders.length ? "Amazon" : flipkartOrders.length ? "Flipkart"
          : /\bvalmo\b/i.test(text) || (meeshoSubOrders.length && /Customer Address|Product Details/i.test(text)) ? "Meesho"
            : /\be-?kart\b/i.test(text) && /Not for resale|Printed at/i.test(text) ? "Flipkart" : "Unknown";
  const orders = marketplace === "Amazon" ? amazonOrders : marketplace === "Flipkart" ? flipkartOrders : fieldValues(text, "(?<!Sub[ -])Order").filter(value => /^\d{10,22}$/.test(value));
  if (marketplace === "Meesho") {
    for (const match of text.matchAll(/\b(\d{10,22})\s*[_-]\s*\d{1,4}\b/g)) orders.push(match[1]);
  }
  const subOrders = fieldValues(text, "Sub[ -]?Order");
  if (marketplace === "Meesho") subOrders.push(...meeshoSubOrders);
  const awbs = fieldValues(text, "AWB|Tracking(?:[ -]?(?:Number|ID|No\\.?))?|Air[ -]?Waybill|Waybill");
  if (marketplace === "Meesho") {
    for (const match of text.matchAll(/\bVL\d{10,18}\b/gi)) awbs.push(normalizeIdentifier(match[0]));
    if (!awbs.length && /\b(?:delhivery|xpress[ -]?bees|shadowfax)\b/i.test(text)) {
      const shippingText = text.split(/Product Details|BILL OF SUPPLY|Tax Invoice/i)[0];
      for (const match of shippingText.matchAll(/(?:^|\n)[ \t]*(SF\d{8,16}[A-Z]{0,6}|\d{12,16})[ \t]*(?=\n|$)/gi)) awbs.push(normalizeIdentifier(match[1]));
    }
  }
  const shipments = fieldValues(text, "Shipment|Shipping[ -]?ID");
  const unique = values => [...new Set(values)];
  const fields = { orders: unique(orders), subOrders: unique(subOrders), awbs: unique(awbs), shipments: unique(shipments) };
  const ambiguous = [fields.awbs, fields.shipments, fields.subOrders].some(values => values.length > 1);
  const identity = {
    marketplace,
    orderId: fields.orders.length === 1 ? fields.orders[0] : "",
    subOrderId: fields.subOrders.length === 1 ? fields.subOrders[0] : "",
    awb: fields.awbs.length === 1 ? fields.awbs[0] : "",
    shipmentId: fields.shipments.length === 1 ? fields.shipments[0] : "",
    ambiguous,
  };
  identity.comparable = !ambiguous && Boolean(identity.awb || identity.shipmentId || (marketplace === "Meesho" && identity.subOrderId));
  return identity;
}

export function sameShipment(first, second) {
  if (!first.comparable || !second.comparable || first.marketplace !== second.marketplace) return false;
  for (const field of ["awb", "shipmentId", "subOrderId"]) {
    if (first[field] && second[field] && first[field] !== second[field]) return false;
  }
  if (first.awb && first.awb === second.awb) return true;
  if (first.shipmentId && first.shipmentId === second.shipmentId) return true;
  return first.marketplace === "Meesho" && !first.awb && !second.awb && !first.shipmentId && !second.shipmentId
    && Boolean(first.subOrderId && first.subOrderId === second.subOrderId);
}

export function findDuplicateLabels(labels) {
  const groups = [];
  const duplicates = [];
  for (const label of labels) {
    const group = groups.find(candidates => candidates.every(candidate => sameShipment(candidate, label)));
    if (group) {
      duplicates.push({ original: group[0], duplicate: label });
      group.push(label);
    } else groups.push([label]);
  }
  return duplicates;
}

let libraryPromise;
export async function extractLabelIdentities(bytes, library) {
  if (!library) {
    libraryPromise ||= import("../vendor/pdf.js");
    library = await libraryPromise;
    library.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.min.js", import.meta.url).href;
  }
  const task = library.getDocument({
    data: new Uint8Array(bytes), isEvalSupported: false, verbosity: 0,
    cMapUrl: new URL("../vendor/pdfjs-cmaps/", import.meta.url).href, cMapPacked: true,
    standardFontDataUrl: new URL("../vendor/pdfjs-fonts/", import.meta.url).href,
    wasmUrl: new URL("../vendor/pdfjs-wasm/", import.meta.url).href,
  });
  try {
    const document = await task.promise;
    const identities = [];
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      const text = content.items.map(item => (item.str || "") + (item.hasEOL ? "\n" : "  ")).join("");
      const identity = parseLabelIdentity(text);
      identities.push({ ...identity, ...identifyCourier(text, identity.awb) });
      page.cleanup();
    }
    return identities;
  } finally {
    await task.destroy();
  }
}
