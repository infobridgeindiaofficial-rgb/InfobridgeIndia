import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialState, saveDraft, postJournal, ledger, trialBalance, dashboard, toMinor, fromMinor, uid } from "../src/finance/core.js";
import { createCountryDefaultChart } from "../src/finance/country-chart.js";

const CO = "CO-TEST", BR = "BR-TEST";
function chart() { return createCountryDefaultChart(initialState(), CO, BR, { country: "AE" }, uid); }
function accountId(state, name) { return state.accounts.find(a => a.name === name).id; }

function postDirectExpense(state, { targetName, cashName, amount, date = "2026-08-01", reference = "REF-1", notes = "" }) {
  const m = toMinor(amount), target = accountId(state, targetName), cash = accountId(state, cashName);
  const lines = [{ accountId: target, debitMinor: m, creditMinor: 0 }, { accountId: cash, debitMinor: 0, creditMinor: m }];
  const draft = saveDraft(state, { companyId: CO, branchId: BR, postingDate: date, voucherType: "Payment Voucher", referenceNumber: reference, narration: notes || "Direct Expenses", authorisedControlAdjustment: true, lines });
  return postJournal(draft.state, draft.record.id);
}

test("A Bank-paid Office Expense creates a balanced Dr Office Expenses / Cr Bank journal", () => {
  const state = chart();
  const r = postDirectExpense(state, { targetName: "Office Expenses", cashName: "Bank", amount: 500 });
  assert.equal(r.record.status, "Posted");
  const office = r.record.lines.find(l => l.accountId === accountId(state, "Office Expenses"));
  const bank = r.record.lines.find(l => l.accountId === accountId(state, "Bank"));
  assert.equal(office.debitMinor, toMinor(500));
  assert.equal(office.creditMinor, 0);
  assert.equal(bank.creditMinor, toMinor(500));
  assert.equal(bank.debitMinor, 0);
});

test("Debit equals Credit for the posted expense journal", () => {
  const state = chart();
  const r = postDirectExpense(state, { targetName: "Office Expenses", cashName: "Bank", amount: 500 });
  const debit = r.record.lines.reduce((a, l) => a + l.debitMinor, 0), credit = r.record.lines.reduce((a, l) => a + l.creditMinor, 0);
  assert.equal(debit, credit);
  assert.ok(debit > 0);
});

test("Posted expense increases the Office Expenses account's posted balance shown on the Expenses page", () => {
  const state = chart();
  const posted = postDirectExpense(state, { targetName: "Office Expenses", cashName: "Bank", amount: 500 }).state;
  const balance = ledger(posted, { companyId: CO, accountId: accountId(state, "Office Expenses") }).at(-1)?.balanceMinor || 0;
  assert.equal(fromMinor(balance), 500);
});

test("Dashboard Total Expenses, Net Profit and Cash & Bank update correctly after posting an expense", () => {
  const state = chart();
  const before = dashboard(state, CO);
  const posted = postDirectExpense(state, { targetName: "Office Expenses", cashName: "Bank", amount: 500 }).state;
  const after = dashboard(posted, CO);
  assert.equal(fromMinor(after.expense - before.expense), 500);
  assert.equal(fromMinor(after.netProfit - before.netProfit), -500);
  assert.equal(fromMinor(after.cash - before.cash), -500);
});

test("General Ledger receives both the expense and the bank/cash line", () => {
  const state = chart();
  const posted = postDirectExpense(state, { targetName: "Office Expenses", cashName: "Bank", amount: 500 }).state;
  const officeRows = ledger(posted, { companyId: CO, accountId: accountId(state, "Office Expenses") });
  const bankRows = ledger(posted, { companyId: CO, accountId: accountId(state, "Bank") });
  assert.equal(officeRows.length, 1);
  assert.equal(bankRows.length, 1);
  assert.equal(officeRows[0].debitMinor, toMinor(500));
  assert.equal(bankRows[0].creditMinor, toMinor(500));
});

