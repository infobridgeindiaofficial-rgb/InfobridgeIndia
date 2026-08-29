import { resolveCountryConfig } from "../country/registry.js";
import { INFOBRIDGE_FOOTER, companyExportBranding } from "./workbook.js";

export const INFOBRIDGE_EXPORT_COLORS = Object.freeze({
  ink: "#17252b",
  heading: "#12352d",
  brand: "#0d6658",
  brandStrong: "#0d7c68",
  muted: "#6b7c81",
  border: "#d9e1e2",
  surface: "#edf1f1",
});

export const escapeExportHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

export function documentCompanyBranding(company = {}, country) {
  const base = companyExportBranding(company), config = resolveCountryConfig(country || company);
  const addressValues = [company.address || company.businessAddress || company.registeredAddress, company.addressLine2, company.city, company.emirate || company.state, company.postalCode, config.countryName];
  const addressLines = [];
  for (const value of addressValues) {
    const text = String(value || "").trim();
    if (!text || addressLines.some(existing => existing.toLowerCase() === text.toLowerCase() || existing.toLowerCase().includes(text.toLowerCase()))) continue;
    addressLines.push(text);
  }
  const registration = config.country === "AE"
    ? (company.vatRegistered !== false && (company.trn || company.taxNumber) ? `TRN: ${company.trn || company.taxNumber}` : "")
    : (company.gstRegistered !== false && (company.gstin || company.taxNumber) ? `GSTIN: ${company.gstin || company.taxNumber}` : "");
  return Object.freeze({
    ...base,
    country: config.country,
    countryName: config.countryName,
    addressLines,
    phone: company.phone || company.mobile || "",
    email: company.email || "",
    website: company.website || "",
    registration,
  });
}

export function renderCompanyIdentity(company = {}, country, { className = "brand" } = {}) {
  const brand = documentCompanyBranding(company, country), esc = escapeExportHtml;
  const details = [...brand.addressLines, brand.phone, brand.email, brand.website, brand.registration].filter(Boolean).map(value => `<div>${esc(value)}</div>`).join("");
  return `<div class="${esc(className)}">${brand.logo ? `<img class="company-logo" src="${esc(brand.logo)}" alt="${esc(brand.companyName)} logo">` : ""}<div class="company-copy"><h1>${esc(brand.companyName)}</h1>${details}</div></div>`;
}

export function renderInfoBridgeFooter({ company = {}, country, label = "", generatedAt = new Date() } = {}) {
  const brand = documentCompanyBranding(company, country), esc = escapeExportHtml;
  const timestamp = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  const generated = Number.isNaN(timestamp.getTime()) ? "" : timestamp.toLocaleString("en-GB");
  return `<footer class="report-footer"><span>${esc(brand.companyName)}${label ? ` · ${esc(label)}` : ""}</span><span>${generated ? `Generated ${esc(generated)} · ` : ""}${esc(INFOBRIDGE_FOOTER)}</span></footer>`;
}

export const BRANDED_DOCUMENT_BASE_CSS = `
@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:${INFOBRIDGE_EXPORT_COLORS.ink};font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.brand{display:flex;gap:5mm;align-items:flex-start}.company-logo{display:block;width:auto;height:auto;max-width:38mm;max-height:18mm;object-fit:contain;object-position:left top}.company-copy{display:grid;gap:1mm;color:#475b61}.company-copy h1{font-size:17px;line-height:1.15;margin:0 0 1mm;color:${INFOBRIDGE_EXPORT_COLORS.heading}}
.report-footer{display:flex;justify-content:space-between;gap:8mm;margin-top:10mm;padding-top:4mm;border-top:1px solid ${INFOBRIDGE_EXPORT_COLORS.border};color:${INFOBRIDGE_EXPORT_COLORS.muted};font-size:8px}.report-footer span:last-child{text-align:right}
thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}@media print{.report-footer{break-inside:avoid}}
`;
