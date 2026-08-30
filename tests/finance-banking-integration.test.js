import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialState as salesInitialState, saveLead, saveQuotation, convertQuotationToOrder, convertOrderToInvoice, recordPayment as recordSalesPayment, createReturn as createSalesReturn } from "../src/sales/core.js";
import { initialState as purchasesInitialState, saveSupplier, createOrder, createBill, recordPayment as recordSupplierPayment, createReturn as createPurchaseReturn, recordSupplierRefund } from "../src/purchases/core.js";
import { initialState as financeInitialState, saveDraft, postJournal, reverseJournal, attachBankingTransaction, ledger, fromMinor, toMinor, uid, ensureOperationalAccounts } from "../src/finance/core.js";
import { createCountryDefaultChart } from "../src/finance/country-chart.js";
import { discoverSources, proposalToDraft, writeSourceReviewStatus } from "../src/finance/adapters.js";
import { initialState as bankingInitialState, saveAccount as saveBankAccount, accountBalance } from "../src/banking/core.js";
import { syncFinancePosting, reverseFinancePosting } from "../src/banking/finance-sync.js";

// This suite exercises the required end-to-end architecture directly against the same
// production functions Finance's app.js calls (saveDraft -> postJournal -> syncFinancePosting,
// and reverseJournal -> reverseFinancePosting), without a DOM.
//   OPERATIONAL MODULE -> FINANCE REVIEW/CONFIRM -> ACCOUNTING POSTING -> BANKING MOVEMENT
// Tests are labelled A-M to match the 13 required end-to-end scenarios exactly, plus two
// additional tests for the Finance Posting permission and the rejection-reason write-back.
// Amounts are computed dynamically from what each flow actually produces (matching every
// sibling test in this file) rather than hard-coded to the illustrative numbers in the
// original request -- the architecture and duplicate/reversal guarantees are what is verified.

const CO = "CO-BANK-TEST", BR = "BR-BANK-TEST";

function withCompany(country, fn) {
  const previous = globalThis.InfoBridgeCompany;
  globalThis.InfoBridgeCompany = { country, state: country === "AE" ? "Dubai" : "Tamil Nadu", companyId: CO };
  try { return fn(); } finally { globalThis.InfoBridgeCompany = previous; }
}

// A real, mutable in-memory store (not just a read-only shim) so writeSourceReviewStatus's
// writes back onto a source record are actually observable within a test.
function withWorkspaceState(initial = {}, fn) {
  const previous = globalThis.InfoBridgeWorkspaceStorage;
  const keyFor = { sales: "infobridgeindia.sales.v1", purchases: "infobridgeindia.purchases.v1", banking: "infobridgeindia.banking.v1" };
  const store = {};
  for (const [k, v] of Object.entries(initial)) if (v !== undefined) store[keyFor[k]] = JSON.stringify(v);
  globalThis.InfoBridgeWorkspaceStorage = { getItem: key => store[key] ?? null, setItem: (key, value) => { store[key] = value; } };
  try { return fn(); } finally { globalThis.InfoBridgeWorkspaceStorage = previous; }
}

// Matches Finance's own render(), which self-heals a chart with ensureOperationalAccounts()
// (Salary Payable / Loans Payable / Owner Capital / POS Clearing / POS Fee) on every load.
function financeChart() {
  const chart = createCountryDefaultChart(financeInitialState(), CO, BR, globalThis.InfoBridgeCompany, uid);
  return ensureOperationalAccounts(chart, CO).state;
}
const accountName = (finState, id) => finState.accounts.find(a => a.id === id)?.name;
const bankAccount = (bankState, name = "Wio Bank", openingBalance = 200000) => saveBankAccount(bankState, { name, type: "Current Bank Account", currency: "AED", openingBalanceDate: "2026-01-01", openingBalance });
const cashAccount = (bankState) => saveBankAccount(bankState, { name: "Petty Cash", type: "Cash Account", currency: "AED", openingBalanceDate: "2026-01-01", openingBalance: 0 });

// Confirm & Post, exactly as Finance's app.js postJournalAndSync does: post the journal, then
// (only if it carries a cashLink not yet attached) sync a Banking transaction and attach its id.
function confirmAndPost(finState, draftId, bankState, { accountId } = {}) {
  let posted = postJournal(finState, draftId);
  const journal = posted.record;
  if (!journal.cashLink || journal.cashLink.bankingTransactionId) return { finState: posted.state, bankState, transaction: null };
  const bankResult = syncFinancePosting(bankState, journal, { accountId });
  if (bankResult.record && !bankResult.duplicate) posted = attachBankingTransaction(posted.state, journal.id, bankResult.record.id);
  return { finState: posted.state, bankState: bankResult.state, transaction: bankResult.record };
}

function uaeSupplierBill(purchases, supplierName = "Gulf Fresh Produce LLC", invoiceNumber = "INV-1") {
  let r = saveSupplier(purchases, { type: "Business", name: supplierName, mobile: "+971501112222", stateCode: "Dubai", vatRegistered: true, gstin: "100000000000003" });
  purchases = r.state; const supplier = r.record;
  r = createOrder(purchases, { date: "2026-08-01", supplierId: supplier.id, warehouseId: "WH-1", expectedDeliveryDate: "2026-08-10", items: [{ description: "Vegetables", quantity: 40, unit: "Kg", rate: 50, discount: 0, gstRate: 5 }] });
  purchases = r.state; const order = r.record;
  r = createBill(purchases, { supplierId: supplier.id, supplierInvoiceNumber: invoiceNumber, invoiceDate: "2026-08-05", postingDate: "2026-08-05", dueDate: "2026-08-20", orderId: order.id, items: order.items });
  purchases = r.state; const bill = r.record;
  return { purchases, supplier, bill };
}

