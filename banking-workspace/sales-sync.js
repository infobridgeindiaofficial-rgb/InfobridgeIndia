import { recordTransaction, reverseTransaction } from "./core.js";

export function syncSalesPayment(bankState, payment, { invoice, customer, accountId }) {
  if (!payment?.id) throw Error("Sales payment is required");
  const existing = bankState.transactions.find((tx) => tx.sourceModule === "Sales" && tx.sourceId === payment.id);
  if (existing) return { state: bankState, record: existing, duplicate: true };
  const account = bankState.accounts.find((item) => item.id === accountId && item.active);
  if (!account) throw Error("Select an active Banking account");
  const result = recordTransaction(bankState, {
    accountId,
    date: payment.date,
    direction: "In",
    amount: payment.amount,
    category: "Customer Payment",
    description: `${customer?.name || "Customer"} · ${invoice?.id || payment.invoiceId}`,
    reference: payment.reference || payment.id,
    source: "Sales",
    sourceModule: "Sales",
    sourceId: payment.id,
    customerId: payment.customerId,
    invoiceId: payment.invoiceId,
    receiptId: payment.id,
    paymentMode: payment.mode,
    status: "Matched",
    matchStatus: "Matched",
  });
  return { ...result, duplicate: false };
}

export function reverseSalesPayment(bankState, paymentId, reason) {
  const transaction = bankState.transactions.find((tx) => tx.sourceModule === "Sales" && tx.sourceId === paymentId);
  if (!transaction) return { state: bankState, record: null, missing: true };
  if (transaction.status === "Reversed") return { state: bankState, record: transaction, duplicate: true };
  return { state: reverseTransaction(bankState, transaction.id, reason), record: transaction, duplicate: false };
}
