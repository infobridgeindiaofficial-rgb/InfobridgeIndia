import { num, round, salespersonMetrics, salesTeamRoster, customerBalance } from "./core.js";
import { resolveCountryConfig, formatCountryMoney } from "../country/registry.js";
import { assignedSalespersonName } from "./employees.js";

export const REPORT_TYPES = ["Sales Summary", "Invoice Report", "Collections Report", "Outstanding Receivables", "Credit Note / Returns Report", "Tax Report", "Salesperson Performance", "Customer Sales Report"];

const inRange = (value, from, to) => {
  const d = String(value || "").slice(0, 10);
  if (!d) return !from && !to;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};

function customerOf(state, id) { return state.customers.find(c => c.id === id); }
function customerNameOf(state, record) { return record.partyName || customerOf(state, record.customerId)?.name || "Unknown customer"; }
function creditsAgainst(state, invoiceId) { return round(state.returns.filter(r => r.invoiceId === invoiceId && r.status !== "Cancelled").reduce((a, r) => a + num(r.grandTotal), 0)); }

function salesSummary(state, { from, to }, money, displayDate, ae, employees) {
  const invoices = state.invoices.filter(x => x.status !== "Cancelled" && inRange(x.date, from, to));
  const credits = state.returns.filter(x => x.status !== "Cancelled" && inRange(x.date, from, to));
  const grossSales = round(invoices.reduce((a, x) => a + num(x.grandTotal), 0));
  const creditTotal = round(credits.reduce((a, x) => a + num(x.grandTotal), 0));
  const netSales = round(grossSales - creditTotal);
  const collections = round(state.payments.filter(x => x.status !== "Reversed" && inRange(x.date, from, to)).reduce((a, x) => a + num(x.amount), 0));
  const outstanding = round(state.invoices.filter(x => x.status !== "Cancelled").reduce((a, x) => a + num(x.balanceDue), 0));
  const summary = [
    { label: "Gross Sales", value: money(grossSales) },
    { label: "Credit Notes", value: money(creditTotal) },
    { label: "Net Sales", value: money(netSales) },
    { label: "Collections", value: money(collections) },
    { label: "Outstanding", value: money(outstanding) },
  ];
  const columns = ["Date", "Invoice No.", "Customer", "Salesperson", "Taxable Amount", ae ? "VAT" : "GST", "Invoice Total", "Credit Notes", "Net Sales", "Paid", "Balance", "Status"];
  const rows = invoices.map(x => {
    const creditForInvoice = creditsAgainst(state, x.id);
    return {
      "Date": displayDate(x.date), "Invoice No.": x.id, "Customer": customerNameOf(state, x), "Salesperson": assignedSalespersonName(x, employees),
      "Taxable Amount": money(x.taxable), [ae ? "VAT" : "GST"]: money(x.tax), "Invoice Total": money(x.grandTotal), "Credit Notes": money(creditForInvoice),
      "Net Sales": money(round(x.grandTotal - creditForInvoice)), "Paid": money(x.amountPaid), "Balance": money(x.balanceDue), "Status": x.status,
    };
  });
  return { summary, columns, rows };
}

function invoiceReport(state, { from, to }, money, displayDate, employees) {
  const invoices = state.invoices.filter(x => x.status !== "Cancelled" && inRange(x.date, from, to));
  const columns = ["Invoice No.", "Invoice Date", "Customer", "Salesperson", "Taxable Amount", "Tax", "Total", "Credit Note Amount", "Net Invoice Value", "Paid", "Balance", "Status"];
  const rows = invoices.map(x => {
    const creditAmount = creditsAgainst(state, x.id);
    return {
      "Invoice No.": x.id, "Invoice Date": displayDate(x.date), "Customer": customerNameOf(state, x), "Salesperson": assignedSalespersonName(x, employees),
      "Taxable Amount": money(x.taxable), "Tax": money(x.tax), "Total": money(x.grandTotal), "Credit Note Amount": money(creditAmount),
      "Net Invoice Value": money(round(x.grandTotal - creditAmount)), "Paid": money(x.amountPaid), "Balance": money(x.balanceDue), "Status": x.status,
    };
  });
  return { summary: [], columns, rows };
}

function collectionsReport(state, { from, to }, money, displayDate, employees) {
  const payments = state.payments.filter(x => inRange(x.date, from, to));
  const total = round(payments.filter(x => x.status !== "Reversed").reduce((a, x) => a + num(x.amount), 0));
  const columns = ["Receipt No.", "Payment Date", "Invoice No.", "Customer", "Salesperson", "Payment Mode", "Reference", "Amount", "Status"];
  const rows = payments.map(x => ({
    "Receipt No.": x.id, "Payment Date": displayDate(x.date), "Invoice No.": x.invoiceId, "Customer": customerOf(state, x.customerId)?.name || "Unknown customer",
    "Salesperson": assignedSalespersonName(x, employees), "Payment Mode": x.mode, "Reference": x.reference || "—", "Amount": money(x.amount), "Status": x.status,
  }));
  return { summary: [{ label: "Total Collections", value: money(total) }], columns, rows };
}

