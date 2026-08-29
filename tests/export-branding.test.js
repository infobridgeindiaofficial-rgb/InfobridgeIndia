import test from "node:test";
import assert from "node:assert/strict";
import { BRANDED_DOCUMENT_BASE_CSS, documentCompanyBranding, renderCompanyIdentity, renderInfoBridgeFooter } from "../src/export/document.js";
import { INFOBRIDGE_FOOTER, brandedWorkbook } from "../src/export/workbook.js";
import { XLSX } from "../gst-workspace/xlsx-shim.js";
import { renderQuotationDocument } from "../src/sales/quotation-document.js";
import { renderInvoiceDocument } from "../src/sales/invoice-document.js";
import { renderSalesOrderDocument } from "../src/sales/sales-order-document.js";
import { renderCreditNoteDocument } from "../src/sales/credit-note-document.js";
import { renderSalesReportDocument } from "../src/sales/sales-report-document.js";
import { renderPayslipDocument } from "../src/hr-payroll/payslip.js";

const company={companyId:"CO-1",name:"Example Trading LLC",address:"Business Bay",city:"Dubai",country:"AE",phone:"+971 50 000 0000",email:"hello@example.test",website:"example.test",trn:"100000000000001",logo:"data:image/png;base64,AAAA"};
const storedZipEntries=(bytes)=>{const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder(),entries=new Map;let offset=0;while(offset+30<=bytes.length&&view.getUint32(offset,true)===0x04034b50){const size=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true),extraLength=view.getUint16(offset+28,true),name=decoder.decode(bytes.subarray(offset+30,offset+30+nameLength)),start=offset+30+nameLength+extraLength;entries.set(name,decoder.decode(bytes.subarray(start,start+size)));offset=start+size}return entries};

test("shared document branding resolves company-specific identity and graceful fallback",()=>{
  const brand=documentCompanyBranding(company,"AE");
  assert.equal(brand.companyName,company.name);
  assert.equal(brand.logo,company.logo);
  assert.match(brand.addressLines.join(" "),/Business Bay.*Dubai.*United Arab Emirates|Business Bay.*Dubai.*UAE/i);
  assert.match(renderCompanyIdentity(company,"AE"),/Example Trading LLC.*Business Bay.*hello@example\.test.*example\.test/s);
  assert.match(renderCompanyIdentity({name:"No Logo Company"},"IN"),/No Logo Company/);
  assert.doesNotMatch(renderCompanyIdentity({name:"No Logo Company"},"IN"),/<img/);
});

