import { resolveCountryConfig } from "../country/registry.js";

export const INFOBRIDGE_FOOTER = "Generated with InfoBridgeIndia";
export function companyExportBranding(company = {}) {
  return Object.freeze({
    companyId: company.companyId || company.id || "",
    companyName: company.legalName || company.name || company.tradeName || "Company",
    logo: /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(company.logo || "") ? company.logo : "",
    address: company.address || company.businessAddress || company.registeredAddress || "",
    phone: company.phone || company.mobile || "",
    email: company.email || "",
    website: company.website || "",
  });
}
export function countryCurrencyFormat(country) {
  return resolveCountryConfig(country).country === "AE" ? '[$AED] #,##0.00;[Red]-[$AED] #,##0.00' : '[$₹-en-IN]#,##0.00;[Red]-[$₹-en-IN]#,##0.00';
}
export function brandedTemplateSheet(XLSX, { company, country, title, headers, rows = [], instructions = "Complete one employee per row. Required fields must not be blank.", currencyColumns = [] }) {
  const brand = companyExportBranding(company), contact = [brand.address, brand.phone, brand.email, brand.website].filter(Boolean).join(" · "), matrix = [[brand.companyName], [title], [[contact, instructions].filter(Boolean).join(" — ")], [], headers, ...rows], sheet = XLSX.utils.aoa_to_sheet(matrix);
  sheet["!cols"] = headers.map((header) => ({ wch: Math.min(34, Math.max(14, header.length + 3)) }));
  sheet["!freeze"] = { ySplit: 5 };
  sheet["!autofilter"] = { ref: `A5:${columnName(headers.length - 1)}5` };
  sheet["!headerRow"] = 5;
  sheet["!footer"] = INFOBRIDGE_FOOTER;
  sheet["!print"] = { orientation: "landscape", fitToWidth: 1, repeatRows: "5:5" };
  sheet["!branding"] = { ...brand, title, country: resolveCountryConfig(country).country };
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, headers.length - 1) } }, { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(0, headers.length - 1) } }, { s: { r: 2, c: 0 }, e: { r: 2, c: Math.max(0, headers.length - 1) } }];
  sheet["!rows"] = [{ hpt: 24 }, { hpt: 21 }, { hpt: 32 }, { hpt: 8 }, { hpt: 23 }];
  const titleCell = sheet.A1, subtitleCell = sheet.A2, detailCell = sheet.A3;
  if (titleCell) titleCell.s = { font: { bold: true, sz: 16, color: { rgb: "12352D" } }, alignment: { vertical: "center" } };
  if (subtitleCell) subtitleCell.s = { font: { bold: true, sz: 13, color: { rgb: "0D6658" } }, alignment: { vertical: "center" } };
  if (detailCell) detailCell.s = { font: { sz: 9, color: { rgb: "6B7C81" } }, alignment: { wrapText: true, vertical: "top" } };
  headers.forEach((_, index) => { const cell = sheet[XLSX.utils.encode_cell({ r: 4, c: index })]; if (cell) cell.s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "12352D" } }, alignment: { vertical: "center", wrapText: true }, border: { bottom: { style: "thin", color: { rgb: "0D6658" } } } }; });
  sheet["!currencyColumns"] = currencyColumns.map((header) => ({ index: headers.indexOf(header), format: countryCurrencyFormat(country) })).filter((item) => item.index >= 0);
  for (const { index, format } of sheet["!currencyColumns"]) {
    for (let row = 5; row < matrix.length; row += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: index })];
      if (cell && typeof cell.v === "number") cell.z = format;
    }
  }
  return sheet;
}
export function brandedWorkbook(XLSX, options) {
  const book = XLSX.utils.book_new(), sheet = brandedTemplateSheet(XLSX, options);
  book.Props = { Title: options.title, Company: companyExportBranding(options.company).companyName, Comments: INFOBRIDGE_FOOTER };
  XLSX.utils.book_append_sheet(book, sheet, options.sheetName || "Data");
  return { book, sheet, branding: sheet["!branding"] };
}
const columnName = (index) => { let name = "", value = index + 1; while (value) { name = String.fromCharCode(65 + (value - 1) % 26) + name; value = Math.floor((value - 1) / 26); } return name; };