test("Trial Balance remains balanced after posting a direct expense", () => {
  const state = chart();
  const posted = postDirectExpense(state, { targetName: "Office Expenses", cashName: "Bank", amount: 500 }).state;
  const tb = trialBalance(posted, { companyId: CO });
  assert.equal(tb.balanced, true);
  assert.equal(tb.difference, 0);
});

test("Different expense categories (Rent, Salary, Advertising, Bank Charges, Shipping/Freight) all post correctly", () => {
  for (const name of ["Rent Expense", "Salary Expense", "Advertising", "Bank Charges", "Shipping / Freight"]) {
    const state = chart();
    const r = postDirectExpense(state, { targetName: name, cashName: "Cash", amount: 120 });
    assert.equal(r.record.status, "Posted", name);
    const balance = ledger(r.state, { companyId: CO, accountId: accountId(state, name) }).at(-1)?.balanceMinor || 0;
    assert.equal(fromMinor(balance), 120, name);
  }
});

test("Add Income (Interest Income received into Cash) posts as Dr Cash / Cr Interest Income", () => {
  const state = chart();
  const cash = accountId(state, "Cash"), interest = accountId(state, "Interest Income");
  const lines = [{ accountId: cash, debitMinor: toMinor(200), creditMinor: 0 }, { accountId: interest, debitMinor: 0, creditMinor: toMinor(200) }];
  const draft = saveDraft(state, { companyId: CO, branchId: BR, postingDate: "2026-08-01", voucherType: "Receipt Voucher", referenceNumber: "REF-2", narration: "Direct Income", authorisedControlAdjustment: true, lines });
  const posted = postJournal(draft.state, draft.record.id);
  assert.equal(posted.record.status, "Posted");
  const dash = dashboard(posted.state, CO);
  assert.equal(fromMinor(dash.income), 200);
  assert.equal(fromMinor(dash.cash), 200);
});

test("Re-posting an already-posted expense journal is blocked (duplicate posting prevention)", () => {
  const state = chart();
  const r = postDirectExpense(state, { targetName: "Office Expenses", cashName: "Bank", amount: 500 });
  assert.throws(() => postJournal(r.state, r.record.id), /Only a Draft or approved-pending journal can be posted/);
});

test("Direct expense journal preserves companyId, branchId, voucher type and narration", () => {
  const state = chart();
  const r = postDirectExpense(state, { targetName: "Office Expenses", cashName: "Bank", amount: 500, reference: "PV-9", notes: "August office supplies" });
  assert.equal(r.record.companyId, CO);
  assert.equal(r.record.branchId, BR);
  assert.equal(r.record.voucherType, "Payment Voucher");
  assert.equal(r.record.referenceNumber, "PV-9");
  assert.equal(r.record.narration, "August office supplies");
});

const app = readFileSync(new URL("../src/finance/app.js", import.meta.url), "utf8");

test("Add Expenses button emits the exact action key the dispatcher recognizes (root cause fix)", () => {
  assert.match(app, /data-action="\$\{income\?"income":"expense"\}">Add \$\{income\?"Income":"Expenses"\}/);
  assert.doesNotMatch(app, /data-action="\$\{type\.toLowerCase\(\)\}"/, "must not derive the action key from the page title text");
});

test("act() dispatcher opens directForm for both the income and expense action keys", () => {
  assert.match(app, /if\(a==="income"\)directForm\("Income"\)/);
  assert.match(app, /if\(a==="expense"\)directForm\("Expenses"\)/);
});

test("Add Expenses / Add Income form shows an accounting preview before posting", () => {
  assert.match(app, /Accounting preview/);
  assert.match(app, /id="direct-preview"/);
  assert.match(app, /Dr \$\{esc\(drName\)\}/);
  assert.match(app, /Cr \$\{esc\(crName\)\}/);
});

test("directForm saves with authorisedControlAdjustment so posting to Cash/Bank/AR/AP does not throw", () => {
  assert.match(app, /narration:v\.notes\|\|`Direct \$\{type\}`,authorisedControlAdjustment:true,lines/);
});

test("The Dashboard quick-action chips already used the correct singular keys (confirms this was the only broken instance)", () => {
  assert.match(app, /data-action="income">Add Income/);
  assert.match(app, /data-action="expense">Add Expense</);
});