function ageBucket(days) { if (days === null) return "Unknown"; if (days <= 0) return "Current"; if (days <= 30) return "1–30 Days"; if (days <= 60) return "31–60 Days"; if (days <= 90) return "61–90 Days"; return "90+ Days"; }

function outstandingReport(state, { from, to }, money, displayDate, employees, now = new Date()) {
  const invoices = state.invoices.filter(x => x.status !== "Cancelled" && num(x.balanceDue) > 0 && inRange(x.date, from, to));
  const today = now.toISOString().slice(0, 10);
  const ageOf = due => due ? Math.floor((new Date(today) - new Date(`${due}T00:00:00`)) / 86400000) : null;
  const columns = ["Invoice No.", "Invoice Date", "Due Date", "Customer", "Salesperson", "Original Total", "Credits", "Paid", "Balance Due", "Age", "Status"];
  const rows = invoices.map(x => {
    const bucket = ageBucket(ageOf(x.dueDate));
    return {
      "Invoice No.": x.id, "Invoice Date": displayDate(x.date), "Due Date": x.dueDate ? displayDate(x.dueDate) : "—", "Customer": customerNameOf(state, x),
      "Salesperson": assignedSalespersonName(x, employees), "Original Total": money(x.grandTotal), "Credits": money(x.creditedAmount),
      "Paid": money(x.amountPaid), "Balance Due": money(x.balanceDue), "Age": bucket, "Status": x.status,
    };
  });
  const buckets = ["Current", "1–30 Days", "31–60 Days", "61–90 Days", "90+ Days"];
  const summary = buckets.map(label => ({ label, value: money(round(invoices.filter(x => ageBucket(ageOf(x.dueDate)) === label).reduce((a, x) => a + num(x.balanceDue), 0))) }));
  return { summary, columns, rows };
}

function creditNoteReport(state, { from, to }, money, displayDate) {
  const credits = state.returns.filter(x => x.status !== "Cancelled" && inRange(x.date, from, to));
  const total = round(credits.reduce((a, x) => a + num(x.grandTotal), 0));
  const taxAdjustment = round(credits.reduce((a, x) => a + num(x.tax), 0));
  const refundRelated = round(credits.filter(x => x.settlementMethod === "Refund Customer").reduce((a, x) => a + num(x.grandTotal), 0));
  const creditRelated = round(credits.filter(x => x.settlementMethod === "Keep as Customer Credit").reduce((a, x) => a + num(x.grandTotal), 0));
  const columns = ["Credit Note No.", "Date", "Original Invoice", "Customer", "Reason", "Taxable Credit", "Tax Adjustment", "Total Credit", "Settlement Method", "Settlement Status"];
  const rows = credits.map(x => ({
    "Credit Note No.": x.id, "Date": displayDate(x.date), "Original Invoice": x.invoiceId, "Customer": customerOf(state, x.customerId)?.name || "Unknown customer",
    "Reason": x.reasonType || x.reason || "—", "Taxable Credit": money(x.taxable), "Tax Adjustment": money(x.tax), "Total Credit": money(x.grandTotal),
    "Settlement Method": x.settlementMethod || "—", "Settlement Status": x.settlementStatus || "—",
  }));
  return { summary: [{ label: "Total Credits Issued", value: money(total) }, { label: "Tax Adjustment", value: money(taxAdjustment) }, { label: "Refund-related Credits", value: money(refundRelated) }, { label: "Customer Credit-related Credits", value: money(creditRelated) }], columns, rows };
}

function taxReport(state, { from, to }, money, displayDate, ae) {
  const invoices = state.invoices.filter(x => x.status !== "Cancelled" && inRange(x.date, from, to));
  const credits = state.returns.filter(x => x.status !== "Cancelled" && inRange(x.date, from, to));
  const grossTaxable = round(invoices.reduce((a, x) => a + num(x.taxable), 0));
  const taxableCredit = round(credits.reduce((a, x) => a + num(x.taxable), 0));
  const netTaxable = round(grossTaxable - taxableCredit);
  const outputTax = round(invoices.reduce((a, x) => a + num(x.tax), 0));
  const creditTaxAdjustment = round(credits.reduce((a, x) => a + num(x.tax), 0));
  const netTax = round(outputTax - creditTaxAdjustment);
  const taxWord = ae ? "VAT" : "GST";
  const summary = [
    { label: "Gross Taxable Sales", value: money(grossTaxable) },
    { label: "Less Taxable Credits", value: money(taxableCredit) },
    { label: "Net Taxable Sales", value: money(netTaxable) },
    { label: `Output ${taxWord}`, value: money(outputTax) },
    { label: `Less ${taxWord} Credit Adjustments`, value: money(creditTaxAdjustment) },
    { label: `NET ${taxWord}`, value: money(netTax) },
  ];
  const columns = ae
    ? ["Date", "Document Type", "Document No.", "Customer", "TRN", "Taxable Amount", "VAT %", "VAT Amount", "Credit Adjustment", "Net VAT"]
    : ["Date", "Document Type", "Document No.", "Customer", "GSTIN", "Taxable Amount", "CGST", "SGST", "IGST", "Credit Adjustment", "Net GST"];
  const rowFor = (x, docType) => {
    const customer = customerOf(state, x.customerId), isCredit = docType === "Credit Note", sign = isCredit ? -1 : 1;
    const row = { "Date": displayDate(x.date), "Document Type": docType, "Document No.": x.id, "Customer": customerNameOf(state, x) };
    if (ae) {
      const rates = [...new Set((x.items || []).map(i => num(i.taxRate ?? i.gstRate)).filter(Boolean))];
      row["TRN"] = customer?.trn || "—"; row["Taxable Amount"] = money(x.taxable); row["VAT %"] = rates.length === 1 ? `${rates[0]}%` : "—";
      row["VAT Amount"] = money(x.vat ?? x.tax); row["Credit Adjustment"] = money(isCredit ? (x.vat ?? x.tax) : 0); row["Net VAT"] = money(sign * num(x.vat ?? x.tax));
    } else {
      row["GSTIN"] = customer?.gstin || "—"; row["Taxable Amount"] = money(x.taxable); row["CGST"] = money(x.cgst); row["SGST"] = money(x.sgst); row["IGST"] = money(x.igst);
      row["Credit Adjustment"] = money(isCredit ? x.tax : 0); row["Net GST"] = money(sign * num(x.tax));
    }
    return row;
  };
  const rows = [...invoices.map(x => rowFor(x, "Invoice")), ...credits.map(x => rowFor(x, "Credit Note"))];
  return { summary, columns, rows };
}

