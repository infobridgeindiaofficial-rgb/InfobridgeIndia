import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialState as salesInitialState, saveLead, saveQuotation, convertQuotationToOrder, convertOrderToInvoice, recordPayment, reversePayment, createReturn } from "../src/sales/core.js";
import { initialState as financeInitialState, saveDraft, postJournal, ledger, trialBalance, dashboard, statements, fromMinor, ensureSalesReturnAccounts, rejectSource, restoreSource, uid } from "../src/finance/core.js";
import { createCountryDefaultChart } from "../src/finance/country-chart.js";
import { discoverSources, proposalToDraft } from "../src/finance/adapters.js";

const CO = "CO-TEST", BR = "BR-TEST";

function withCompany(country, fn) {
  const previous = globalThis.InfoBridgeCompany;
  globalThis.InfoBridgeCompany = { country, state: country === "AE" ? "Dubai" : "Tamil Nadu", companyId: CO };
  try { return fn(); } finally { globalThis.InfoBridgeCompany = previous; }
}

function withSalesState(salesState, fn) {
  const previous = globalThis.InfoBridgeWorkspaceStorage;
  globalThis.InfoBridgeWorkspaceStorage = { getItem: key => key === "infobridgeindia.sales.v1" ? JSON.stringify(salesState) : null, setItem: () => {} };
  try { return fn(); } finally { globalThis.InfoBridgeWorkspaceStorage = previous; }
}

function uaeInvoiceScenario() {
  let r = saveLead(salesInitialState(), { name: "Grand Horizon Hotel Dubai", mobile: "+971501234567", stage: "Qualified", interest: "Event Waiter Manpower Supply" });
  let state = r.state, lead = r.record;
  r = saveQuotation(state, { leadId: lead.id, date: "2026-08-25", status: "Sent", items: [{ description: "Event Waiter Manpower Supply", itemCode: "SERVICE", quantity: 25, unit: "Person", rate: 300, discount: 0, gstRate: 5 }] });
  state = r.state; const quote = r.record;
  r = convertQuotationToOrder(state, quote.id); state = r.state; const order = r.record;
  r = convertOrderToInvoice(state, order.id); state = r.state; const invoice = r.record;
  return { state, invoice };
}

function indiaInvoiceScenario() {
  let state = salesInitialState(); state.settings.sellerStateCode = "33";
  let r = saveLead(state, { name: "Acme Traders", mobile: "9876543210", stage: "Qualified", interest: "Consulting" });
  state = r.state; const lead = r.record;
  r = saveQuotation(state, { leadId: lead.id, date: "2026-08-19", placeOfSupply: "33", status: "Sent", items: [{ description: "Consulting", hsnSac: "9983", quantity: 1, unit: "Service", rate: 10000, discount: 0, gstRate: 18 }] });
  state = r.state; const quote = r.record;
  r = convertQuotationToOrder(state, quote.id); state = r.state; const order = r.record;
  r = convertOrderToInvoice(state, order.id); state = r.state; const invoice = r.record;
  return { state, invoice };
}

function financeChart(country) { return createCountryDefaultChart(financeInitialState(), CO, BR, { country }, uid); }
const balanced = p => { const d = (p.lines || []).reduce((a, l) => a + (l.debitMinor || 0), 0), c = (p.lines || []).reduce((a, l) => a + (l.creditMinor || 0), 0); return d === c && d > 0; };
const accountName = (finState, id) => finState.accounts.find(a => a.id === id)?.name;

test("Sales invoice is discovered as a proposed, balanced Finance entry (Dr AR, Cr Sales Revenue + Output tax)", () => withCompany("AE", () => {
  const { state: sales, invoice } = uaeInvoiceScenario();
  withSalesState(sales, () => {
    const fin = financeChart("AE");
    const proposals = discoverSources(fin, CO, BR);
    const p = proposals.find(x => x.entityType === "Invoice");
    assert.ok(p, "invoice proposal must be discovered");
    assert.equal(p.documentNumber, invoice.id);
    assert.equal(p.party, "Grand Horizon Hotel Dubai");
    assert.ok(balanced(p));
    assert.equal(p.lines.find(l => accountName(fin, l.accountId) === "Accounts Receivable").debitMinor, 787500);
    assert.equal(p.lines.find(l => accountName(fin, l.accountId) === "Sales Revenue").creditMinor, 750000);
    assert.equal(p.lines.find(l => accountName(fin, l.accountId) === "Output VAT").creditMinor, 37500);
  });
}));

