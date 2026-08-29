import { formatCountryMoney, resolveCountryConfig } from "../country/registry.js";
import { BRANDED_DOCUMENT_BASE_CSS, renderInfoBridgeFooter } from "../export/document.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const displayDate = value => value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : "";
const detail = (label, value) => value ? `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>` : "";
const line = value => value ? `<div>${esc(value)}</div>` : "";

function safeLogo(company) {
  const logo = String(company?.logo || company?.logoDataUrl || company?.branding?.logo || "").trim();
  return /^(data:image\/(png|jpeg|jpg|webp);base64,|https?:\/\/|\/)/i.test(logo) ? logo : "";
}

function customerBlock(party) {
  const address = party?.billingAddress || party?.address || party?.shippingAddress || "";
  return [
    `<strong class="quote-party-name">${esc(party?.name || "Customer")}</strong>`,
    line(party?.contactPerson), line(address), line(party?.mobile), line(party?.email),
  ].filter(Boolean).join("");
}

function companyAddressLines(company, country) {
  const values = [company.address || company.registeredAddress, company.addressLine2, company.city, company.emirate || company.state, company.postalCode, country === "AE" ? "UAE" : "India"];
  const lines = [];
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text) continue;
    const normalized = text.toLowerCase();
    if (lines.some(existing => existing.toLowerCase() === normalized || existing.toLowerCase().includes(normalized))) continue;
    lines.push(text);
  }
  return lines;
}

