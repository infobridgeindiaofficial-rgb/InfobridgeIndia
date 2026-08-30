import { icon } from "../../components/icons.js";
import { breadcrumbs } from "../../components/layout.js";
import { sectionHead, subserviceCard, flow, ctaBand, featureCard } from "../../components/ui.js";

export function hrOverviewPage() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: "HR & Payroll", href: "#" }])}
      <div class="service-hero-top" style="margin-top:18px;">
        <div>
          <span class="eyebrow">HR & Payroll</span>
          <h1 class="h-1">HR Management Software for Indian Businesses</h1>
          <p class="text-lead">Recruitment, attendance, leave and statutory payroll — with a self-service workspace for every employee and a payroll run that posts straight into accounting.</p>
        </div>
        <div class="service-icon-badge">${icon("hr")}</div>
      </div>
      <div class="grid g-4" style="margin-top:40px;">
        <div class="stat-tile"><div class="text-micro">Next payroll run</div><span class="figure" style="font-size:20px;">Aug 2026</span><span class="stat-delta up">Runs on the 28th</span></div>
        <div class="stat-tile"><div class="text-micro">Statutory coverage</div><span class="figure" style="font-size:20px;">PF · ESI · PT</span></div>
        <div class="stat-tile"><div class="text-micro">Self-service</div><span class="figure" style="font-size:20px;">Every employee</span></div>
        <div class="stat-tile"><div class="text-micro">Accounting integration</div><span class="figure" style="font-size:20px;">Automatic</span></div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${sectionHead({ eyebrow: "HR services", title: "The complete employee lifecycle" })}
      <div class="grid g-3">
        ${subserviceCard({ icon: "users", title: "Employee Database", desc: "IDs, departments, designations and branches, structured.", href: "/hr-payroll/index.html#employees" })}
        ${subserviceCard({ icon: "briefcase", title: "Recruitment", desc: "Job openings, candidates, interviews and offers.", href: "/hr-payroll/index.html" })}
        ${subserviceCard({ icon: "clock", title: "Attendance & Shifts", desc: "Check-in/out, shifts, late marks and overtime.", href: "/hr-payroll/index.html#attendance" })}
        ${subserviceCard({ icon: "calendar", title: "Leave Management", desc: "Balances, requests and manager approvals.", href: "/hr-payroll/index.html#leave" })}
        ${subserviceCard({ icon: "payroll", title: "Payroll", desc: "Salary structures, statutory deductions, payslips.", href: "/hr/payroll.html", status: { tone: "brand", label: "Runs on the 28th" } })}
        ${subserviceCard({ icon: "star", title: "Performance", desc: "KPIs, appraisals, increments and promotions.", href: "/hr-payroll/index.html" })}
        ${subserviceCard({ icon: "wallet", title: "Employee Expenses & Advances", desc: "Claims, travel and loans, tracked against payroll.", href: "/hr-payroll/index.html" })}
        ${subserviceCard({ icon: "documents", title: "Documents & Onboarding", desc: "Offer letters, IDs and onboarding checklists.", href: "/hr-payroll/index.html" })}
        ${subserviceCard({ icon: "logout", title: "Exit & Full and Final Settlement", desc: "Notice period, clearance and final settlement.", href: "/hr-payroll/index.html" })}
      </div>
    </div>
  </section>

  <section class="section" style="background:var(--surface-0); border-top:1px solid var(--border); border-bottom:1px solid var(--border);">
    <div class="container">
      ${sectionHead({ eyebrow: "Employee self-service", title: "Employees don't need to ask HR for everything" })}
      <div class="grid g-4">
        ${featureCard({ icon: "clock", title: "Attendance", desc: "Check attendance history and request corrections." })}
        ${featureCard({ icon: "calendar", title: "Leave", desc: "Apply for leave and see balances instantly." })}
        ${featureCard({ icon: "payroll", title: "Payslips", desc: "Every payslip, available the moment payroll runs." })}
        ${featureCard({ icon: "wallet", title: "Expense claims", desc: "Submit and track claims without a paper form." })}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${ctaBand({
        title: "Run payroll the way it should work",
        desc: "Open the dedicated Payroll workspace and see the period-to-payslip flow.",
        primary: { href: "/hr-payroll/index.html#payroll", label: "Open Payroll workspace" },
        secondary: { href: "/index.html", label: "Back to main page" },
      })}
    </div>
  </section>
  `;
  return { route: "/hr.html", title: "HR & Payroll", description: "Recruitment, attendance, leave and statutory payroll for Indian businesses.", active: "products", body };
}

export function payrollPage() {
  const body = `
  <section class="service-hero">
    <div class="container">
      ${breadcrumbs([
        { label: "Home", href: "/index.html" },
        { label: "HR & Payroll", href: "/hr.html" },
        { label: "Payroll", href: "#" },
      ])}
      <div class="service-hero-top" style="margin-top:18px;">
        <div>
          <span class="eyebrow">HR & Payroll / Payroll</span>
          <h1 class="h-1">Payroll Software for Indian Businesses</h1>
          <p class="text-lead">Select a period, calculate earnings and statutory deductions for every employee, route the run for approval, then generate payslips and the accounting entry — in one place.</p>
        </div>
        <div class="service-icon-badge">${icon("payroll")}</div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${sectionHead({ eyebrow: "The workflow", title: "Period → Employees → Calculate → Review → Approve → Payslips → Accounting" })}
      ${flow([
        { title: "Select period", desc: "Payroll month & cut-off" },
        { title: "Employees", desc: "Active roster & salary structures" },
        { title: "Calculate", desc: "Earnings, deductions, PF/ESI/PT" },
        { title: "Review", desc: "Exceptions checked line by line" },
        { title: "Approve", desc: "Sign-off by finance/HR" },
        { title: "Payslips & accounting", desc: "Issued and posted automatically" },
      ])}
    </div>
  </section>

  <section class="section" style="background:var(--surface-0); border-top:1px solid var(--border); border-bottom:1px solid var(--border);">
    <div class="container">
      <div class="grid g-3">
        ${featureCard({ icon: "ledger", title: "Posts to accounting", desc: "Salary payable, PF, ESI and TDS ledgers update the moment payroll is approved." })}
        ${featureCard({ icon: "wallet", title: "Advances & loans netted", desc: "Employee advances and loan instalments are deducted automatically." })}
        ${featureCard({ icon: "documents", title: "Payslips, instantly available", desc: "Every employee sees their payslip in self-service the moment it's issued." })}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${ctaBand({
        title: "See the live payroll workspace",
        desc: "Log in to open this month's payroll run with sample employee data.",
        primary: { href: "/signup.html", label: "Open in the app" },
        secondary: { href: "/hr.html", label: "Back to HR & Payroll" },
      })}
    </div>
  </section>
  `;
  return { route: "/hr/payroll.html", title: "Payroll — HR & Payroll", description: "The dedicated payroll calculation, approval and payslip workspace.", active: "products", body };
}