function salespersonPerformanceReport(state, { from, to }, money, employees) {
  const roster = salesTeamRoster(state, employees);
  const scoped = { ...state, invoices: state.invoices.filter(x => inRange(x.date, from, to)), payments: state.payments.filter(x => inRange(x.date, from, to)), returns: state.returns.filter(x => inRange(x.date, from, to)) };
  const columns = ["Salesperson", "Designation", "Leads", "Won", "Lost", "Conversion %", "Gross Sales", "Credits", "Net Sales", "Collections", "Outstanding"];
  const rows = roster.map(person => {
    const m = salespersonMetrics(scoped, { employeeId: person.employeeId, name: person.name });
    return { "Salesperson": person.name, "Designation": person.designation || "—", "Leads": m.leads, "Won": m.won, "Lost": m.lost, "Conversion %": `${m.conversion}%`, "Gross Sales": money(m.sales), "Credits": money(m.credits), "Net Sales": money(m.netSales), "Collections": money(m.collections), "Outstanding": money(m.outstanding) };
  });
  return { summary: [], columns, rows };
}

function customerSalesReport(state, { from, to }, money) {
  const invoices = state.invoices.filter(x => x.status !== "Cancelled" && inRange(x.date, from, to));
  const credits = state.returns.filter(x => x.status !== "Cancelled" && inRange(x.date, from, to));
  const payments = state.payments.filter(x => x.status !== "Reversed" && inRange(x.date, from, to));
  const columns = ["Customer", "Invoices", "Gross Sales", "Credits", "Net Sales", "Collections", "Outstanding"];
  const rows = state.customers.map(customer => {
    const custInvoices = invoices.filter(x => x.customerId === customer.id);
    const hasActivity = custInvoices.length || credits.some(x => x.customerId === customer.id) || payments.some(x => x.customerId === customer.id);
    if (!hasActivity) return null;
    const gross = round(custInvoices.reduce((a, x) => a + num(x.grandTotal), 0));
    const credit = round(credits.filter(x => x.customerId === customer.id).reduce((a, x) => a + num(x.grandTotal), 0));
    const collected = round(payments.filter(x => x.customerId === customer.id).reduce((a, x) => a + num(x.amount), 0));
    return { "Customer": customer.name, "Invoices": custInvoices.length, "Gross Sales": money(gross), "Credits": money(credit), "Net Sales": money(round(gross - credit)), "Collections": money(collected), "Outstanding": money(customerBalance(state, customer.id)) };
  }).filter(Boolean);
  return { summary: [], columns, rows };
}

export function buildReport(state, type, { from = "", to = "", company = globalThis.InfoBridgeCompany, employees = [] } = {}) {
  const config = resolveCountryConfig(company), ae = config.country === "AE";
  const money = value => formatCountryMoney(num(value), config.country, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const displayDate = value => value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : "—";
  const range = { from, to };
  const builders = {
    "Sales Summary": () => salesSummary(state, range, money, displayDate, ae, employees),
    "Invoice Report": () => invoiceReport(state, range, money, displayDate, employees),
    "Collections Report": () => collectionsReport(state, range, money, displayDate, employees),
    "Outstanding Receivables": () => outstandingReport(state, range, money, displayDate, employees),
    "Credit Note / Returns Report": () => creditNoteReport(state, range, money, displayDate),
    "Tax Report": () => taxReport(state, range, money, displayDate, ae),
    "Salesperson Performance": () => salespersonPerformanceReport(state, range, money, employees),
    "Customer Sales Report": () => customerSalesReport(state, range, money),
  };
  const builder = builders[type];
  if (!builder) return null;
  const built = builder();
  return { type, from, to, country: config.country, currency: config.currency, ...built };
}