test("shared print foundation is A4-safe and provides subtle generated branding",()=>{
  assert.match(BRANDED_DOCUMENT_BASE_CSS,/@page\{size:A4/);
  assert.match(BRANDED_DOCUMENT_BASE_CSS,/display:table-header-group/);
  assert.match(BRANDED_DOCUMENT_BASE_CSS,/break-inside:avoid/);
  const footer=renderInfoBridgeFooter({company,country:"AE",label:"Sample Report",generatedAt:new Date("2026-08-29T08:30:00Z")});
  assert.match(footer,/Example Trading LLC/);
  assert.match(footer,/Sample Report/);
  assert.match(footer,/Generated with InfoBridgeIndia/);
});

test("quotation-family documents and sales reports use the common branded footer",()=>{
  const item={description:"Service",quantity:1,rate:100,taxRate:5,taxable:100},base={id:"DOC-1",date:"2026-08-29",items:[item],taxable:100,vat:5,grandTotal:105,status:"Draft",country:"AE"};
  const documents=[
    renderQuotationDocument({quote:{...base,validUntil:"2026-09-29"},company,party:{name:"Customer"}}),
    renderInvoiceDocument({invoice:base,company,customer:{name:"Customer"}}),
    renderSalesOrderDocument({order:base,company,customer:{name:"Customer"}}),
    renderCreditNoteDocument({creditNote:{...base,invoiceId:"INV-1"},invoice:{id:"INV-1",date:"2026-08-20"},company,customer:{name:"Customer"}}),
    renderSalesReportDocument({report:{type:"Sales Summary",country:"AE",currency:"AED",columns:["Name"],rows:[{Name:"Customer"}],summary:[]},company,generatedAt:new Date("2026-08-29T08:30:00Z")}),
  ];
  for(const html of documents){assert.match(html,/Example Trading LLC/);assert.match(html,/Generated with InfoBridgeIndia/);assert.match(html,/@page\{size:A4/);assert.match(html,/example\.test/)}
});

test("payslip retains company branding and the common InfoBridgeIndia footer",()=>{
  const html=renderPayslipDocument({payslip:{period:"2026-08",name:"Employee",employeeCode:"EMP-1",net:1000,companyProfileSnapshot:company},employee:{},company,generatedAt:"2026-08-29T08:30:00Z"});
  assert.match(html,/Example Trading LLC/);
  assert.match(html,/Generated with InfoBridgeIndia/);
});

test("shared workbook format includes company identity, styled headers, freezing, widths, print settings and currency formats",()=>{
  const {book,sheet}=brandedWorkbook(XLSX,{company,country:"AE",title:"Finance Ledger",headers:["Date","Description","Amount"],rows:[["2026-08-29","Sale",1250]],currencyColumns:["Amount"],sheetName:"Ledger"});
  assert.equal(sheet.A1.v,company.name);
  assert.match(sheet.A3.v,/Business Bay.*hello@example\.test.*example\.test/);
  assert.equal(sheet.A5.s.fill.fgColor.rgb,"12352D");
  assert.equal(sheet["!freeze"].ySplit,5);
  assert.equal(sheet["!autofilter"].ref,"A5:C5");
  assert.equal(sheet["!print"].fitToWidth,1);
  assert.equal(sheet.C6.z.includes("AED"),true);
  assert.equal(sheet["!footer"],INFOBRIDGE_FOOTER);
  assert.equal(book.Props.Company,company.name);
  const serialized=new TextDecoder().decode(XLSX.writeBytes(book));
  assert.match(serialized,/FF12352D/);
  assert.match(serialized,/s="7"/);
  assert.match(serialized,/state="frozen"/);
  assert.match(serialized,/mergeCell ref="A1:C1"/);
  assert.match(serialized,/\[\$AED\]/);
  assert.match(serialized,/Generated with InfoBridgeIndia/);
});

test("serialized workbook follows Excel worksheet ordering and valid package references",async()=>{
  const {book}=brandedWorkbook(XLSX,{company,country:"AE",title:"UAE Employee Import Template",headers:["Employee ID","Basic Salary AED"],rows:[],currencyColumns:["Basic Salary AED"],sheetName:"Employees"});
  const bytes=XLSX.writeBytes(book),entries=storedZipEntries(bytes),sheet=entries.get("xl/worksheets/sheet1.xml"),styles=entries.get("xl/styles.xml"),rels=entries.get("xl/_rels/workbook.xml.rels"),types=entries.get("[Content_Types].xml");
  for(const required of ["[Content_Types].xml","_rels/.rels","xl/workbook.xml","xl/_rels/workbook.xml.rels","xl/styles.xml","xl/worksheets/sheet1.xml","docProps/core.xml","docProps/app.xml"])assert.ok(entries.has(required),`missing ${required}`);
  assert.ok(sheet.indexOf("<autoFilter")<sheet.indexOf("<mergeCells"),"autoFilter must precede mergeCells in SpreadsheetML order");
  const styleCount=Number(styles.match(/<cellXfs count="(\d+)"/)?.[1]);
  for(const match of sheet.matchAll(/<c[^>]* s="(\d+)"/g))assert.ok(Number(match[1])<styleCount,`invalid style reference ${match[1]}`);
  assert.match(rels,/relationships\/styles" Target="styles\.xml"/);
  assert.match(types,/worksheets\/sheet1\.xml/);
  const parsed=await XLSX.readAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  assert.deepEqual(parsed.SheetNames,["Employees"]);
  assert.equal(parsed.Sheets.Employees.A5.v,"Employee ID");
});