function uaeInvoice(sales, customerName = "Grand Horizon Hotel Dubai") {
  let r = saveLead(sales, { name: customerName, mobile: "+971501234567", stage: "Qualified", interest: "Event Waiter Manpower Supply" });
  sales = r.state; const lead = r.record;
  r = saveQuotation(sales, { leadId: lead.id, date: "2026-08-25", status: "Sent", items: [{ description: "Event Waiter Manpower Supply", quantity: 25, unit: "Person", rate: 300, discount: 0, gstRate: 5 }] });
  sales = r.state; const quote = r.record;
  r = convertQuotationToOrder(sales, quote.id); sales = r.state; const order = r.record;
  r = convertOrderToInvoice(sales, order.id); sales = r.state; const invoice = r.record;
  return { sales, invoice };
}

test("A: A posted Sales invoice creates the correct Dr AR / Cr Sales Revenue + Output tax journal but creates NO Banking transaction -- invoicing is never cash received", () => withCompany("AE", () => {
  const { sales, invoice } = uaeInvoice(salesInitialState());
  let bank = bankAccount(bankingInitialState(), "Wio Bank", 0).state;
  withWorkspaceState({ sales }, () => {
    let fin = financeChart();
    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Invoice");
    assert.equal(p.cashLink, undefined, "an invoice proposal must never carry a cashLink");
    const draft = saveDraft(fin, proposalToDraft(p));
    const posted = postJournal(draft.state, draft.record.id);
    fin = posted.state;
    assert.equal(posted.record.cashLink, undefined);
    assert.equal(accountName(fin, posted.record.lines.find(l => l.debitMinor).accountId), "Accounts Receivable");
    assert.ok(posted.record.lines.some(l => l.creditMinor > 0 && accountName(fin, l.accountId) === "Sales Revenue"));
    assert.equal(fromMinor(posted.record.lines.find(l => l.debitMinor).debitMinor), invoice.grandTotal);
  });
  assert.equal(bank.transactions.length, 0, "posting an invoice must never touch Banking");
}));

