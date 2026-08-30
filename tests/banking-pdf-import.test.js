import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseStatementLines } from "../src/banking/pdf-statement.js";
import { confirmImport, initialState, previewImport, saveAccount } from "../src/banking/core.js";

const item = (x, y, str) => ({ x, y, text: str });
const page = (rows) => rows.map(([y, ...values]) => ({ y, items: values.map(([x, text]) => item(x, y, text)) }));
const header = [700, [20, "Date"], [90, "Description"], [300, "Chq/Ref. No."], [400, "Withdrawal (Dr.)"], [490, "Deposit (Cr.)"], [570, "Balance"]];

test("Kotak-style multi-page PDF tables preserve narration and classify debit/credit columns", () => {
  const rows = parseStatementLines([
    page([header,[680,[20,"01/08/2026"],[90,"UPI PAYMENT"],[300,"UPI123"],[400,"250.00"],[570,"9,750.00"]],[665,[90,"MERCHANT STORE"]],[640,[20,"02/08/2026"],[90,"IMPS CREDIT"],[300,"IMPS456"],[490,"1,500.00"],[570,"11,250.00"]]]),
    page([header,[680,[20,"03/08/2026"],[90,"BANK CHARGES"],[300,"CHG789"],[400,"25.00"],[570,"11,225.00"]],[640,[20,"04/08/2026"],[90,"INTEREST CREDIT"],[300,"INT001"],[490,"10.00"],[570,"11,235.00"]]])
  ]);
  assert.equal(rows.length,4);
  assert.equal(rows[0].Description,"UPI PAYMENT MERCHANT STORE");
  assert.equal(rows[0]["Withdrawal (Dr.)"],"250.00");
  assert.equal(rows[1]["Deposit (Cr.)"],"1,500.00");
  assert.equal(rows[3]["Chq/Ref. No."],"INT001");
});

test("Kotak textual dates, split headers, continuation references and Indian amounts are parsed",()=>{const splitHeader=[[700,[20,"Date"],[90,"Description"],[300,"Chq/Ref. No."],[400,"Withdrawal"],[490,"Deposit"],[570,"Balance"]],[690,[400,"(Dr.)"],[490,"(Cr.)"]]],rows=parseStatementLines([page([splitHeader[0],splitHeader[1],[665,[20,"10 May 2025"],[90,"UPI/Amazon India"]],[654,[90,"Order payment"],[300,"UPI123"],[400,"299.00"],[570,"4,00,000.00"]],[630,[20,"24 May 2025"],[90,"IMPS receipt"],[490,"9,292.18"],[570,"4,09,292.18"]],[610,[20,"25 May 2025"],[90,"Opening Balance"],[570,"4,09,292.18"]]])]);assert.equal(rows.length,2);assert.equal(rows[0].Description,"UPI/Amazon India Order payment");assert.equal(rows[0]["Chq/Ref. No."],"UPI123");assert.equal(rows[0]["Withdrawal (Dr.)"],"299.00");assert.equal(rows[1]["Deposit (Cr.)"],"9,292.18");let state=initialState();const account=saveAccount(state,{name:"Kotak INR",type:"Current Bank Account",currency:"INR",openingBalance:0,openingBalanceDate:"2025-05-01"});state=account.state;const preview=previewImport(state,{accountId:account.record.id,rows,mapping:{date:"Date",description:"Description",reference:"Chq/Ref. No.",debit:"Withdrawal (Dr.)",credit:"Deposit (Cr.)",balance:"Balance"},fileName:"kotak.pdf"});assert.equal(preview[0].data.date,"2025-05-10");assert.equal(preview[0].data.direction,"Out");assert.equal(preview[1].data.direction,"In")});

test("PDF-derived rows preview, import once, and are duplicates on repeat",()=>{let state=initialState();const account=saveAccount(state,{name:"Kotak INR",type:"Current Bank Account",currency:"INR",openingBalance:0,openingBalanceDate:"2026-08-01"});state=account.state;const args={accountId:account.record.id,rows:[{Date:"01/08/2026",Description:"UPI PAYMENT", "Chq/Ref. No.":"UPI123","Withdrawal (Dr.)":"250.00","Deposit (Cr.)":"",Balance:"9750.00"}],mapping:{date:"Date",description:"Description",reference:"Chq/Ref. No.",debit:"Withdrawal (Dr.)",credit:"Deposit (Cr.)",balance:"Balance"},dateFormat:"DD/MM/YYYY",fileName:"kotak.pdf",fileFingerprint:"sha256-test"};let preview=previewImport(state,args);assert.equal(preview[0].data.direction,"Out");state=confirmImport(state,preview,args).state;preview=previewImport(state,args);assert.equal(preview[0].status,"Duplicate");assert.equal(state.importBatches[0].fileFingerprint,"sha256-test")});

test("Statement Import advertises PDF and blocks currency mismatches in its in-app preview",()=>{const source=readFileSync(new URL("../src/banking/app.js",import.meta.url),"utf8");assert.match(source,/PDF, CSV and XLSX are supported\./);assert.match(source,/accept="\.pdf,\.csv,\.xlsx"/);assert.match(source,/Statement Import Preview/);assert.match(source,/does not match/);assert.match(source,/No currency conversion will be performed/);const importFlow=source.slice(source.indexOf("function importPreviewModal"),source.indexOf("function wire"));assert.doesNotMatch(importFlow,/alert\(|prompt\(|confirm\(/)});

test("PDF.js module and worker use build-relative JavaScript URLs instead of hardcoded root paths",()=>{const source=readFileSync(new URL("../src/banking/pdf-statement.js",import.meta.url),"utf8");assert.match(source,/new URL\("\.\.\/vendor\/pdf\.js", import\.meta\.url\)/);assert.match(source,/new URL\("\.\.\/vendor\/pdf\.worker\.min\.js", import\.meta\.url\)/);assert.doesNotMatch(source,/\/vendor\/pdf\.mjs/)});

test("the local preview server serves ES modules with a JavaScript MIME type",()=>{const source=readFileSync(new URL("../serve.js",import.meta.url),"utf8");assert.match(source,/"\.mjs": "text\/javascript; charset=utf-8"/)});

test("the production build copies offline PDF.js assets to JavaScript paths",()=>{const source=readFileSync(new URL("../build.js",import.meta.url),"utf8");assert.match(source,/pdf\.min\.mjs"\), join\(DIST, "vendor\/pdf\.js"\)/);assert.match(source,/pdf\.worker\.min\.mjs"\), join\(DIST, "vendor\/pdf\.worker\.min\.js"\)/)});
