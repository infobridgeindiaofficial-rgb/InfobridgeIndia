import{sourceKey,toMinor}from"./core.js";

const localStorage={getItem:(...args)=>(globalThis.InfoBridgeWorkspaceStorage||globalThis.localStorage).getItem(...args)};
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}};
const amount=record=>record.grandTotal??record.total??record.invoiceValue??record.amount??0;
const tax=record=>({cgst:toMinor(record.cgst||0),sgst:toMinor(record.sgst||0),igst:toMinor(record.igst||0),vat:toMinor(record.vat||0)});
const taxTotal=value=>value.cgst+value.sgst+value.igst+value.vat;
function proposal(base,issue,lines=[]){return{...base,key:sourceKey(base),issue,lines,status:issue?"Needs Mapping":"Ready"}}
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
    out.push(proposal(base,missing?`Missing Sales/control/${taxes.vat?"VAT":"GST"} account mapping`:"",[{accountId:accounts.ar,debitMinor:gross,creditMinor:0,subledgerType:"Customer",subledgerId:record.customerId,description:`Invoice ${base.documentNumber}`},{accountId:accounts.sales,debitMinor:0,creditMinor:taxable,description:"Sales revenue"},...taxLines(taxes,accounts,"output")]))
  }
  for(const record of sales?.payments||[]){
    if(record.companyId&&record.companyId!==companyId||record.status==="Reversed")continue;
    const base={companyId,branchId:record.branchId||branchId,module:"Sales",entityType:"Customer Receipt",entityId:record.id,eventVersion:record.version||1,documentNumber:record.id,date:record.date,amount:record.amount,party:customerName(record.customerId),sourceRoute:`/app/sales.html#${record.id}`,postingRuleId:"RULE-SALES-RECEIPT"};
    if(posted.has(sourceKey(base)))continue;
    const minor=toMinor(record.amount),bankLike=/cash/i.test(record.mode||"")?(accounts.cash||accounts.bank):(accounts.bank||accounts.cash),missing=!accounts.ar||!bankLike;
    out.push(proposal(base,missing?"Missing Accounts Receivable/Cash-Bank account mapping":"",[{accountId:bankLike,debitMinor:minor,creditMinor:0,description:`Receipt against ${record.invoiceId||"invoice"}`},{accountId:accounts.ar,debitMinor:0,creditMinor:minor,subledgerType:"Customer",subledgerId:record.customerId,description:`Receipt against ${record.invoiceId||"invoice"}`}]))
  }
  for(const record of sales?.returns||[]){
    if(record.companyId&&record.companyId!==companyId||record.status==="Cancelled")continue;
    const base={companyId,branchId:record.branchId||branchId,module:"Sales",entityType:"Credit Note",entityId:record.id,eventVersion:record.version||1,documentNumber:record.id,date:record.date,amount:amount(record),party:customerName(record.customerId),sourceRoute:`/app/sales.html#${record.id}`,postingRuleId:"RULE-SALES-CREDIT-NOTE"};
    if(posted.has(sourceKey(base)))continue;
    const taxes=tax(record),taxable=toMinor(record.taxable||0),appliedToBalance=toMinor(record.appliedToBalance||0),excessAmount=toMinor(record.excessAmount||0),refundAccount=accounts.customerRefund,needsRefundMapping=excessAmount>0&&!refundAccount,missing=!accounts.salesReturns||missingTaxMapping(taxes,accounts,"output")||(appliedToBalance>0&&!accounts.ar)||needsRefundMapping;
    const creditLines=[...(appliedToBalance?[{accountId:accounts.ar,debitMinor:0,creditMinor:appliedToBalance,subledgerType:"Customer",subledgerId:record.customerId,description:`Applied against ${record.invoiceId||"invoice"} balance`}]:[]),...(excessAmount?[{accountId:refundAccount,debitMinor:0,creditMinor:excessAmount,subledgerType:"Customer",subledgerId:record.customerId,description:record.settlementMethod==="Keep as Customer Credit"?"Customer credit balance":"Refund due to customer"}]:[])];
    out.push(proposal(base,missing?`Missing Sales Returns/${taxes.vat?"VAT":"GST"}/customer refund account mapping`:"",[{accountId:accounts.salesReturns,debitMinor:taxable,creditMinor:0,description:record.reasonType||record.reason||"Credit note"},...outputTaxReversalLines(taxes,accounts),...creditLines]))
  }
  for(const record of purchases?.bills||[]){
    if(record.companyId&&record.companyId!==companyId||/draft|cancel/i.test(record.status))continue;
    const base={companyId,branchId:record.branchId||branchId,module:"Purchases",entityType:"Bill",entityId:record.id,eventVersion:record.version||1,documentNumber:record.billNumber||record.supplierInvoiceNumber||record.id,date:record.billDate||record.date,amount:amount(record),party:supplierName(record.supplierId),sourceRoute:`/app/purchases.html#${record.id}`,postingRuleId:"RULE-PURCHASE-BILL"};
    if(posted.has(sourceKey(base)))continue;
    const gross=toMinor(amount(record)),taxes=tax(record),taxable=gross-taxTotal(taxes),missing=!accounts.ap||!accounts.purchase||missingTaxMapping(taxes,accounts,"input");
    out.push(proposal(base,missing?`Missing purchase/payable/${taxes.vat?"VAT":"GST"} account mapping`:"",[{accountId:accounts.purchase,debitMinor:taxable,creditMinor:0},...taxLines(taxes,accounts,"input"),{accountId:accounts.ap,debitMinor:0,creditMinor:gross,subledgerType:"Supplier",subledgerId:record.supplierId}]))
  }
  for(const record of banking?.transactions||[]){
    if(record.companyId&&record.companyId!==companyId||record.status==="Reversed"||record.transferId)continue;
    const type=record.category==="Customer Payment"?"Customer Receipt":record.category==="Supplier Payment"?"Supplier Payment":record.category==="Bank Charge"?"Bank Charge":record.category==="Interest Income"?"Interest Income":"Bank Transaction",base={companyId,branchId:record.branchId||branchId,module:"Banking",entityType:type,entityId:record.id,eventVersion:record.version||1,documentNumber:record.transactionNumber||record.reference||record.id,date:record.date,amount:record.amount,party:record.party||record.description||"",sourceRoute:`/app/banking.html#${record.id}`,postingRuleId:`RULE-${type.toUpperCase().replaceAll(" ","-")}`};
    if(posted.has(sourceKey(base)))continue;
    const bank=accounts.bank||accounts.cash,other=type==="Customer Receipt"?accounts.ar:type==="Supplier Payment"?accounts.ap:type==="Bank Charge"?state.accounts.find(x=>x.name==="Bank Charges")?.id:state.accounts.find(x=>x.name==="Interest Income")?.id;
    if(!bank||!other){out.push(proposal(base,"Missing bank or counter-account mapping"));continue}
    const minor=toMinor(record.amount),incoming=record.direction==="In";
    out.push(proposal(base,"",incoming?[{accountId:bank,debitMinor:minor,creditMinor:0},{accountId:other,debitMinor:0,creditMinor:minor}]:[{accountId:other,debitMinor:minor,creditMinor:0},{accountId:bank,debitMinor:0,creditMinor:minor}]))
  }
  return out.sort((a,b)=>String(b.date).localeCompare(String(a.date)))
}

export function proposalToDraft(proposal){const voucherType={Invoice:"Sales Voucher",Bill:"Purchase Voucher","Customer Receipt":"Receipt Voucher","Supplier Payment":"Payment Voucher","Credit Note":"Credit Note"}[proposal.entityType]||proposal.entityType;return{companyId:proposal.companyId,branchId:proposal.branchId,postingDate:proposal.date,voucherType,narration:`${proposal.module} · ${proposal.entityType} · ${proposal.documentNumber}${proposal.party?` · ${proposal.party}`:""}`,referenceNumber:proposal.documentNumber,lines:proposal.lines,source:{module:proposal.module,entityType:proposal.entityType,entityId:proposal.entityId,eventVersion:proposal.eventVersion,documentNumber:proposal.documentNumber,postingRuleId:proposal.postingRuleId,route:proposal.sourceRoute}}}
