import{sourceKey,toMinor}from"./core.js";

const localStorage={getItem:(...args)=>(globalThis.InfoBridgeWorkspaceStorage||globalThis.localStorage).getItem(...args),setItem:(...args)=>(globalThis.InfoBridgeWorkspaceStorage||globalThis.localStorage).setItem(...args)};
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}};
// Where a source module's own record for a given entityType lives, so Finance's review
// decision (Returned for Correction / Posted) can be written back onto the SAME record the
// review was about -- never a new/duplicate record, never deleting the original. Only modules
// with a simple, fixed-key persisted blob support this (Sales, Purchases); Payroll's only
// local mirror is a per-user offline-fallback cache and is not written back to.
const SOURCE_RECORD_LOOKUP={Sales:{storageKey:"infobridgeindia.sales.v1",arrays:{Invoice:"invoices","Customer Receipt":"payments","Credit Note":"returns"}},Purchases:{storageKey:"infobridgeindia.purchases.v1",arrays:{Bill:"bills","Supplier Payment":"payments","Debit Note":"debitNotes","Supplier Refund":"refunds"}}};
export function writeSourceReviewStatus({module,entityType,entityId},financeStatus,{reason="",reviewer=""}={}){
  const lookup=SOURCE_RECORD_LOOKUP[module],arrayName=lookup?.arrays?.[entityType];
  if(!lookup||!arrayName)return false;
  const data=read(lookup.storageKey);
  const record=data?.[arrayName]?.find(x=>x.id===entityId);
  if(!record)return false;
  record.financeStatus=financeStatus;
  record.financeReason=financeStatus==="Returned for Correction"?reason:"";
  record.financeReviewedBy=reviewer;
  record.financeReviewedAt=new Date().toISOString();
  localStorage.setItem(lookup.storageKey,JSON.stringify(data));
  return true;
}
const amount=record=>record.grandTotal??record.total??record.invoiceValue??record.amount??0;
const tax=record=>({cgst:toMinor(record.cgst||0),sgst:toMinor(record.sgst||0),igst:toMinor(record.igst||0),vat:toMinor(record.vat||0)});
const taxTotal=value=>value.cgst+value.sgst+value.igst+value.vat;
function proposal(base,issue,lines=[],cashLink){return{...base,key:sourceKey(base),issue,lines,cashLink:issue?undefined:cashLink,status:issue?"Needs Mapping":"Ready"}}
// The account a payment/receipt should land in by default, based on how it was recorded --
// Finance can still change this in the review modal before Confirm & Post (see app.js
// sourceReviewModal). Card/POS routes to POS Clearing, never straight to Bank, so the
// clearing-then-settlement flow (task section 12) has somewhere to start from.
function suggestedCashAccount(mode,accounts){
  const m=String(mode||"");
  if(/card|pos/i.test(m))return accounts.posClearing||accounts.bank||accounts.cash;
  if(/cash/i.test(m))return accounts.cash||accounts.bank;
  return accounts.bank||accounts.cash;
}
function taxLines(value,accounts,direction){
  const debit=direction==="input",line=(accountId,minor)=>debit?{accountId,debitMinor:minor,creditMinor:0}:{accountId,debitMinor:0,creditMinor:minor};
  return [
    ...(value.cgst?[line(debit?accounts.inputCgst:accounts.outputCgst,value.cgst)]:[]),
    ...(value.sgst?[line(debit?accounts.inputSgst:accounts.outputSgst,value.sgst)]:[]),
    ...(value.igst?[line(debit?accounts.inputIgst:accounts.outputIgst,value.igst)]:[]),
    ...(value.vat?[line(debit?(accounts.inputVat||accounts.inputIgst):(accounts.outputVat||accounts.outputIgst),value.vat)]:[]),
  ];
}
function outputTaxReversalLines(value,accounts){
  const line=(accountId,minor)=>({accountId,debitMinor:minor,creditMinor:0});
  return [
    ...(value.cgst?[line(accounts.outputCgst,value.cgst)]:[]),
    ...(value.sgst?[line(accounts.outputSgst,value.sgst)]:[]),
    ...(value.igst?[line(accounts.outputIgst,value.igst)]:[]),
    ...(value.vat?[line(accounts.outputVat||accounts.outputIgst,value.vat)]:[]),
  ];
}
function inputTaxReversalLines(value,accounts){
  const line=(accountId,minor)=>({accountId,debitMinor:0,creditMinor:minor});
  return [
    ...(value.cgst?[line(accounts.inputCgst,value.cgst)]:[]),
    ...(value.sgst?[line(accounts.inputSgst,value.sgst)]:[]),
    ...(value.igst?[line(accounts.inputIgst,value.igst)]:[]),
    ...(value.vat?[line(accounts.inputVat||accounts.inputIgst,value.vat)]:[]),
  ];
}
function missingTaxMapping(value,accounts,direction){
  const input=direction==="input";
  return value.cgst&&!accounts[input?"inputCgst":"outputCgst"]||value.sgst&&!accounts[input?"inputSgst":"outputSgst"]||value.igst&&!accounts[input?"inputIgst":"outputIgst"]||value.vat&&!(accounts[input?"inputVat":"outputVat"]||accounts[input?"inputIgst":"outputIgst"]);
}

