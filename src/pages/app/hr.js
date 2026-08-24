import { appPage, breadcrumbs } from "../../components/layout.js";
import { statTile, banner, table, stepTrack, tabs, subserviceCard, statusBadge } from "../../components/ui.js";
import { icon } from "../../components/icons.js";

const crumbHome = { label: "Home", href: "/index.html" };
const crumbHr = { label: "HR & Payroll", href: "/hr-payroll/index.html" };

export function hrIndexPage() {
  const header = `
    <div class="app-content-header">
      <div>
        ${breadcrumbs([crumbHome, { label: "HR & Payroll", href: "#" }])}
        <h1 style="margin-top:10px;">HR & Payroll</h1>
        <p class="text-small" style="margin-top:6px;">42 active employees across 2 branches.</p>
      </div>
      <div class="app-content-actions">
        <a class="btn btn-secondary" href="#">Add employee</a>
      </div>
    </div>
  `;

  const body = `
    <div style="margin-bottom:24px;">
      ${banner({ tone: "info", title: "Payroll for August 2026 runs on 28 Aug.", body: " 42 employees, estimated cost ₹18,40,000." })}
    </div>
    <div class="grid g-4" style="margin-bottom:28px;">
      ${statTile({ label: "Active employees", value: "42" })}
      ${statTile({ label: "On leave today", value: "3" })}
      ${statTile({ label: "Open positions", value: "2" })}
      ${statTile({ label: "Pending leave approvals", value: "4" })}
    </div>
    <div class="grid g-3">
      ${subserviceCard({ icon: "payroll", title: "Payroll", desc: "Runs on 28 Aug for 42 employees.", href: "/hr-payroll/index.html#payroll", status: { tone: "brand", label: "Upcoming" } })}
      ${subserviceCard({ icon: "clock", title: "Attendance & Shifts", desc: "Check-in/out, late marks and overtime.", href: "/hr-payroll/index.html#attendance" })}
      ${subserviceCard({ icon: "calendar", title: "Leave Management", desc: "4 requests waiting for approval.", href: "/hr-payroll/index.html#leave", status: { tone: "warning", label: "4 pending" } })}
      ${subserviceCard({ icon: "briefcase", title: "Recruitment", desc: "2 open positions, 9 candidates in pipeline.", href: "/hr-payroll/index.html" })}
      ${subserviceCard({ icon: "star", title: "Performance", desc: "Q2 appraisal cycle in progress.", href: "/hr-payroll/index.html" })}
      ${subserviceCard({ icon: "wallet", title: "Expenses & Advances", desc: "3 claims awaiting reimbursement.", href: "/hr-payroll/index.html" })}
    </div>
  `;
  return appPage({ title: "HR & Payroll", description: "HR overview.", currentHref: "/app/hr/index.html", header, body });
}

function employeeTable() {
  return table({
    toolbar: true,
    pagination: true,
    columns: [
      { key: "name", label: "Employee", render: (r) => `<span class="cell-primary">${r.name}</span><div class="cell-sub">${r.id} · ${r.dept}</div>` },
      { key: "gross", label: "Gross pay", num: true, render: (r) => `<span class="mono">₹${r.gross}</span>` },
      { key: "ded", label: "Deductions", num: true, render: (r) => `<span class="mono">₹${r.ded}</span>` },
      { key: "net", label: "Net pay", num: true, render: (r) => `<span class="mono cell-primary">₹${r.net}</span>` },
      { key: "status", label: "Status", render: (r) => statusBadge(r.status, r.tone) },
    ],
    rows: [
      { name: "Priya Sharma", id: "EMP-014", dept: "Finance", gross: "68,000", ded: "9,840", net: "58,160", status: "Ready", tone: "success" },
      { name: "Rohit Mehta", id: "EMP-022", dept: "Sales", gross: "62,000", ded: "8,940", net: "53,060", status: "Ready", tone: "success" },
      { name: "Ananya Iyer", id: "EMP-041", dept: "Operations", gross: "44,000", ded: "6,120", net: "37,880", status: "Advance deducted", tone: "info" },
      { name: "Vikram Nair", id: "EMP-009", dept: "Warehouse", gross: "38,000", ded: "5,280", net: "32,720", status: "Exception: LOP", tone: "warning" },
    ],
  });
}

function statutoryTable() {
  return table({
    toolbar: false,
    pagination: false,
    columns: [
      { key: "head", label: "Statutory head", render: (r) => `<span class="cell-primary">${r.head}</span>` },
      { key: "employee", label: "Employee contribution", num: true, render: (r) => `<span class="mono">₹${r.employee}</span>` },
      { key: "employer", label: "Employer contribution", num: true, render: (r) => `<span class="mono">₹${r.employer}</span>` },
    ],
    rows: [
      { head: "Provident Fund (PF)", employee: "1,08,400", employer: "1,08,400" },
      { head: "ESI", employee: "14,200", employer: "42,600" },
      { head: "Professional Tax", employee: "8,400", employer: "—" },
      { head: "Salary TDS", employee: "62,100", employer: "—" },
    ],
  });
}

function exceptionsPanel() {
  return `<div class="stack-3">
    ${banner({ tone: "warning", title: "1 employee has a loss-of-pay exception this period.", body: " Vikram Nair — 2 unapproved absences." })}
    ${table({
      toolbar: false,
      pagination: false,
      columns: [
        { key: "name", label: "Employee", render: (r) => `<span class="cell-primary">${r.name}</span>` },
        { key: "issue", label: "Exception" },
        { key: "action", label: "", render: () => `<a class="btn btn-secondary btn-sm" href="#">Review</a>` },
      ],
      rows: [{ name: "Vikram Nair", issue: "2 days loss-of-pay, unapproved absence" }],
    })}
  </div>`;
}

export function payrollWorkspacePage() {
  const header = `
    <div class="app-content-header">
      <div>
        ${breadcrumbs([crumbHome, crumbHr, { label: "Payroll", href: "#" }])}
        <h1 style="margin-top:10px;">Payroll — August 2026</h1>
        <p class="text-small" style="margin-top:6px;">42 employees · pay period 1–31 Aug 2026.</p>
      </div>
      <div class="app-content-actions">
        <span class="badge badge-info" style="align-self:center;">Calculated · awaiting approval</span>
        <a class="btn btn-secondary" href="#">Recalculate</a>
        <a class="btn btn-primary" href="#">Approve & process</a>
      </div>
    </div>
  `;

  const body = `
    <div class="card" style="margin-bottom:28px;">
      ${stepTrack(["Period", "Employees", "Calculate", "Review", "Approve", "Payslips & accounting"], 3)}
    </div>

    <div class="grid g-4" style="margin-bottom:28px;">
      ${statTile({ label: "Employees in this run", value: "42" })}
      ${statTile({ label: "Gross payroll", value: "₹24,86,000" })}
      ${statTile({ label: "Statutory deductions", value: "₹1,93,100" })}
      ${statTile({ label: "Net payable", value: "₹22,92,900" })}
    </div>

    ${tabs(
      [
        { id: "employees", label: "Employees (42)" },
        { id: "statutory", label: "Statutory breakup" },
        { id: "exceptions", label: "Exceptions (1)" },
      ],
      [employeeTable(), statutoryTable(), exceptionsPanel()]
    )}
  `;

  return appPage({ title: "Payroll", description: "Payroll workspace.", currentHref: "/app/hr/payroll.html", header, body });
}
