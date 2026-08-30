import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/sales/app.js", import.meta.url), "utf8");

test("Payments & collections shows Outstanding invoices as a full-width section before Payment register", () => {
  const outstandingIndex = source.indexOf("Outstanding invoices");
  const registerIndex = source.indexOf("Payment register");
  assert.ok(outstandingIndex > -1 && registerIndex > -1);
  assert.ok(outstandingIndex < registerIndex, "Outstanding invoices must render first");
  assert.doesNotMatch(source.slice(source.indexOf("function payments()"), source.indexOf("function returns()")), /span8|span4/);
});

test("Outstanding invoices table exposes the required columns and a per-row Record Payment action", () => {
  assert.match(source, /"Invoice No\.","Customer","Invoice Date","Due Date","Total","Paid","Balance","Status","Action"/);
  assert.match(source, /data-record-payment="\$\{x\.id\}"/);
  assert.match(source, /outstanding=state\.invoices\.filter\(x=>num\(x\.balanceDue\)>0&&x\.status!=="Cancelled"\)/);
});

test("Payment register table exposes receipt, invoice, mode, reference, Finance Status and action columns", () => {
  assert.match(source, /"Receipt No\.","Payment Date","Invoice No\.","Customer","Payment Mode","Reference","Amount","Finance Status","Action"/);
  assert.match(source, /No collections recorded/);
  assert.match(source, /Record a payment against an invoice\./);
});

test("A payment shows the Finance review decision (Returned for Correction / Posted) written back by Finance, without Sales ever writing those fields itself", () => {
  assert.match(source, /function financeStatusCell\(x\)/);
  assert.match(source, /if\(!x\.financeStatus\)return"—"/);
  assert.match(source, /financeStatusCell\(x\)/);
});

test("Record Payment button opens the form with the clicked invoice preselected", () => {
  assert.match(source, /function paymentModal\(invoiceId\)/);
  assert.match(source, /selected=inv\.find\(x=>x\.id===invoiceId\)\|\|inv\[0\]/);
  assert.match(source, /data-record-payment.*\.forEach\(b=>b\.onclick=\(\)=>paymentModal\(b\.dataset\.recordPayment\)\)/);
});

test("Payment mode list is resolved from the company country instead of a fixed list", () => {
  assert.match(source, /paymentModes\(globalThis\.InfoBridgeCompany\)/);
  assert.doesNotMatch(source, /\["Cash","Bank Transfer","UPI","Card","Cheque"\]/);
});

test("Payment amount is capped at the selected invoice's outstanding balance and defaults to it", () => {
  assert.match(source, /max="\$\{selected\.balanceDue\}"/);
  assert.match(source, /field\("amount","Amount","number",selected\.balanceDue,true/);
  assert.match(source, /amountInput\.max=current\.balanceDue;amountInput\.value=current\.balanceDue/);
});

test("Bank / account field requires an eligible destination account for every payment mode", () => {
  assert.match(source, /name="bankAccountId" required/);
  assert.match(source, /cash\?\["Cash Account","Petty Cash"\]\.includes\(x\.type\):true/);
});
