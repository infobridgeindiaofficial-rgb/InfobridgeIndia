import { recordTransaction, reverseTransaction } from "./core.js";

// The ONLY path that creates a real Banking Money In / Money Out transaction for a
// Sales/Purchases/Payroll payment, refund, or manual Finance entry. Operational modules never
// call Banking directly for these anymore -- they only reach Finance's Pending Review queue
// (see src/finance/adapters.js), and a transaction is created here strictly after Finance
// confirms/posts the journal (src/finance/app.js), never before.
//
// Dedup is keyed by journal id (sourceModule:"Finance", sourceId: journal.id): retrying,
// reopening, or re-rendering the Confirm & Post action can never create a second transaction
// for the same journal.
export function syncFinancePosting(bankState, journal, { accountId } = {}) {
  const cashLink = journal?.cashLink;
  if (!cashLink) return { state: bankState, record: null, duplicate: false };
  const existing = bankState.transactions.find((tx) => tx.sourceModule === "Finance" && tx.sourceId === journal.id);
  if (existing) return { state: bankState, record: existing, duplicate: true };
  const targetAccountId = accountId || cashLink.accountId;
  const account = bankState.accounts.find((item) => item.id === targetAccountId && item.active);
  if (!account) throw Error("Select an active Banking account to post this journal's cash movement to");
  const result = recordTransaction(bankState, {
    accountId: targetAccountId,
    date: journal.postingDate,
    direction: cashLink.direction,
    amount: cashLink.amount,
    category: cashLink.category,
    description: `${journal.source?.module || "Finance"} · ${journal.narration}`,
    reference: cashLink.reference || journal.journalNumber,
    source: "Finance",
    sourceModule: "Finance",
    sourceId: journal.id,
    financeJournalId: journal.id,
    customerId: cashLink.customerId,
    supplierId: cashLink.supplierId,
    status: "Matched",
    matchStatus: "Matched",
  });
  return { ...result, duplicate: false };
}

// Reverses the SAME Banking transaction a posted journal's cashLink created (in place, via
// Banking's own reverseTransaction -- never a second offsetting transaction), restoring the
// balance exactly once. Called only when Finance reverses a journal that has a linked
// transaction; a journal with no cashLink (an invoice/bill/non-cash adjustment) never reaches
// Banking at all, so there is nothing to reverse here.
export function reverseFinancePosting(bankState, journal, reason) {
  const bankingTransactionId = journal?.cashLink?.bankingTransactionId;
  if (!bankingTransactionId) return { state: bankState, record: null, missing: true };
  const transaction = bankState.transactions.find((tx) => tx.id === bankingTransactionId);
  if (!transaction) return { state: bankState, record: null, missing: true };
  if (transaction.status === "Reversed") return { state: bankState, record: transaction, duplicate: true };
  return { state: reverseTransaction(bankState, transaction.id, reason), record: transaction, duplicate: false };
}
