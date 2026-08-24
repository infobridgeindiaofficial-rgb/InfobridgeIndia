import { appPage, breadcrumbs } from "../../components/layout.js";
import { statTile, banner, table, stepTrack, tabs, subserviceCard, statusBadge } from "../../components/ui.js";
import { icon } from "../../components/icons.js";

const crumbHome = { label: "Home", href: "/index.html" };
const crumbGst = { label: "GST & Tax", href: "/app/gst/index.html" };

export function gstIndexPage() {
  const header = `
    <div class="app-content-header">
      <div>
        ${breadcrumbs([crumbHome, { label: "GST & Tax", href: "#" }])}
        <h1 style="margin-top:10px;">GST & Tax</h1>
        <p class="text-small" style="margin-top:6px; max-width:640px;">Returns, reconciliation and compliance for GSTIN 27ABCDE1234F1Z5.</p>
      </div>
      <div class="app-content-actions">
        <a class="btn btn-secondary" href="#">Compliance calendar</a>
      </div>
    </div>
  `;

  const body = `
    <div style="margin-bottom:24px;">
      ${banner({ tone: "warning", title: "GSTR-1 for August 2026 is due in 6 days (11 Sep).", body: " 1,360 invoices ready, 3 need review." })}
    </div>
    <div class="grid g-4" style="margin-bottom:28px;">
      ${statTile({ label: "Outward tax liability (MTD)", value: "₹1,64,300" })}
      ${statTile({ label: "Input tax credit available", value: "₹82,900" })}
      ${statTile({ label: "GSTR-2B mismatches", value: "12" })}
      ${statTile({ label: "Filing status", value: "2 pending" })}
    </div>
    <div class="grid g-3">
      ${subserviceCard({ icon: "gst", title: "GSTR-1", desc: "Outward supplies for August 2026.", href: "/app/gst/gstr-1.html", status: { tone: "warning", label: "Draft · due in 6 days" } })}
      ${subserviceCard({ icon: "gst", title: "GSTR-3B", desc: "Summary return for July 2026.", href: "/app/gst/index.html", status: { tone: "success", label: "Filed" } })}
      ${subserviceCard({ icon: "checkCircle", title: "GSTR-2B Reconciliation", desc: "Match ITC against vendor filings.", href: "/app/gst/index.html", status: { tone: "info", label: "12 mismatches" } })}
      ${subserviceCard({ icon: "reports", title: "HSN / SAC Summary", desc: "Rate-wise summary for the period.", href: "/app/gst/index.html" })}
      ${subserviceCard({ icon: "file", title: "E-Invoice & IRN", desc: "IRN generated for eligible invoices.", href: "/app/gst/index.html" })}
      ${subserviceCard({ icon: "truck", title: "E-Way Bill", desc: "Movement documents for shipments.", href: "/app/gst/index.html" })}
    </div>
  `;

  return appPage({ title: "GST & Tax", description: "GST returns and compliance.", currentHref: "/app/gst/index.html", header, body });
}

function b2bTable() {
  return table({
    toolbar: true,
    pagination: true,
    columns: [
      { key: "inv", label: "Invoice", render: (r) => `<span class="cell-primary">${r.inv}</span><div class="cell-sub">${r.date}</div>` },
      { key: "gstin", label: "Recipient GSTIN", render: (r) => `<span class="mono">${r.gstin}</span>` },
      { key: "party", label: "Recipient" },
      { key: "taxable", label: "Taxable value", num: true, render: (r) => `<span class="mono">₹${r.taxable}</span>` },
      { key: "tax", label: "Tax", num: true, render: (r) => `<span class="mono">₹${r.tax}</span>` },
      { key: "status", label: "Status", render: (r) => statusBadge(r.status, r.tone) },
    ],
    rows: [
      { inv: "INV-2431", date: "17 Aug 2026", gstin: "24AACPK1234B1Z8", party: "Kavya Textiles", taxable: "1,75,920", tax: "8,280", status: "Valid", tone: "success" },
      { inv: "INV-2428", date: "14 Aug 2026", gstin: "27AASFV5432L1ZR", party: "Vantage Exports", taxable: "3,26,600", tax: "16,300", status: "Valid", tone: "success" },
      { inv: "INV-2420", date: "9 Aug 2026", gstin: "27AAAAA0000A1Z5", party: "Orbit Retail Pvt Ltd", taxable: "59,500", tax: "3,000", status: "HSN missing", tone: "danger" },
      { inv: "INV-2417", date: "6 Aug 2026", gstin: "29AABCU9603R1ZM", party: "Nimbus Traders", taxable: "1,05,000", tax: "5,000", status: "Valid", tone: "success" },
    ],
  });
}