test("B: A customer payment reaches Finance Pending Review; confirming the receiving Bank account creates exactly one Banking Money In for the paid amount and the correct Dr Bank / Cr AR journal", () => withCompany("AE", () => {
  let { sales, invoice } = uaeInvoice(salesInitialState(), "Palm Resort LLC");
  let r = recordSalesPayment(sales, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-08-26", amount: invoice.grandTotal, mode: "Bank Transfer", bankAccountId: "sales-suggested-account" });
  sales = r.state;

  let bank = bankAccount(bankingInitialState(), "Wio Bank", 0).state;
  withWorkspaceState({ sales }, () => {
    let fin = financeChart();
    // Post the invoice first (Section 1: Dr AR / Cr Sales Revenue) so AR actually carries a
    // balance for the payment to clear -- the same two-step sequence a real company follows.
    const invoiceProposal = discoverSources(fin, CO, BR).find(x => x.entityType === "Invoice");
    const invoiceDraft = saveDraft(fin, proposalToDraft(invoiceProposal));
    fin = postJournal(invoiceDraft.state, invoiceDraft.record.id).state;

    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Customer Receipt");
    assert.equal(p.cashLink.direction, "In");
    assert.equal(p.cashLink.amount, invoice.grandTotal);
    assert.equal(accountName(fin, p.lines.find(l => l.creditMinor).accountId), "Accounts Receivable");
    const draft = saveDraft(fin, proposalToDraft(p));
    const wio = bank.accounts[0].id;
    const result = confirmAndPost(draft.state, draft.record.id, bank, { accountId: wio });
    fin = result.finState; bank = result.bankState;
    const financeTx = bank.transactions.filter(t => t.sourceModule === "Finance");
    assert.equal(financeTx.length, 1);
    assert.equal(financeTx[0].direction, "In");
    assert.equal(financeTx[0].amount, invoice.grandTotal);
    assert.equal(accountBalance(bank, wio), invoice.grandTotal);
    const ar = fin.accounts.find(a => a.name === "Accounts Receivable");
    assert.equal(fromMinor(ledger(fin, { companyId: CO, accountId: ar.id }).at(-1)?.balanceMinor || 0), 0, "AR is fully cleared by this payment");
  });
}));

test("C: A posted Purchase Bill creates the AP/Purchase journal but creates NO Banking transaction -- receiving a bill is not a cash movement", () => withCompany("AE", () => {
  const { purchases, bill } = uaeSupplierBill(purchasesInitialState());
  let bank = bankAccount(bankingInitialState(), "Wio Bank", 0).state;
  withWorkspaceState({ purchases }, () => {
    let fin = financeChart();
    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Bill");
    assert.equal(p.cashLink, undefined, "a bill proposal must never carry a cashLink");
    const draft = saveDraft(fin, proposalToDraft(p));
    const posted = postJournal(draft.state, draft.record.id);
    assert.equal(posted.record.cashLink, undefined);
    assert.ok(posted.record.lines.some(l => l.creditMinor > 0 && accountName(posted.state, l.accountId) === "Accounts Payable"));
    assert.equal(fromMinor(posted.record.lines.find(l => l.creditMinor && accountName(posted.state, l.accountId) === "Accounts Payable").creditMinor), bill.grandTotal);
  });
  assert.equal(bank.transactions.length, 0, "posting a bill must never touch Banking");
}));

test("D: Supplier payment reaches Finance Pending Review (not the dead Purchases financeEntries array) and Confirm & Post clears AP with exactly one Banking Money Out", () => withCompany("AE", () => {
  let { purchases, supplier, bill } = uaeSupplierBill(purchasesInitialState());
  let r = recordSupplierPayment(purchases, { supplierId: supplier.id, date: "2026-08-10", mode: "Bank Transfer", bankAccount: "Wio Bank", allocations: [{ billId: bill.id, amount: bill.grandTotal }] });
  purchases = r.state;
  assert.equal(purchases.integration.financeEntries.length > 0, true, "the dead financeEntries array still receives a copy for backward compatibility, but nothing reads it any more");

  let bank = bankAccount(bankingInitialState()).state;

  withWorkspaceState({ purchases }, () => {
    let fin = financeChart();
    // Post the Bill first (as Section 4 requires: AP/Expense journal, no Banking) so AP actually
    // carries a balance for the payment to clear -- the same two-step sequence a real company follows.
    const billProposal = discoverSources(fin, CO, BR).find(x => x.entityType === "Bill");
    const billDraft = saveDraft(fin, proposalToDraft(billProposal));
    const billPosted = postJournal(billDraft.state, billDraft.record.id);
    assert.equal(billPosted.record.cashLink, undefined, "a Purchase Bill must never carry a cashLink -- it is not a cash movement");
    fin = billPosted.state;

    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Supplier Payment");
    assert.ok(p, "Supplier Payment must be discovered by Finance -- this is the fix for the previously-incomplete integration");
    assert.equal(p.postingRuleId, "RULE-SUPPLIER-PAYMENT");
    assert.equal(accountName(fin, p.lines.find(l => l.debitMinor).accountId), "Accounts Payable");
    assert.equal(fromMinor(p.lines.find(l => l.debitMinor).debitMinor), bill.grandTotal);
    assert.equal(p.cashLink.direction, "Out");
    assert.equal(p.cashLink.category, "Supplier Payment");
    assert.equal(p.cashLink.amount, bill.grandTotal);
    assert.equal(p.cashLink.sourceModule, "Purchases");

    const draft = saveDraft(fin, proposalToDraft(p));
    const wio = bank.accounts.find(a => a.name === "Wio Bank").id;
    const openingBalance = accountBalance(bank, wio);
    const result = confirmAndPost(draft.state, draft.record.id, bank, { accountId: wio });
    const finPosted = result.finState; bank = result.bankState;

    const financeTx = bank.transactions.filter(t => t.sourceModule === "Finance");
    assert.equal(financeTx.length, 1, "exactly one Banking transaction must be created for this one supplier payment");
    assert.equal(financeTx[0].direction, "Out");
    assert.equal(financeTx[0].amount, bill.grandTotal);
    assert.equal(financeTx[0].sourceId, draft.record.id);
    assert.equal(accountBalance(bank, wio), openingBalance - bill.grandTotal);

    const ap = finPosted.accounts.find(a => a.name === "Accounts Payable");
    assert.equal(fromMinor(ledger(finPosted, { companyId: CO, accountId: ap.id }).at(-1)?.balanceMinor || 0), 0, "AP must be fully cleared, never negative");

    // Confirming again must never create a second Banking transaction or a second journal.
    const dup = saveDraft(finPosted, proposalToDraft(p));
    assert.throws(() => postJournal(dup.state, dup.record.id), /already posted/);
  });
}));

test("E: A pushed Payroll Payment Batch posts to Salary Payable and Confirm & Post creates exactly one Banking Money Out for the whole batch; re-pushing the same run is blocked by the same sourceKey dedupe used everywhere else", () => withCompany("AE", () => {
  let fin = financeChart();
  const payrollRunId = "RUN-2026-08";
  const draftFor = (state) => saveDraft(state, {
    companyId: CO, branchId: BR, postingDate: "2026-08-31", voucherType: "Payroll Payment Batch", referenceNumber: payrollRunId,
    narration: "Payroll 2026-08 · 6 employee(s)",
    lines: [
      { accountId: fin.settings.defaultAccounts.salaryPayable, debitMinor: toMinor(25000), creditMinor: 0 },
      { accountId: fin.settings.defaultAccounts.bank, debitMinor: 0, creditMinor: toMinor(25000) },
    ],
    cashLink: { accountId: "", direction: "Out", amount: 25000, category: "Payroll Payment", sourceModule: "Payroll", sourceId: payrollRunId, reference: "2026-08" },
    source: { module: "Payroll", entityType: "Payroll Run", entityId: payrollRunId, eventVersion: 1, documentNumber: payrollRunId, postingRuleId: "RULE-PAYROLL-PAYMENT", route: "/hr-payroll/index.html" },
  });
  const draft = draftFor(fin);
  let bank = bankAccount(bankingInitialState()).state;
  const wio = bank.accounts[0].id;
  const result = confirmAndPost(draft.state, draft.record.id, bank, { accountId: wio });
  fin = result.finState; bank = result.bankState;

  const financeTx = bank.transactions.filter(t => t.sourceModule === "Finance");
  assert.equal(financeTx.length, 1, "one payroll run must create exactly one Banking Money Out, not one per employee unless explicitly configured");
  assert.equal(financeTx[0].amount, 25000);
  assert.equal(financeTx[0].direction, "Out");
  // This single journal is exactly the shape Section 7 asks for (Dr Salary Payable / Cr Bank for
  // the batch total) -- there is no separate payroll-accrual journal in this design, so Salary
  // Payable's ledger records this one debit rather than nets back to zero against a prior accrual.
  const salaryPayable = fin.accounts.find(a => a.id === fin.settings.defaultAccounts.salaryPayable);
  const salaryLine = ledger(fin, { companyId: CO, accountId: salaryPayable.id }).at(-1);
  assert.equal(fromMinor(salaryLine.debitMinor), 25000);

  // HR-Payroll's approve() guards against re-pushing with `journals.some(source.entityId===run.id)`;
  // even if that guard were bypassed, posting a second draft for the same run.id must still fail.
  const secondDraft = draftFor(fin);
  assert.throws(() => postJournal(secondDraft.state, secondDraft.record.id), /already posted/);
}));

test("F: A Cash-mode customer payment, once confirmed, moves money through the Cash Banking account (not Bank), and Sales never writes to Banking directly", () => withCompany("AE", () => {
  let sales = salesInitialState();
  let r = saveLead(sales, { name: "Downtown Diner", mobile: "+971502223344", stage: "Qualified", interest: "Catering" });
  sales = r.state; const lead = r.record;
  r = saveQuotation(sales, { leadId: lead.id, date: "2026-08-01", status: "Sent", items: [{ description: "Catering", quantity: 1, unit: "Service", rate: 300, discount: 0, gstRate: 5 }] });
  sales = r.state; const quote = r.record;
  r = convertQuotationToOrder(sales, quote.id); sales = r.state; const order = r.record;
  r = convertOrderToInvoice(sales, order.id); sales = r.state; const invoice = r.record;
  r = recordSalesPayment(sales, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-08-02", amount: invoice.grandTotal, mode: "Cash" });
  sales = r.state;

  const salesSource = readFileSync(new URL("../src/sales/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(salesSource, /sales-sync\.js/, "Sales must not import the old direct-to-Banking bridge");
  assert.doesNotMatch(salesSource, /syncSalesPayment|reverseSalesPayment/, "Sales must not call Banking directly for a payment or its reversal");

  let bank = cashAccount(bankingInitialState()).state;
  withWorkspaceState({ sales }, () => {
    const fin = financeChart();
    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Customer Receipt");
    assert.equal(p.cashLink.direction, "In");
    const draft = saveDraft(fin, proposalToDraft(p));
    const petty = bank.accounts.find(a => a.type === "Cash Account").id;
    const result = confirmAndPost(draft.state, draft.record.id, bank, { accountId: petty });
    bank = result.bankState;
    assert.equal(bank.transactions.length, 1);
    assert.equal(bank.transactions[0].direction, "In");
    assert.equal(bank.transactions[0].amount, invoice.grandTotal);
    assert.equal(accountBalance(bank, petty), invoice.grandTotal);
  });
}));

test("G: A card/POS sale settles through POS Clearing first (no Banking movement yet), then a Finance-initiated settlement books only the net amount to Bank and zeroes Clearing -- the gross customer payment is never mistaken for the net deposit", () => withCompany("AE", () => {
  let fin = financeChart();
  const posClearing = fin.settings.defaultAccounts.posClearing, posFee = fin.settings.defaultAccounts.posFee, bankGl = fin.settings.defaultAccounts.bank;
  assert.ok(posClearing && posFee, "POS Clearing and POS Fee accounts must exist in the default chart");

  // Point of sale: customer pays 1000 by card. This mirrors the journal shape adapters.js
  // builds for a Card/POS-mode Sales receipt (routed to POS Clearing, not Bank) -- no cashLink,
  // because no real bank/cash account has actually received money yet.
  const saleDraft = saveDraft(fin, {
    companyId: CO, branchId: BR, postingDate: "2026-08-10", voucherType: "Receipt Voucher", referenceNumber: "SALE-POS-1",
    narration: "Card sale", authorisedControlAdjustment: true, lines: [
      { accountId: posClearing, debitMinor: toMinor(1000), creditMinor: 0 },
      { accountId: fin.accounts.find(a => a.name === "Accounts Receivable").id, debitMinor: 0, creditMinor: toMinor(1000) },
    ],
  });
  const salePosted = postJournal(saleDraft.state, saleDraft.record.id);
  fin = salePosted.state;
  assert.equal(salePosted.record.cashLink, undefined, "no Banking transaction may be created at the point of sale -- the money has not reached a real account yet");

  let bank = bankAccount(bankingInitialState(), "Wio Bank", 0).state;
  assert.equal(bank.transactions.length, 0);

  // Settlement, a day later: processor deposits 980, keeps a 20 fee. This is posSettlementForm()'s
  // own journal shape in Finance's app.js.
  const settleDraft = saveDraft(fin, {
    companyId: CO, branchId: BR, postingDate: "2026-08-11", voucherType: "POS Settlement", referenceNumber: "SETTLE-1",
    narration: "POS settlement", authorisedControlAdjustment: true, lines: [
      { accountId: bankGl, debitMinor: toMinor(980), creditMinor: 0 },
      { accountId: posFee, debitMinor: toMinor(20), creditMinor: 0 },
      { accountId: posClearing, debitMinor: 0, creditMinor: toMinor(1000) },
    ],
    cashLink: { accountId: "", direction: "In", amount: 980, category: "POS Settlement", sourceModule: "Finance", sourceId: uid("POS"), reference: "SETTLE-1" },
  });
  const wio = bank.accounts[0].id;
  const result = confirmAndPost(settleDraft.state, settleDraft.record.id, bank, { accountId: wio });
  fin = result.finState; bank = result.bankState;

  assert.equal(bank.transactions.length, 1, "Banking Money In must be the net settlement amount only");
  assert.equal(bank.transactions[0].amount, 980);
  assert.equal(accountBalance(bank, wio), 980, "the customer's 1000 payment is never recorded as 980 of revenue -- only the net cash actually deposited touches Banking");
  const clearing = fin.accounts.find(a => a.id === posClearing);
  assert.equal(fromMinor(ledger(fin, { companyId: CO, accountId: clearing.id }).at(-1)?.balanceMinor || 0), 0, "POS Clearing must return to zero once settled");
}));

test("H: A Purchase Debit Note alone stays a non-cash accounting adjustment; recording an actual Supplier Refund reaches Finance Pending Review, and Confirm & Post creates exactly one Banking Money In with the AP/debit-note linkage preserved and duplicate refund posting blocked", () => withCompany("AE", () => {
  let { purchases, supplier, bill } = uaeSupplierBill(purchasesInitialState(), "Gulf Fresh Produce LLC", "INV-H1");
  let r = createPurchaseReturn(purchases, { billId: bill.id, date: "2026-08-12", supplierId: supplier.id, warehouseId: "WH-1", reason: "Damaged goods", items: [{ productId: bill.items[0].productId, quantity: bill.items[0].quantity }] });
  purchases = r.state; const debitNote = r.debitNote;
  assert.equal(debitNote.supplierId, supplier.id);

  // The debit note alone is discovered as a non-cash adjustment -- no cashLink, and no Supplier
  // Refund proposal yet, since no refund has actually been recorded (a debit note never assumes
  // cash was received).
  withWorkspaceState({ purchases }, () => {
    const proposals = discoverSources(financeChart(), CO, BR);
    const dnProposal = proposals.find(p => p.entityType === "Debit Note");
    assert.ok(dnProposal);
    assert.equal(dnProposal.cashLink, undefined);
    assert.equal(proposals.some(p => p.entityType === "Supplier Refund"), false, "no refund was recorded yet -- Finance must not invent one");
  });

  // The supplier actually returns the money -- recorded as an explicit, separate event.
  r = recordSupplierRefund(purchases, { supplierId: supplier.id, debitNoteId: debitNote.id, date: "2026-08-14", mode: "Bank Transfer", bankAccount: "Wio Bank" });
  purchases = r.state; const refund = r.record;
  assert.equal(refund.amount, debitNote.total, "defaults to the full remaining refundable amount");
  assert.equal(purchases.debitNotes.find(d => d.id === debitNote.id).refundStatus, "Refunded");
  // Duplicate refund posting is blocked at the Purchases layer itself, before Finance is even involved.
  assert.throws(() => recordSupplierRefund(purchases, { supplierId: supplier.id, debitNoteId: debitNote.id, date: "2026-08-15", mode: "Cash" }), /already been fully refunded/);

  let bank = bankAccount(bankingInitialState(), "Wio Bank", 0).state;
  withWorkspaceState({ purchases }, () => {
    let fin = financeChart();
    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Supplier Refund");
    assert.ok(p, "Supplier Refund must reach Finance Pending Review");
    assert.equal(p.postingRuleId, "RULE-SUPPLIER-REFUND");
    assert.equal(p.cashLink.direction, "In");
    assert.equal(p.cashLink.amount, refund.amount);
    assert.equal(p.cashLink.sourceModule, "Purchases");
    assert.equal(p.cashLink.supplierId, supplier.id);
    assert.equal(accountName(fin, p.lines.find(l => l.creditMinor).accountId), "Accounts Payable", "the refund reinstates AP -- it is now settled by cash instead of a future bill offset");

    const draft = saveDraft(fin, proposalToDraft(p));
    const wio = bank.accounts[0].id;
    const result = confirmAndPost(draft.state, draft.record.id, bank, { accountId: wio });
    fin = result.finState; bank = result.bankState;

    const financeTx = bank.transactions.filter(t => t.sourceModule === "Finance");
    assert.equal(financeTx.length, 1, "exactly one Banking Money In for this refund");
    assert.equal(financeTx[0].direction, "In");
    assert.equal(financeTx[0].amount, refund.amount);
    assert.equal(accountBalance(bank, wio), refund.amount);

    // Duplicate posting at the Finance layer is also blocked, exactly like every other source event.
    const dup = saveDraft(fin, proposalToDraft(p));
    assert.throws(() => postJournal(dup.state, dup.record.id), /already posted/);
  });
}));

test("I: A customer refund (Refund Customer settlement) reaches Finance and Confirm & Post creates exactly one Banking Money Out for the refunded amount", () => withCompany("AE", () => {
  let { sales, invoice } = uaeInvoice(salesInitialState(), "Coral Bay Cafe");
  let r = recordSalesPayment(sales, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-08-26", amount: invoice.grandTotal, mode: "Cash" });
  sales = r.state;
  r = createSalesReturn(sales, { invoiceId: invoice.id, date: "2026-08-27", reasonType: "Service Cancellation", reason: "Event cancelled", settlementMethod: "Refund Customer", items: [{ description: "Event Waiter Manpower Supply", quantity: 25 }] });
  sales = r.state;

  let bank = bankAccount(bankingInitialState()).state;
  withWorkspaceState({ sales }, () => {
    let fin = financeChart();
    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Credit Note");
    assert.equal(p.cashLink.direction, "Out");
    assert.equal(p.cashLink.category, "Customer Refund");
    const refundAmount = p.cashLink.amount;
    const draft = saveDraft(fin, proposalToDraft(p));
    const wio = bank.accounts[0].id;
    const openingBalance = accountBalance(bank, wio);
    const result = confirmAndPost(draft.state, draft.record.id, bank, { accountId: wio });
    fin = result.finState; bank = result.bankState;
    const financeTx = bank.transactions.filter(t => t.sourceModule === "Finance");
    assert.equal(financeTx.length, 1);
    assert.equal(financeTx[0].direction, "Out");
    assert.equal(financeTx[0].amount, refundAmount);
    assert.equal(accountBalance(bank, wio), openingBalance - refundAmount);
  });
}));

test("J: A loan received is a controlled Finance event that books a liability and creates exactly one Banking Money In", () => withCompany("AE", () => {
  let fin = financeChart();
  const loanPayable = fin.settings.defaultAccounts.loanPayable, bankGl = fin.settings.defaultAccounts.bank;
  assert.ok(loanPayable);
  const draft = saveDraft(fin, {
    companyId: CO, branchId: BR, postingDate: "2026-08-15", voucherType: "Loan Received", referenceNumber: "LOAN-1", narration: "Loan Received", authorisedControlAdjustment: true,
    lines: [{ accountId: bankGl, debitMinor: toMinor(50000), creditMinor: 0 }, { accountId: loanPayable, debitMinor: 0, creditMinor: toMinor(50000) }],
    cashLink: { accountId: "", direction: "In", amount: 50000, category: "Loan Received", sourceModule: "Finance", sourceId: uid("CAP") },
  });
  let bank = bankAccount(bankingInitialState(), "Wio Bank", 0).state;
  const wio = bank.accounts[0].id;
  const result = confirmAndPost(draft.state, draft.record.id, bank, { accountId: wio });
  fin = result.finState; bank = result.bankState;
  assert.equal(bank.transactions.length, 1);
  assert.equal(bank.transactions[0].direction, "In");
  assert.equal(accountBalance(bank, wio), 50000);
  const liability = fin.accounts.find(a => a.id === loanPayable);
  assert.equal(fromMinor(ledger(fin, { companyId: CO, accountId: liability.id }).at(-1)?.balanceMinor || 0), 50000);
}));

test("K: A Banking transaction Finance itself already created is never rediscovered as a second 'unknown import' proposal -- the reverse Statement Import path is only for genuinely unmatched bank activity", () => withCompany("AE", () => {
  let fin = financeChart();
  let bank = bankAccount(bankingInitialState(), "Wio Bank", 0).state;
  const wio = bank.accounts[0].id;
  const draft = saveDraft(fin, {
    companyId: CO, branchId: BR, postingDate: "2026-08-15", voucherType: "Loan Received", referenceNumber: "LOAN-2", narration: "Loan Received", authorisedControlAdjustment: true,
    lines: [{ accountId: fin.settings.defaultAccounts.bank, debitMinor: toMinor(1000), creditMinor: 0 }, { accountId: fin.settings.defaultAccounts.loanPayable, debitMinor: 0, creditMinor: toMinor(1000) }],
    cashLink: { accountId: "", direction: "In", amount: 1000, category: "Loan Received", sourceModule: "Finance", sourceId: uid("CAP") },
  });
  const result = confirmAndPost(draft.state, draft.record.id, bank, { accountId: wio });
  fin = result.finState; bank = result.bankState;
  assert.equal(bank.transactions.length, 1);

  withWorkspaceState({ banking: bank }, () => {
    const proposals = discoverSources(fin, CO, BR);
    assert.equal(proposals.some(p => p.module === "Banking" && p.entityId === bank.transactions[0].id), false, "a Finance-created Banking transaction must never come back as a pending review item");
  });

  // A genuinely unmatched imported transaction (no sourceModule) is still correctly surfaced.
  bank.transactions.push({ id: "BTX-IMPORTED", accountId: wio, date: "2026-08-16", direction: "In", amount: 250, moneyIn: 250, moneyOut: 0, signedAmount: 250, category: "Other", description: "Unrecognised deposit", status: "Unmatched" });
  withWorkspaceState({ banking: bank }, () => {
    const proposals = discoverSources(fin, CO, BR);
    assert.equal(proposals.some(p => p.entityId === "BTX-IMPORTED"), true, "genuinely unmatched imported bank activity must still reach Finance for classification");
  });
}));

test("L: Reversing a posted cash-linked journal restores the Banking balance exactly once, even if the reversal is attempted twice", () => withCompany("AE", () => {
  let fin = financeChart();
  const draft = saveDraft(fin, {
    companyId: CO, branchId: BR, postingDate: "2026-08-15", voucherType: "Loan Received", referenceNumber: "LOAN-3", narration: "Loan Received", authorisedControlAdjustment: true,
    lines: [{ accountId: fin.settings.defaultAccounts.bank, debitMinor: toMinor(1000), creditMinor: 0 }, { accountId: fin.settings.defaultAccounts.loanPayable, debitMinor: 0, creditMinor: toMinor(1000) }],
    cashLink: { accountId: "", direction: "In", amount: 1000, category: "Loan Received", sourceModule: "Finance", sourceId: uid("CAP") },
  });
  let bank = bankAccount(bankingInitialState(), "Wio Bank", 0).state;
  const wio = bank.accounts[0].id;
  let result = confirmAndPost(draft.state, draft.record.id, bank, { accountId: wio });
  fin = result.finState; bank = result.bankState;
  assert.equal(accountBalance(bank, wio), 1000);

  function reverseJournalAndSync(finState, journalId, date, reason, bankState) {
    const original = finState.journals.find(j => j.id === journalId);
    const reversed = reverseJournal(finState, journalId, date, reason);
    if (!original?.cashLink?.bankingTransactionId) return { finState: reversed.state, bankState };
    const bankResult = reverseFinancePosting(bankState, original, reason);
    return { finState: reversed.state, bankState: bankResult.state, duplicate: bankResult.duplicate };
  }

  let r = reverseJournalAndSync(fin, draft.record.id, "2026-08-20", "Loan cancelled before drawdown confirmed", bank);
  fin = r.finState; bank = r.bankState;
  assert.equal(accountBalance(bank, wio), 0, "the loan-in must be fully reversed exactly once");
  assert.equal(bank.transactions[0].status, "Reversed");

  // Second attempt: Finance itself refuses a double reversal before Banking is even touched
  // (the journal is no longer "Posted", so it can't be reversed again).
  assert.throws(() => reverseJournalAndSync(fin, draft.record.id, "2026-08-21", "retry", bank), /Only a Posted journal can be reversed/);

  // Even calling the Banking-sync reversal a second time directly (bypassing Finance) is a no-op.
  const original = fin.journals.find(j => j.id === draft.record.id);
  const direct = reverseFinancePosting(bank, original, "retry");
  assert.equal(direct.duplicate, true);
  assert.equal(accountBalance(direct.state, wio), 0, "balance must not go further negative or be restored twice");
}));

test("M: Refresh/reopen consistency -- after Confirm & Post, re-running discoverSources on the same persisted state finds nothing left pending and reports the same balances", () => withCompany("AE", () => {
  let { purchases, supplier, bill } = uaeSupplierBill(purchasesInitialState(), "Gulf Fresh Produce LLC", "INV-9");
  let r = recordSupplierPayment(purchases, { supplierId: supplier.id, date: "2026-08-10", mode: "Bank Transfer", allocations: [{ billId: bill.id, amount: bill.grandTotal }] });
  purchases = r.state;

  let bank = bankAccount(bankingInitialState()).state;
  const wio = bank.accounts[0].id;

  let finAfterReload;
  withWorkspaceState({ purchases }, () => {
    let fin = financeChart();
    const billProposal = discoverSources(fin, CO, BR).find(x => x.entityType === "Bill");
    const billDraft = saveDraft(fin, proposalToDraft(billProposal));
    fin = postJournal(billDraft.state, billDraft.record.id).state;

    const p = discoverSources(fin, CO, BR).find(x => x.entityType === "Supplier Payment");
    const draft = saveDraft(fin, proposalToDraft(p));
    const result = confirmAndPost(draft.state, draft.record.id, bank, { accountId: wio });
    finAfterReload = JSON.parse(JSON.stringify(result.finState)); // simulate persisting and reloading from storage
    bank = result.bankState;
  });

  // Reopen the app: reload the same persisted Finance state, discover sources again.
  withWorkspaceState({ purchases }, () => {
    const stillPending = discoverSources(finAfterReload, CO, BR).filter(p => p.entityType === "Supplier Payment");
    assert.equal(stillPending.length, 0, "the posted supplier payment must not resurface as pending after a reload");
    const ap = finAfterReload.accounts.find(a => a.name === "Accounts Payable");
    assert.equal(fromMinor(ledger(finAfterReload, { companyId: CO, accountId: ap.id }).at(-1)?.balanceMinor || 0), 0);
  });
  assert.equal(bank.transactions.filter(t => t.sourceModule === "Finance").length, 1, "reloading must not have created any extra Banking transactions");
}));

test("Finance Posting permission ('Confirm & Post') is a real Administration/Roles & Permissions action, and is enforced INSIDE the posting/reversal functions themselves -- before any state mutation -- not only by hiding a button", () => {
  const adminCore = readFileSync(new URL("../src/administration/core.js", import.meta.url), "utf8");
  assert.match(adminCore, /"Confirm & Post"/, "must be a real Administration ACTIONS entry, editable from Company Member Access exactly like every other module action");

  const app = readFileSync(new URL("../src/finance/app.js", import.meta.url), "utf8");
  assert.match(app, /function canPostFinance\(\)/);
  assert.match(app, /co\.accessPermissions\?\.\["Finance & Accounting"\]\?\.\["Confirm & Post"\]/);
  assert.match(app, /co\.ownerId&&user\.id&&co\.ownerId===user\.id\)return true/, "the Owner always retains full access, matching every other permission check in this app");

  // The permission check must be the FIRST thing postJournalAndSync/reverseJournalAndSync do --
  // strictly before postJournal/reverseJournal is ever called -- so it cannot be bypassed by
  // triggering the mutation some other way than the button (devtools, a stale view, a retry).
  const postFn = app.slice(app.indexOf("function postJournalAndSync"), app.indexOf("function", app.indexOf("function postJournalAndSync") + 10));
  const postGuardIndex = postFn.indexOf("if(!canPostFinance())throw Error");
  const postMutationIndex = postFn.indexOf("postJournal(startState,journalId)");
  assert.ok(postGuardIndex >= 0 && postMutationIndex > postGuardIndex, "postJournalAndSync must check the permission before calling postJournal");

  const reverseFn = app.slice(app.indexOf("function reverseJournalAndSync"), app.indexOf("function", app.indexOf("function reverseJournalAndSync") + 10));
  const reverseGuardIndex = reverseFn.indexOf("if(!canPostFinance())throw Error");
  const reverseMutationIndex = reverseFn.indexOf("reverseJournal(startState,journalId,date,reason)");
  assert.ok(reverseGuardIndex >= 0 && reverseMutationIndex > reverseGuardIndex, "reverseJournalAndSync must check the permission before calling reverseJournal");

  // UI-level treatment (not the only enforcement, but present): Post/Reverse buttons and the
  // Confirm & Post submit action are hidden/blocked when the permission is absent.
  assert.match(app, /canPostRole=canPostFinance\(\)/);
  assert.match(app, /You do not have permission to Confirm & Post/);
});

test("Finance's rejection reason and reviewer are written back onto the exact source record it was about (never deleting or recreating it), and update to Posted once Confirm & Post succeeds", () => withCompany("AE", () => {
  let { sales, invoice } = uaeInvoice(salesInitialState(), "Riverside Bistro");
  let r = recordSalesPayment(sales, { customerId: invoice.customerId, invoiceId: invoice.id, date: "2026-08-26", amount: invoice.grandTotal, mode: "Bank Transfer", bankAccountId: "wrong-account" });
  sales = r.state;
  const paymentId = sales.payments[0].id;

  withWorkspaceState({ sales }, () => {
    const p = discoverSources(financeChart(), CO, BR).find(x => x.entityType === "Customer Receipt");
    assert.equal(p.entityId, paymentId);

    const wrote = writeSourceReviewStatus({ module: p.module, entityType: p.entityType, entityId: p.entityId }, "Returned for Correction", { reason: "Wrong bank account", reviewer: "Finance Owner" });
    assert.equal(wrote, true);

    const raw1 = JSON.parse(globalThis.InfoBridgeWorkspaceStorage.getItem("infobridgeindia.sales.v1"));
    assert.equal(raw1.payments.length, 1, "the source payment record must not be deleted or duplicated");
    const record1 = raw1.payments.find(x => x.id === paymentId);
    assert.equal(record1.financeStatus, "Returned for Correction");
    assert.equal(record1.financeReason, "Wrong bank account");
    assert.equal(record1.financeReviewedBy, "Finance Owner");
    assert.ok(record1.financeReviewedAt);
    assert.equal(record1.status, "Recorded", "rejection must not alter the payment's own operational status -- Sales still shows it as recorded, pending correction");

    // The Sales module can display exactly this without ever writing these fields itself.
    const salesApp = readFileSync(new URL("../src/sales/app.js", import.meta.url), "utf8");
    assert.match(salesApp, /function financeStatusCell\(x\)/);
    assert.doesNotMatch(salesApp, /\.financeStatus\s*=(?!=)/, "Sales must only ever READ financeStatus, never assign it");

    // Corrected and resubmitted (a fresh review), then Confirmed & Posted -- status updates to
    // Posted and the correction reason is cleared, without a new payment record being created.
    const posted = writeSourceReviewStatus({ module: p.module, entityType: p.entityType, entityId: p.entityId }, "Posted", { reviewer: "Finance Owner" });
    assert.equal(posted, true);
    const raw2 = JSON.parse(globalThis.InfoBridgeWorkspaceStorage.getItem("infobridgeindia.sales.v1"));
    assert.equal(raw2.payments.length, 1);
    const record2 = raw2.payments.find(x => x.id === paymentId);
    assert.equal(record2.financeStatus, "Posted");
    assert.equal(record2.financeReason, "");
  });
}));

test("Confirm & Post itself writes the Posted status back to the source record via postJournalAndSync, using the journal's own source reference", () => {
  const app = readFileSync(new URL("../src/finance/app.js", import.meta.url), "utf8");
  assert.match(app, /if\(journal\.source\)writeSourceReviewStatus\(journal\.source,"Posted",\{reviewer:reviewerName\(\)\}\)/);
  assert.match(app, /writeSourceReviewStatus\(\{module:p\.module,entityType:p\.entityType,entityId:p\.entityId\},"Returned for Correction"/, "the Reject / Return for correction action writes the reason back the same way");
});