test("UAE VAT invoice mapping never produces CGST/SGST/IGST lines", () => withCompany("AE", () => {
  const { state: sales } = uaeInvoiceScenario();
  withSalesState(sales, () => {
    const fin = financeChart("AE");
    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Invoice");
    const names = p.lines.map(l => accountName(fin, l.accountId));
    assert.ok(!names.some(n => /CGST|SGST|IGST/.test(n || "")));
    assert.ok(names.includes("Output VAT"));
  });
}));

test("India GST invoice mapping produces CGST/SGST for a same-state sale", () => withCompany("IN", () => {
  const { state: sales } = indiaInvoiceScenario();
  withSalesState(sales, () => {
    const fin = financeChart("IN");
    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Invoice");
    assert.ok(balanced(p));
    const names = p.lines.map(l => accountName(fin, l.accountId));
    assert.ok(names.includes("Output CGST") && names.includes("Output SGST"));
    assert.equal(p.lines.find(l => accountName(fin, l.accountId) === "Output CGST").creditMinor, 90000);
    assert.equal(p.lines.find(l => accountName(fin, l.accountId) === "Output SGST").creditMinor, 90000);
  });
}));

test("Customer receipt (Sales payment) is mapped as Dr Cash/Bank, Cr Accounts Receivable", () => withCompany("AE", () => {
  let { state: sales, invoice } = uaeInvoiceScenario();
  let r = recordPayment(sales, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-08-25", amount: invoice.grandTotal, mode: "Cash" });
  sales = r.state;
  withSalesState(sales, () => {
    const fin = financeChart("AE");
    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Customer Receipt");
    assert.ok(p, "receipt proposal must be discovered");
    assert.ok(balanced(p));
    assert.equal(p.lines.find(l => accountName(fin, l.accountId) === "Cash").debitMinor, 787500);
    assert.equal(p.lines.find(l => accountName(fin, l.accountId) === "Accounts Receivable").creditMinor, 787500);
  });
}));

test("Credit note against an unpaid invoice maps to Dr Sales Returns + Output tax reversal, Cr Accounts Receivable", () => withCompany("AE", () => {
  let { state: sales, invoice } = uaeInvoiceScenario();
  let r = createReturn(sales, { invoiceId: invoice.id, date: "2026-08-26", reasonType: "Service Cancellation", reason: "Reduced scope", items: [{ description: "Event Waiter Manpower Supply", quantity: 5 }] });
  sales = r.state;
  withSalesState(sales, () => {
    const fin = financeChart("AE");
    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Credit Note");
    assert.ok(p, "credit note proposal must be discovered");
    assert.ok(balanced(p));
    assert.equal(p.lines.find(l => accountName(fin, l.accountId) === "Sales Returns & Adjustments").debitMinor, 150000);
    assert.equal(p.lines.find(l => accountName(fin, l.accountId) === "Output VAT").debitMinor, 7500, "Output VAT must be DEBITED (reversed), not credited again");
    assert.equal(p.lines.find(l => accountName(fin, l.accountId) === "Accounts Receivable").creditMinor, 157500, "unpaid invoice: full credit reduces AR");
  });
}));

test("Credit note against a fully-paid invoice with Refund Customer settlement pays real cash from Bank, not a liability, and carries a cashLink for Confirm & Post", () => withCompany("AE", () => {
  let { state: sales, invoice } = uaeInvoiceScenario();
  let r = recordPayment(sales, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-08-25", amount: invoice.grandTotal, mode: "Cash" });
  sales = r.state;
  r = createReturn(sales, { invoiceId: invoice.id, date: "2026-08-26", reasonType: "Service Cancellation", reason: "Guest count reduced", settlementMethod: "Refund Customer", items: [{ description: "Event Waiter Manpower Supply", quantity: 5 }] });
  sales = r.state;
  withSalesState(sales, () => {
    const fin = financeChart("AE");
    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Credit Note");
    assert.ok(balanced(p));
    assert.equal(p.lines.some(l => accountName(fin, l.accountId) === "Accounts Receivable"), false, "must NOT create any AR line — invoice is fully settled");
    assert.equal(p.lines.some(l => accountName(fin, l.accountId) === "Customer Refunds Payable"), false, "a real cash refund is money actually leaving the company, not a liability");
    const bankLine = p.lines.find(l => accountName(fin, l.accountId) === "Bank");
    assert.ok(bankLine, "must credit Bank — this is Banking Money Out once Finance confirms");
    assert.equal(bankLine.creditMinor, 157500);
    assert.equal(p.cashLink?.direction, "Out");
    assert.equal(p.cashLink?.category, "Customer Refund");
    assert.equal(p.cashLink?.amount, 1575);
    assert.equal(p.cashLink?.sourceModule, "Sales");
  });
}));

test("Credit note with Keep as Customer Credit settlement also books the liability account, not a cash reduction", () => withCompany("AE", () => {
  let { state: sales, invoice } = uaeInvoiceScenario();
  let r = recordPayment(sales, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-08-25", amount: invoice.grandTotal, mode: "Cash" });
  sales = r.state;
  r = createReturn(sales, { invoiceId: invoice.id, date: "2026-08-26", reasonType: "Service Cancellation", reason: "Guest count reduced", settlementMethod: "Keep as Customer Credit", items: [{ description: "Event Waiter Manpower Supply", quantity: 5 }] });
  sales = r.state;
  withSalesState(sales, () => {
    const fin = financeChart("AE");
    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Credit Note");
    assert.ok(balanced(p));
    assert.ok(!p.lines.some(l => accountName(fin, l.accountId) === "Cash" || accountName(fin, l.accountId) === "Bank"), "must NOT assume cash has left the bank");
    assert.equal(p.lines.find(l => accountName(fin, l.accountId) === "Customer Refunds Payable").creditMinor, 157500);
  });
}));

test("Credit note against a partially paid invoice splits correctly between Accounts Receivable and a real cash refund", () => withCompany("AE", () => {
  let { state: sales, invoice } = uaeInvoiceScenario();
  let r = recordPayment(sales, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-08-25", amount: 7000, mode: "Cash" });
  sales = r.state;
  r = createReturn(sales, { invoiceId: invoice.id, date: "2026-08-26", reasonType: "Service Cancellation", reason: "Reduced scope", settlementMethod: "Refund Customer", items: [{ description: "Event Waiter Manpower Supply", quantity: 5 }] });
  sales = r.state;
  withSalesState(sales, () => {
    const fin = financeChart("AE");
    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Credit Note");
    assert.ok(balanced(p));
    assert.equal(p.lines.find(l => accountName(fin, l.accountId) === "Accounts Receivable").creditMinor, 87500, "applies only the remaining 875.00 outstanding");
    assert.equal(p.lines.find(l => accountName(fin, l.accountId) === "Bank").creditMinor, 70000, "excess 700.00 already paid by the customer is a real cash refund out of Bank, not AR or a liability");
    assert.equal(p.cashLink?.direction, "Out");
    assert.equal(p.cashLink?.amount, 700);
  });
}));

test("Reversed payments and cancelled invoices/credit notes are excluded from discovered source transactions", () => withCompany("AE", () => {
  let { state: sales, invoice } = uaeInvoiceScenario();
  let r = recordPayment(sales, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-08-25", amount: 2000, mode: "Cash" });
  sales = r.state; const receipt = sales.payments[0];
  sales = reversePayment(sales, receipt.id, "Chargeback");
  sales.invoices[0].status = "Cancelled";
  withSalesState(sales, () => {
    const fin = financeChart("AE");
    const proposals = discoverSources(fin, CO, BR);
    assert.equal(proposals.some(p => p.entityType === "Customer Receipt"), false);
    assert.equal(proposals.some(p => p.entityType === "Invoice"), false);
  });
}));

test("Full end-to-end posting: balanced entries, no negative AR, correct GL/Trial Balance/Dashboard, and duplicate posting is blocked", () => withCompany("AE", () => {
  let { state: sales, invoice } = uaeInvoiceScenario();
  let r = recordPayment(sales, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-08-25", amount: invoice.grandTotal, mode: "Cash" });
  sales = r.state;
  r = createReturn(sales, { invoiceId: invoice.id, date: "2026-08-26", reasonType: "Service Cancellation", reason: "Guest count reduced", settlementMethod: "Refund Customer", items: [{ description: "Event Waiter Manpower Supply", quantity: 5 }] });
  sales = r.state;
  withSalesState(sales, () => {
    let fin = financeChart("AE");
    const proposals = discoverSources(fin, CO, BR);
    assert.equal(proposals.length, 3);
    assert.ok(proposals.every(balanced), "every proposed voucher must be individually balanced");
    for (const p of proposals) {
      const draft = saveDraft(fin, proposalToDraft(p));
      assert.equal(draft.record.source.module, "Sales");
      assert.equal(draft.record.source.documentNumber, p.documentNumber);
      const posted = postJournal(draft.state, draft.record.id);
      assert.equal(posted.record.status, "Posted");
      fin = posted.state;
    }
    assert.equal(discoverSources(fin, CO, BR).length, 0, "posted sources must disappear from the review list");
    const ar = fin.accounts.find(a => a.name === "Accounts Receivable");
    const arBalance = ledger(fin, { companyId: CO, accountId: ar.id }).at(-1)?.balanceMinor || 0;
    assert.equal(arBalance, 0);
    assert.ok(arBalance >= 0, "Accounts Receivable must never go negative");
    const bank = fin.accounts.find(a => a.name === "Bank");
    assert.equal(fromMinor(ledger(fin, { companyId: CO, accountId: bank.id }).at(-1)?.balanceMinor || 0), -1575, "the cash refund paid out of Bank reduces its balance — this is Banking Money Out once Finance confirms");
    const tb = trialBalance(fin, { companyId: CO });
    assert.equal(tb.balanced, true);
    const dash = dashboard(fin, CO);
    assert.equal(fromMinor(dash.ar), 0);
    assert.equal(fromMinor(dash.cash), 6300, "Cash receipt of 7875 net of the 1575 cash refund paid out of Bank");
    assert.equal(fromMinor(dash.income), 6000, "Finance income correctly nets Sales Returns against Sales Revenue, excluding VAT");
    assert.equal(dash.journals, 3);
    const st = statements(fin, { companyId: CO });
    assert.equal(fromMinor(st.profitLoss.income), 6000);
    assert.equal(st.balanceSheet.balanced, true);
    const invoiceProposalKey = discoverSources({ ...fin, sourceLinks: [] }, CO, BR).find(p => p.entityType === "Invoice").key;
    assert.throws(() => {
      const dup = saveDraft(fin, proposalToDraft({ ...proposals.find(p => p.entityType === "Invoice"), key: invoiceProposalKey }));
      postJournal(dup.state, dup.record.id);
    }, /already posted/);
  });
}));

test("Posted journal preserves source module, type, ID and document number for traceability", () => withCompany("AE", () => {
  let { state: sales, invoice } = uaeInvoiceScenario();
  withSalesState(sales, () => {
    let fin = financeChart("AE");
    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Invoice");
    const draft = saveDraft(fin, proposalToDraft(p));
    const posted = postJournal(draft.state, draft.record.id);
    const journal = posted.state.journals.find(j => j.id === draft.record.id);
    assert.equal(journal.source.module, "Sales");
    assert.equal(journal.source.entityType, "Invoice");
    assert.equal(journal.source.entityId, invoice.id);
    assert.equal(journal.source.documentNumber, invoice.id);
    assert.ok(posted.state.sourceLinks.some(l => l.journalId === journal.id && l.status === "Posted"));
  });
}));

test("ensureSalesReturnAccounts adds the two new accounts to an existing legacy chart without touching other accounts or posted journals", () => {
  let fin = financeChart("AE");
  const beforeCount = fin.accounts.length;
  fin = { ...fin, accounts: fin.accounts.filter(a => !["Sales Returns & Adjustments", "Customer Refunds Payable"].includes(a.name)) };
  const arId = fin.accounts.find(a => a.name === "Accounts Receivable").id;
  let r = saveDraft(fin, { companyId: CO, branchId: BR, postingDate: "2026-08-01", voucherType: "Opening Balance Voucher", narration: "Opening", authorisedControlAdjustment: true, lines: [{ accountId: arId, debit: 100 }, { accountId: fin.accounts.find(a => a.name === "Owner Capital").id, credit: 100 }] });
  fin = postJournal(r.state, r.record.id).state;
  const { state: fixed, changed } = ensureSalesReturnAccounts(fin, CO);
  assert.equal(changed, true);
  assert.ok(fixed.accounts.some(a => a.name === "Sales Returns & Adjustments"));
  assert.ok(fixed.accounts.some(a => a.name === "Customer Refunds Payable"));
  assert.equal(fixed.accounts.length, beforeCount - 2 + 2);
  assert.equal(fixed.journals.length, 1);
  assert.equal(ledger(fixed, { companyId: CO, accountId: arId }).at(-1).balanceMinor, 10000);
  const second = ensureSalesReturnAccounts(fixed, CO);
  assert.equal(second.changed, false, "must be idempotent once accounts already exist");
});

test("ensureSalesReturnAccounts does nothing when no Chart of Accounts has been confirmed yet", () => {
  const { state, changed } = ensureSalesReturnAccounts(financeInitialState(), CO);
  assert.equal(changed, false);
  assert.equal(state.accounts.length, 0);
});

test("A manual Journal Voucher (no source) still saves and posts normally alongside pending source transactions", () => withCompany("AE", () => {
  const { state: sales } = uaeInvoiceScenario();
  withSalesState(sales, () => {
    const fin = financeChart("AE");
    assert.ok(discoverSources(fin, CO, BR).length > 0, "a pending source transaction exists");
    const cash = fin.accounts.find(a => a.name === "Cash").id, capital = fin.accounts.find(a => a.name === "Owner Capital").id;
    const draft = saveDraft(fin, { companyId: CO, branchId: BR, postingDate: "2026-08-01", voucherType: "Journal Voucher", narration: "Manual adjustment", authorisedControlAdjustment: true, lines: [{ accountId: cash, debit: 50 }, { accountId: capital, credit: 50 }] });
    const posted = postJournal(draft.state, draft.record.id);
    assert.equal(posted.record.status, "Posted");
    assert.equal(posted.record.source, undefined);
  });
}));

const app = readFileSync(new URL("../src/finance/app.js", import.meta.url), "utf8");

test("Vouchers page renders a Source Transactions to Review section using the same discoverSources call as the Dashboard, filterable by module and excluding items returned for correction", () => {
  assert.match(app, /Source Transactions to Review/);
  assert.match(app, /discovered=vouchers\?discoverSources\(state,companyId\(\),branchId\(\)\):\[\]/);
  assert.match(app, /unposted=discoverSources\(state,companyId\(\),branchId\(\)\)/);
  assert.match(app, /data-review-source="\$\{esc\(x\.key\)\}"/);
  assert.match(app, /rejected=state\.rejectedSources\|\|\[\]/);
  assert.match(app, /id="review-module-filter"/);
  assert.match(app, /data-restore-source="\$\{esc\(x\.key\)\}"/);
});

test("Review opens a proposed voucher with source details and posts via the existing saveDraft + postJournal pipeline, syncing a linked Banking transaction when real money moved", () => {
  assert.match(app, /function sourceReviewModal\(key\)/);
  assert.match(app, /const draft=saveDraft\(state,proposalToDraft\(p\)\),posted=postJournalAndSync\(draft\.state,draft\.record\.id,\{accountId:v\.bankAccountId\}\);persist\(posted\.state\)/);
  assert.match(app, /data-action="journal">New voucher/);
});

test("Review modal offers Reject / Return for correction, which records a reason without posting anything", () => {
  assert.match(app, /data-reject-review>Reject \/ Return for correction/);
  assert.match(app, /const next=rejectSource\(state,key,reason\)/);
});

test("rejectSource hides a source from review without posting it, and restoreSource brings it back", () => withCompany("AE", () => {
  const { state: sales, invoice } = uaeInvoiceScenario();
  withSalesState(sales, () => {
    const fin = financeChart("AE");
    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Invoice");
    let r = rejectSource(fin, p.key, "Amount does not match the signed quotation");
    assert.equal(discoverSources(r.state, CO, BR).some(x => x.key === p.key), true, "rejectSource only records a reason -- discoverSources itself stays a pure, unfiltered read");
    assert.equal(r.state.rejectedSources.length, 1);
    assert.equal(r.state.rejectedSources[0].reason, "Amount does not match the signed quotation");
    assert.throws(() => rejectSource(fin, p.key, ""), /reason is required/);
    r = restoreSource(r.state, p.key);
    assert.equal(r.state.rejectedSources.length, 0);
  });
}));

test("Finance render() self-heals missing Sales Returns / Customer Refund accounts on legacy charts", () => {
  assert.match(app, /ensureSalesReturnAccounts\(state,companyId\(\)\)/);
});