function b2cTable() {
  return table({
    toolbar: true,
    pagination: true,
    columns: [
      { key: "type", label: "Type" },
      { key: "state", label: "Place of supply" },
      { key: "invoices", label: "Invoices", num: true },
      { key: "taxable", label: "Taxable value", num: true, render: (r) => `<span class="mono">₹${r.taxable}</span>` },
      { key: "tax", label: "Tax", num: true, render: (r) => `<span class="mono">₹${r.tax}</span>` },
    ],
    rows: [
      { type: "B2C (Large)", state: "Maharashtra", invoices: 14, taxable: "4,20,800", tax: "21,040" },
      { type: "B2C (Small)", state: "Maharashtra", invoices: 612, taxable: "6,10,200", tax: "30,510" },
      { type: "B2C (Small)", state: "Gujarat", invoices: 422, taxable: "3,88,400", tax: "19,420" },
    ],
  });
}

function notesTable() {
  return table({
    toolbar: false,
    pagination: false,
    columns: [
      { key: "doc", label: "Document", render: (r) => `<span class="cell-primary">${r.doc}</span>` },
      { key: "against", label: "Against invoice" },
      { key: "reason", label: "Reason" },
      { key: "amount", label: "Amount", num: true, render: (r) => `<span class="mono">₹${r.amount}</span>` },
    ],
    rows: [
      { doc: "CN-041", against: "INV-2390", reason: "Sales return", amount: "12,400" },
      { doc: "CN-040", against: "INV-2377", reason: "Rate difference", amount: "2,100" },
    ],
  });
}

function hsnTable() {
  return table({
    toolbar: false,
    pagination: false,
    columns: [
      { key: "hsn", label: "HSN", render: (r) => `<span class="mono cell-primary">${r.hsn}</span>` },
      { key: "desc", label: "Description" },
      { key: "qty", label: "Qty", num: true },
      { key: "taxable", label: "Taxable value", num: true, render: (r) => `<span class="mono">₹${r.taxable}</span>` },
      { key: "rate", label: "Rate", num: true },
    ],
    rows: [
      { hsn: "5208", desc: "Cotton fabric", qty: "3,420 mtr", taxable: "8,42,600", rate: "5%" },
      { hsn: "3923", desc: "Packing boxes", qty: "1,120 pcs", taxable: "1,86,400", rate: "18%" },
      { hsn: "9999", desc: "— missing on 3 invoices —", qty: "—", taxable: "59,500", rate: "—" },
    ],
  });
}

function errorsPanel() {
  return `<div class="stack-3">
    ${banner({ tone: "danger", title: "3 invoices are missing an HSN code.", body: " GSTR-1 cannot be filed until these are corrected." })}
    ${table({
      toolbar: false,
      pagination: false,
      columns: [
        { key: "inv", label: "Invoice", render: (r) => `<span class="cell-primary">${r.inv}</span>` },
        { key: "issue", label: "Issue" },
        { key: "action", label: "", render: () => `<a class="btn btn-secondary btn-sm" href="#">Fix now</a>` },
      ],
      rows: [
        { inv: "INV-2420", issue: "HSN code missing on line item 'Packing Service'" },
        { inv: "INV-2411", issue: "HSN code missing on line item 'Handling Charges'" },
        { inv: "INV-2405", issue: "GSTIN format invalid for recipient" },
      ],
    })}
  </div>`;
}

export function gstr1WorkspacePage() {
  const header = `
    <div class="app-content-header">
      <div>
        ${breadcrumbs([crumbHome, crumbGst, { label: "GSTR-1", href: "#" }])}
        <h1 style="margin-top:10px;">GSTR-1 — August 2026</h1>
        <p class="text-small" style="margin-top:6px;">1,360 outward supply invoices for GSTIN 27ABCDE1234F1Z5.</p>
      </div>
      <div class="app-content-actions">
        <span class="badge badge-warning" style="align-self:center;">Draft · due in 6 days</span>
        <a class="btn btn-secondary" href="#">Save draft</a>
        <a class="btn btn-primary" href="#">${icon("download", "").replace("<svg", '<svg width="15" height="15"')} Generate output</a>
      </div>
    </div>
  `;

  const body = `
    <div class="card" style="margin-bottom:28px;">
      ${stepTrack(["Prepare", "Validate", "Review", "Generate output"], 2)}
    </div>

    <div class="grid g-4" style="margin-bottom:28px;">
      ${statTile({ label: "Total invoices", value: "1,360" })}
      ${statTile({ label: "Taxable value", value: "₹19,53,900" })}
      ${statTile({ label: "Total tax", value: "₹97,700" })}
      ${statTile({ label: "Open errors", value: "3", delta: "Blocking filing", deltaDir: "down" })}
    </div>

    ${tabs(
      [
        { id: "b2b", label: "B2B (312)" },
        { id: "b2c", label: "B2C (1,048)" },
        { id: "notes", label: "Credit / Debit Notes (14)" },
        { id: "hsn", label: "HSN Summary" },
        { id: "errors", label: "Validation errors (3)" },
      ],
      [b2bTable(), b2cTable(), notesTable(), hsnTable(), errorsPanel()]
    )}
  `;

  return appPage({ title: "GSTR-1", description: "GSTR-1 preparation workspace.", currentHref: "/app/gst/gstr-1.html", header, body });
}