export function discoverSources(state,companyId,branchId){
  const out=[],posted=new Set(state.sourceLinks.filter(x=>x.status==="Posted").map(x=>x.key)),sales=read("infobridgeindia.sales.v1"),purchases=read("infobridgeindia.purchases.v1"),banking=read("infobridgeindia.banking.v1"),accounts=state.settings.defaultAccounts;
  const customerName=id=>sales?.customers?.find(c=>c.id===id)?.name||"",supplierName=id=>purchases?.suppliers?.find(s=>s.id===id)?.name||"";
  for(const record of sales?.invoices||[]){
    if(record.companyId&&record.companyId!==companyId||/draft|cancel/i.test(record.status))continue;
    const base={companyId,branchId:record.branchId||branchId,module:"Sales",entityType:"Invoice",entityId:record.id,eventVersion:record.version||1,documentNumber:record.invoiceNumber||record.id,date:record.invoiceDate||record.date,amount:amount(record),party:record.partyName||customerName(record.customerId),sourceRoute:`/app/sales.html#${record.id}`,postingRuleId:"RULE-SALES-INVOICE"};
    if(posted.has(sourceKey(base)))continue;
    const gross=toMinor(amount(record)),taxes=tax(record),taxable=gross-taxTotal(taxes),missing=!accounts.ar||!accounts.sales||missingTaxMapping(taxes,accounts,"output");
    // Invoice posting is a document/accrual event only -- Dr AR / Cr Sales -- and must never
    // carry a cashLink. No cash has moved yet, so no Banking transaction is ever created here.
    out.push(proposal(base,missing?`Missing Sales/control/${taxes.vat?"VAT":"GST"} account mapping`:"",[{accountId:accounts.ar,debitMinor:gross,creditMinor:0,subledgerType:"Customer",subledgerId:record.customerId,description:`Invoice ${base.documentNumber}`},{accountId:accounts.sales,debitMinor:0,creditMinor:taxable,description:"Sales revenue"},...taxLines(taxes,accounts,"output")]))
  }
  for(const record of sales?.payments||[]){
    if(record.companyId&&record.companyId!==companyId||record.status==="Reversed")continue;
    const base={companyId,branchId:record.branchId||branchId,module:"Sales",entityType:"Customer Receipt",entityId:record.id,eventVersion:record.version||1,documentNumber:record.id,date:record.date,amount:record.amount,party:customerName(record.customerId),sourceRoute:`/app/sales.html#${record.id}`,postingRuleId:"RULE-SALES-RECEIPT"};
    if(posted.has(sourceKey(base)))continue;
    const minor=toMinor(record.amount),bankLike=suggestedCashAccount(record.mode,accounts),missing=!accounts.ar||!bankLike;
    // Real money in: this proposal carries a cashLink, so Confirm & Post (app.js) creates
    // exactly one linked Banking transaction alongside the journal -- this is the ONLY place
    // a customer payment reaches Banking now; Sales itself no longer calls Banking directly.
    out.push(proposal(base,missing?"Missing Accounts Receivable/Cash-Bank account mapping":"",[{accountId:bankLike,debitMinor:minor,creditMinor:0,description:`Receipt against ${record.invoiceId||"invoice"}`},{accountId:accounts.ar,debitMinor:0,creditMinor:minor,subledgerType:"Customer",subledgerId:record.customerId,description:`Receipt against ${record.invoiceId||"invoice"}`}],{accountId:record.bankAccountId||record.bankAccount||"",direction:"In",amount:record.amount,category:"Customer Payment",sourceModule:"Sales",sourceId:record.id,reference:record.reference||base.documentNumber,customerId:record.customerId,invoiceId:record.invoiceId}))
  }
  for(const record of sales?.returns||[]){
    if(record.companyId&&record.companyId!==companyId||record.status==="Cancelled")continue;
    const base={companyId,branchId:record.branchId||branchId,module:"Sales",entityType:"Credit Note",entityId:record.id,eventVersion:record.version||1,documentNumber:record.id,date:record.date,amount:amount(record),party:customerName(record.customerId),sourceRoute:`/app/sales.html#${record.id}`,postingRuleId:"RULE-SALES-CREDIT-NOTE"};
    if(posted.has(sourceKey(base)))continue;
    const taxes=tax(record),taxable=toMinor(record.taxable||0),appliedToBalance=toMinor(record.appliedToBalance||0),excessAmount=toMinor(record.excessAmount||0);
    const isCashRefund=record.settlementMethod==="Refund Customer"&&excessAmount>0,refundBankAccount=accounts.bank||accounts.cash,refundLiabilityAccount=accounts.customerRefund,refundCreditAccount=isCashRefund?refundBankAccount:refundLiabilityAccount,needsRefundMapping=excessAmount>0&&!refundCreditAccount,missing=!accounts.salesReturns||missingTaxMapping(taxes,accounts,"output")||(appliedToBalance>0&&!accounts.ar)||needsRefundMapping;
    const creditLines=[...(appliedToBalance?[{accountId:accounts.ar,debitMinor:0,creditMinor:appliedToBalance,subledgerType:"Customer",subledgerId:record.customerId,description:`Applied against ${record.invoiceId||"invoice"} balance`}]:[]),...(excessAmount?[{accountId:refundCreditAccount,debitMinor:0,creditMinor:excessAmount,subledgerType:"Customer",subledgerId:record.customerId,description:isCashRefund?"Refund paid to customer":record.settlementMethod==="Keep as Customer Credit"?"Customer credit balance":"Refund due to customer"}]:[])];
    // Only a genuine "Refund Customer" cash settlement gets a cashLink (Banking Money Out).
    // "Keep as Customer Credit" and the non-cash Sales-Returns/tax-reversal portion never touch Banking.
    out.push(proposal(base,missing?`Missing Sales Returns/${taxes.vat?"VAT":"GST"}/customer refund account mapping`:"",[{accountId:accounts.salesReturns,debitMinor:taxable,creditMinor:0,description:record.reasonType||record.reason||"Credit note"},...outputTaxReversalLines(taxes,accounts),...creditLines],isCashRefund?{accountId:refundBankAccount,direction:"Out",amount:record.excessAmount,category:"Customer Refund",sourceModule:"Sales",sourceId:record.id,reference:base.documentNumber,customerId:record.customerId}:undefined))
  }
  for(const record of purchases?.bills||[]){
    if(record.companyId&&record.companyId!==companyId||/draft|cancel/i.test(record.status))continue;
    const base={companyId,branchId:record.branchId||branchId,module:"Purchases",entityType:"Bill",entityId:record.id,eventVersion:record.version||1,documentNumber:record.billNumber||record.supplierInvoiceNumber||record.id,date:record.billDate||record.postingDate||record.invoiceDate||record.date,amount:amount(record),party:supplierName(record.supplierId),sourceRoute:`/app/purchases.html#${record.id}`,postingRuleId:"RULE-PURCHASE-BILL"};
    if(posted.has(sourceKey(base)))continue;
    const gross=toMinor(amount(record)),taxes=tax(record),taxable=gross-taxTotal(taxes),missing=!accounts.ap||!accounts.purchase||missingTaxMapping(taxes,accounts,"input");
    // Bill posting is a document/accrual event only -- Dr Purchase/Input GST / Cr AP -- and
    // must never carry a cashLink. No cash has moved yet.
    out.push(proposal(base,missing?`Missing purchase/payable/${taxes.vat?"VAT":"GST"} account mapping`:"",[{accountId:accounts.purchase,debitMinor:taxable,creditMinor:0},...taxLines(taxes,accounts,"input"),{accountId:accounts.ap,debitMinor:0,creditMinor:gross,subledgerType:"Supplier",subledgerId:record.supplierId}]))
  }
  for(const record of purchases?.payments||[]){
    if(record.companyId&&record.companyId!==companyId||record.status==="Reversed")continue;
    const base={companyId,branchId:record.branchId||branchId,module:"Purchases",entityType:"Supplier Payment",entityId:record.id,eventVersion:record.version||1,documentNumber:record.id,date:record.date,amount:record.amount,party:supplierName(record.supplierId),sourceRoute:`/app/purchases.html#${record.id}`,postingRuleId:"RULE-SUPPLIER-PAYMENT"};
    if(posted.has(sourceKey(base)))continue;
    const minor=toMinor(record.amount),bankLike=suggestedCashAccount(record.mode,accounts),missing=!accounts.ap||!bankLike;
    // This is the fix for the previously-incomplete Supplier Payment integration: it now
    // reaches Finance Pending Review (it never did before -- the old code only pushed into
    // Purchases' own dead financeEntries array, which nothing read), and carries a cashLink
    // so Confirm & Post creates exactly one linked Banking Money Out transaction.
    out.push(proposal(base,missing?"Missing Accounts Payable/Cash-Bank account mapping":"",[{accountId:accounts.ap,debitMinor:minor,creditMinor:0,subledgerType:"Supplier",subledgerId:record.supplierId,description:`Payment ${base.documentNumber}`},{accountId:bankLike,debitMinor:0,creditMinor:minor,description:`Payment ${base.documentNumber}`}],{accountId:record.bankAccount||record.bankAccountId||"",direction:"Out",amount:record.amount,category:"Supplier Payment",sourceModule:"Purchases",sourceId:record.id,reference:record.reference||base.documentNumber,supplierId:record.supplierId}))
  }
  for(const record of purchases?.debitNotes||[]){
    if(record.companyId&&record.companyId!==companyId||record.status==="Cancelled")continue;
    const base={companyId,branchId:record.branchId||branchId,module:"Purchases",entityType:"Debit Note",entityId:record.id,eventVersion:record.version||1,documentNumber:record.id,date:record.date,amount:record.total??amount(record),party:supplierName(record.supplierId),sourceRoute:`/app/purchases.html#${record.id}`,postingRuleId:"RULE-PURCHASE-DEBIT-NOTE"};
    if(posted.has(sourceKey(base)))continue;
    const taxes=tax(record),taxable=toMinor(record.taxable||0),missing=!accounts.ap||!accounts.purchase||missingTaxMapping(taxes,accounts,"input");
    // A debit note reduces what is owed to the supplier -- Dr AP / Cr Purchases (and reverses
    // the input-tax claim). This is an accounting adjustment only; no cashLink here. A real
    // supplier refund of cash is a separate, explicit event -- see the Supplier Refund loop
    // below (Purchases' own recordSupplierRefund action against this same debit note).
    out.push(proposal(base,missing?`Missing purchase/payable/${taxes.vat?"VAT":"GST"} account mapping`:"",[{accountId:accounts.ap,debitMinor:taxable+taxTotal(taxes),creditMinor:0,subledgerType:"Supplier",subledgerId:record.supplierId,description:record.reason||"Debit note"},{accountId:accounts.purchase,debitMinor:0,creditMinor:taxable,description:"Purchase return"},...inputTaxReversalLines(taxes,accounts)]))
  }
  for(const record of purchases?.refunds||[]){
    if(record.companyId&&record.companyId!==companyId||record.status==="Reversed")continue;
    const base={companyId,branchId:record.branchId||branchId,module:"Purchases",entityType:"Supplier Refund",entityId:record.id,eventVersion:record.version||1,documentNumber:record.id,date:record.date,amount:record.amount,party:supplierName(record.supplierId),sourceRoute:`/app/purchases.html#${record.id}`,postingRuleId:"RULE-SUPPLIER-REFUND"};
    if(posted.has(sourceKey(base)))continue;
    const minor=toMinor(record.amount),bankLike=suggestedCashAccount(record.mode,accounts),missing=!accounts.ap||!bankLike;
    // The supplier actually returning cash for a Debit Note is a real Money In event, kept
    // separate from the (non-cash) debit note adjustment above: Dr Bank/Cash, Cr Accounts
    // Payable -- reinstating the AP the debit note reduced, since it is now settled in cash
    // rather than offset against a future bill. Only this event carries a cashLink; a debit
    // note alone never assumes cash was received.
    out.push(proposal(base,missing?"Missing payable/bank or cash account mapping":"",[{accountId:bankLike,debitMinor:minor,creditMinor:0,description:"Supplier refund received"},{accountId:accounts.ap,debitMinor:0,creditMinor:minor,subledgerType:"Supplier",subledgerId:record.supplierId,description:"Supplier refund"}],{accountId:record.bankAccount||record.bankAccountId||"",direction:"In",amount:record.amount,category:"Supplier Refund",sourceModule:"Purchases",sourceId:record.id,reference:record.reference||base.documentNumber,supplierId:record.supplierId}))
  }
  for(const record of banking?.transactions||[]){
    // Finance-originated transactions (created by this module's own Confirm & Post, or by a
    // POS settlement) are never re-discovered here -- they already have a posted journal.
    // This is the fix for the double-counting risk: without it, a Sales/Supplier payment that
    // Finance already posted-and-synced to Banking would resurface here as a second, separate
    // proposal against the very Banking transaction Finance just created for it.
    if(record.sourceModule==="Finance")continue;
    if(record.companyId&&record.companyId!==companyId||record.status==="Reversed"||record.transferId)continue;
    const type=record.category==="Customer Payment"?"Customer Receipt":record.category==="Supplier Payment"?"Supplier Payment":record.category==="Bank Charge"?"Bank Charge":record.category==="Interest Income"?"Interest Income":"Bank Transaction",base={companyId,branchId:record.branchId||branchId,module:"Banking",entityType:type,entityId:record.id,eventVersion:record.version||1,documentNumber:record.transactionNumber||record.reference||record.id,date:record.date,amount:record.amount,party:record.party||record.description||"",sourceRoute:`/app/banking.html#${record.id}`,postingRuleId:type==="Bank Transaction"?"RULE-BANK-UNKNOWN":`RULE-${type.toUpperCase().replaceAll(" ","-")}`};
    if(posted.has(sourceKey(base)))continue;
    const bank=accounts.bank||accounts.cash,other=type==="Customer Receipt"?accounts.ar:type==="Supplier Payment"?accounts.ap:type==="Bank Charge"?state.accounts.find(x=>x.name==="Bank Charges")?.id:state.accounts.find(x=>x.name==="Interest Income")?.id;
    if(!bank||!other){out.push(proposal(base,"Missing bank or counter-account mapping"));continue}
    // This path only ever journals a Banking transaction that already exists (a manual entry
    // or a bank-statement import) -- it must never carry a cashLink, or Confirm & Post would
    // create a second, duplicate Banking transaction for money that already moved once.
    const minor=toMinor(record.amount),incoming=record.direction==="In";
    out.push(proposal(base,"",incoming?[{accountId:bank,debitMinor:minor,creditMinor:0},{accountId:other,debitMinor:0,creditMinor:minor}]:[{accountId:other,debitMinor:minor,creditMinor:0},{accountId:bank,debitMinor:0,creditMinor:minor}]))
  }
  return out.sort((a,b)=>String(b.date).localeCompare(String(a.date)))
}

export function proposalToDraft(proposal){const voucherType={Invoice:"Sales Voucher",Bill:"Purchase Voucher","Customer Receipt":"Receipt Voucher","Supplier Payment":"Payment Voucher","Credit Note":"Credit Note","Debit Note":"Debit Note","Supplier Refund":"Receipt Voucher"}[proposal.entityType]||proposal.entityType;return{companyId:proposal.companyId,branchId:proposal.branchId,postingDate:proposal.date,voucherType,narration:`${proposal.module} · ${proposal.entityType} · ${proposal.documentNumber}${proposal.party?` · ${proposal.party}`:""}`,referenceNumber:proposal.documentNumber,lines:proposal.lines,cashLink:proposal.cashLink,source:{module:proposal.module,entityType:proposal.entityType,entityId:proposal.entityId,eventVersion:proposal.eventVersion,documentNumber:proposal.documentNumber,postingRuleId:proposal.postingRuleId,route:proposal.sourceRoute}}}