export function renderQuotationDocument({ quote, company = {}, party = {} }) {
  const config = resolveCountryConfig(quote?.country || quote?.countryCode || company);
  const ae = config.country === "AE";
  const money = value => formatCountryMoney(num(value), config.country, { currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const companyName = company.name || company.tradeName || company.legalName || "Company";
  const companyAddress = companyAddressLines(company, config.country).map(line).join("");
  const registration = ae ? (company.vatRegistered !== false && company.trn ? `TRN: ${company.trn}` : "") : (company.gstRegistered !== false && company.gstin ? `GSTIN: ${company.gstin}` : "");
  const logo = safeLogo(company);
  const items = Array.isArray(quote.items) ? quote.items : [];
  const subtotal = items.reduce((sum, item) => sum + num(item.quantity) * num(item.rate), 0);
  const discount = Math.max(0, subtotal - num(quote.taxable));
  const rates = [...new Set(items.map(item => num(item.taxRate ?? item.gstRate)).filter(rate => rate > 0))];
  const vatLabel = rates.length === 1 ? `VAT ${rates[0]}%` : "VAT";
  const taxRows = ae
    ? `<div><span>${vatLabel}</span><strong>${money(quote.vat)}</strong></div>`
    : [num(quote.cgst) ? `<div><span>CGST</span><strong>${money(quote.cgst)}</strong></div>` : "", num(quote.sgst) ? `<div><span>SGST</span><strong>${money(quote.sgst)}</strong></div>` : "", num(quote.igst) ? `<div><span>IGST</span><strong>${money(quote.igst)}</strong></div>` : ""].join("");
  const rows = items.map((item, index) => `<tr><td>${index + 1}</td><td><strong>${esc(item.description || "")}</strong></td><td>${esc(ae ? item.itemCode || "-" : item.hsnSac || "-")}</td><td class="number">${esc(item.quantity)}</td><td>${esc(item.unit || "")}</td><td class="money">${money(item.rate)}</td><td class="number">${num(item.discount)}%</td><td class="number">${num(item.taxRate ?? item.gstRate)}%</td><td class="money">${money(item.taxable ?? num(item.quantity) * num(item.rate) * (1 - num(item.discount) / 100))}</td></tr>`).join("");
  const notes = quote.customerNotes ? `<section class="text-section"><h2>Customer Notes</h2><p>${esc(quote.customerNotes)}</p></section>` : "";
  const terms = quote.terms ? `<section class="text-section"><h2>Terms &amp; Conditions</h2><p>${esc(quote.terms)}</p></section>` : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title></title><style>
  ${BRANDED_DOCUMENT_BASE_CSS}@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#17252b;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}.quotation-document{width:100%;max-width:186mm;margin:0 auto}.document-header{display:grid;grid-template-columns:1fr 64mm;gap:14mm;align-items:start;border-bottom:2px solid #0d6658;padding-bottom:8mm}.brand{display:flex;gap:5mm;align-items:flex-start}.company-logo{display:block;width:auto;height:auto;max-width:38mm;max-height:18mm;object-fit:contain;object-position:left top}.company-copy{display:grid;gap:1mm}.company-copy h1{font-size:17px;line-height:1.15;margin:0 0 1mm;color:#12352d}.company-copy div{color:#475b61}.document-title{text-align:right}.document-title h2{font-size:28px;letter-spacing:.08em;color:#0d6658;margin:0 0 5mm}.metadata{display:grid;grid-template-columns:1fr 1fr;gap:2mm 5mm}.metadata div{display:grid;text-align:left}.metadata span,.reference-grid span{font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#6b7c81}.metadata strong,.reference-grid strong{font-size:10px;color:#17252b}.party-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:10mm;margin:8mm 0}.party-card,.reference-card{border:1px solid #d9e1e2;border-radius:2mm;padding:5mm;min-height:31mm}.section-label{display:block;color:#0d6658;font-size:9px;font-weight:700;letter-spacing:.08em;margin-bottom:3mm}.quote-party-name{display:block;font-size:14px;margin-bottom:2mm;color:#12352d}.party-card div{margin-top:.7mm;color:#475b61}.reference-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm 5mm}.reference-grid div{display:grid}.items-table{width:100%;border-collapse:collapse;table-layout:fixed}.items-table thead{display:table-header-group}.items-table tr{break-inside:avoid;page-break-inside:avoid}.items-table th{background:#12352d;color:#fff;font-size:7.5px;text-transform:uppercase;letter-spacing:.025em;padding:2.6mm 1.4mm;text-align:left}.items-table td{border-bottom:1px solid #dfe5e6;padding:2.8mm 1.4mm;vertical-align:top;overflow-wrap:anywhere}.items-table th:nth-child(1),.items-table td:nth-child(1){width:4%;text-align:center}.items-table th:nth-child(2),.items-table td:nth-child(2){width:25%}.items-table th:nth-child(3),.items-table td:nth-child(3){width:12%}.items-table th:nth-child(4),.items-table td:nth-child(4){width:6%;text-align:right}.items-table th:nth-child(5),.items-table td:nth-child(5){width:8%}.items-table th:nth-child(6),.items-table td:nth-child(6){width:14%;text-align:right}.items-table th:nth-child(7),.items-table td:nth-child(7){width:8%;text-align:right}.items-table th:nth-child(8),.items-table td:nth-child(8){width:7%;text-align:right}.items-table th:nth-child(9),.items-table td:nth-child(9){width:16%;text-align:right}.number,.money{white-space:nowrap;text-align:right}.summary-wrap{display:flex;justify-content:flex-end;margin-top:6mm;break-inside:avoid}.summary{width:72mm}.summary>div{display:grid;grid-template-columns:1fr auto;gap:8mm;padding:1.5mm 0;color:#475b61}.summary strong{color:#17252b}.summary .grand-total{border-top:2px solid #0d6658;margin-top:2mm;padding-top:3mm;color:#12352d;font-size:14px;font-weight:700}.text-section{margin-top:6mm;break-inside:avoid}.text-section h2{font-size:10px;color:#0d6658;text-transform:uppercase;letter-spacing:.06em;margin:0 0 2mm}.text-section p{white-space:pre-wrap;margin:0;color:#475b61}.signature{display:flex;justify-content:flex-end;margin-top:14mm;break-inside:avoid}.signature div{width:62mm;text-align:center}.signature strong{display:block;border-top:1px solid #708086;padding-top:2mm}.signature span{display:block;margin-bottom:15mm;color:#475b61}@media screen{body{padding:10mm;background:#edf1f1}.quotation-document{background:#fff;min-height:273mm;padding:12mm;box-shadow:0 8px 30px rgba(22,45,49,.12)}}@media print{html,body{width:210mm;min-height:297mm;background:#fff}.quotation-document{width:210mm;max-width:none;min-height:297mm;margin:0;padding:12mm 12mm 14mm;box-shadow:none}.document-header{break-inside:avoid}.party-grid{break-inside:avoid}}
  </style></head><body><main class="quotation-document"><header class="document-header"><div class="brand">${logo ? `<img class="company-logo" src="${esc(logo)}" alt="${esc(companyName)} logo">` : ""}<div class="company-copy"><h1>${esc(companyName)}</h1>${companyAddress}${line(company.phone || company.mobile)}${line(company.email)}${line(company.website)}${line(registration)}</div></div><div class="document-title"><h2>QUOTATION</h2><div class="metadata">${detail("Quotation No.", quote.id)}${detail("Quotation Date", displayDate(quote.date))}${detail("Valid Until", displayDate(quote.validUntil))}${detail("Status", quote.status)}</div></div></header><section class="party-grid"><div class="party-card"><span class="section-label">QUOTE TO</span>${customerBlock(party)}</div><div class="reference-card"><span class="section-label">CONTACT</span><div class="reference-grid">${detail("Contact Person", quote.assignedSalesperson || party.assignedSalesperson)}${detail("Customer Reference", quote.quotationReference)}${!ae ? detail("Place of Supply", quote.placeOfSupply) : ""}</div></div></section><table class="items-table"><thead><tr><th>#</th><th>Description</th><th>${ae ? "Item / Service Code" : "HSN / SAC"}</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Discount</th><th>${ae ? "VAT %" : "GST %"}</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="summary-wrap"><section class="summary"><div><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div><span>Discount</span><strong>${money(discount)}</strong></div><div><span>Additional Charges</span><strong>${money(quote.additionalCharges)}</strong></div><div><span>Taxable Amount</span><strong>${money(quote.taxable)}</strong></div>${taxRows}<div><span>Round-off</span><strong>${money(quote.roundOff)}</strong></div><div class="grand-total"><span>GRAND TOTAL</span><strong>${money(quote.grandTotal)}</strong></div></section></div>${notes}${terms}<section class="signature"><div><span>For ${esc(companyName)}</span><strong>Authorized Signatory</strong></div></section>${renderInfoBridgeFooter({company,country:config.country,label:`Quotation ${quote.id || ""}`})}</main></body></html>`;
}
