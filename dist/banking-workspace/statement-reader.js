import { workbookDatasets as spreadsheetDatasets } from "./xlsx.js";
import { parsePdfStatement } from "./pdf-statement.js";

export async function workbookDatasets(file) {
  if (file.name.toLowerCase().endsWith(".pdf")) {
    const parsed = await parsePdfStatement(file);
    return [{ sheetName: "PDF Statement", ...parsed }];
  }
  return spreadsheetDatasets(file);
}
