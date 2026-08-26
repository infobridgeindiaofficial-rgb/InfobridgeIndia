import { resolveCountryConfig } from "../country/registry.js";

export const INFOBRIDGE_FOOTER = "Generated with InfoBridgeIndia";
export function companyExportBranding(company = {}) {
  return Object.freeze({
    companyId: company.companyId || company.id || "",
    companyName: company.legalName || company.name || company.tradeName || "Company",
    logo: /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(company.logo || "") ? company.logo : "",
  });
}
export function countryCurrencyFormat(country) {
  return resolveCountryConfig(country).country === "AE" ? '[$AED] #,##0.00;[Red]-[$AED] #,##0.00' : '[$₹-en-IN]#,##0.00;[Red]-[$₹-en-IN]#,##0.00';
}
export function brandedTemplateSheet(XLSX, { company, country, title, headers, rows = [], instructions = "Complete one employee per row. Required fields must not be blank.", currencyColumns = [] }) {
  const brand = companyExportBranding(company), matrix = [[brand.companyName], [title], [instructions], [], headers, ...rows], sheet = XLSX.utils.aoa_to_sheet(matrix);
  sheet["!cols"] = headers.map((header) => ({ wch: Math.min(34, Math.max(14, header.length + 3)) }));
  sheet["!freeze"] = { ySplit: 5 };
  sheet["!autofilter"] = { ref: `A5:${columnName(headers.length - 1)}5` };
  sheet["!headerRow"] = 5;
  sheet["!footer"] = INFOBRIDGE_FOOTER;
  sheet["!print"] = { orientation: "landscape", fitToWidth: 1, repeatRows: "5:5" };
  sheet["!branding"] = { ...brand, title, country: resolveCountryConfig(country).country };
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
