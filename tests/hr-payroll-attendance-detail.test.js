import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { attendanceMonthDetail, attendanceSummary, validateAttendance } from "../src/hr-payroll/core.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const app = read("../src/hr-payroll/app.js");
const attendanceImportSource = read("../src/hr-payroll/attendance-import.js");

const employee = (number = 1) => ({ id: `E-${number}`, employeeId: `EMP-00${number}`, firstName: "Employee", lastName: String(number), basicSalary: 30000, active: true });

// ---- 1: every employee name is dynamically clickable (data-driven by e.id, not hardcoded) ----

test("the Employee Attendance Summary makes every employee name a clickable action bound to that employee's own id", () => {
  const summaryFn = app.slice(app.indexOf("function attendanceWorkflow()"), app.indexOf("function payrollWorkflow()"));
  assert.match(summaryFn, /employee:`<button type="button" class="text-button" data-open-employee-attendance="\$\{e\.id\}">\$\{esc\(`\$\{e\.firstName\} \$\{e\.lastName\}`\)\}<\/button>`/);
  assert.doesNotMatch(summaryFn, /data-open-employee-attendance="(EMP|E-1|Omar|Aisha)/i, "must never be hard-coded to one employee");
});

test("the old separate Confirmed Attendance table below the summary has been removed", () => {
  const summaryFn = app.slice(app.indexOf("function attendanceWorkflow()"), app.indexOf("function payrollWorkflow()"));
  assert.doesNotMatch(summaryFn, /Confirmed attendance/i);
});

// ---- 2, 3, 10: clicking opens the correct employee for the currently selected month,
// never today's month, never a hard-coded one ----

test("showEmployeeAttendanceDetail resolves the employee by the clicked id and the month from the page's own selected Attendance period", () => {
  const fn = app.slice(app.indexOf("function showEmployeeAttendanceDetail"), app.indexOf("function showAttendanceDayEditor"));
  assert.match(fn, /const employee=emp\(employeeId\);if\(!employee\)return;/);
  assert.match(fn, /const p=activeAttendancePeriod\(\),rows=attendanceMonthDetail\(employee,\{attendance:state\.attendance,leaves:state\.leaveTransactions,settings:state\.settings\[0\],from:p\.from,to:p\.to\}\)/);
  assert.doesNotMatch(fn, /\bmonth\(\)/, "must use the page's selected period, not today's month");
  assert.match(app, /button\.onclick=\(\)=>showEmployeeAttendanceDetail\(button\.dataset\.openEmployeeAttendance\)/);
});

// ---- 4, 5, 6, 7: the complete calendar month is generated, every date matched against
// attendance, Weekly Off and Paid Leave are never "Missing" ----

test("attendanceMonthDetail returns every calendar date of the month, not only dates with a record", () => {
  const emp = employee();
  const rows = attendanceMonthDetail(emp, { attendance: [], leaves: [], from: "2026-01-01", to: "2026-01-31" });
  assert.equal(rows.length, 31);
  assert.deepEqual(rows.map((r) => r.date).slice(0, 3), ["2026-01-01", "2026-01-02", "2026-01-03"]);
  assert.equal(rows.at(-1).date, "2026-01-31");
});

test("a working date with no attendance record and no leave is Missing -- never auto-converted to Absent", () => {
  const emp = employee();
  const rows = attendanceMonthDetail(emp, { attendance: [], leaves: [], from: "2026-01-01", to: "2026-01-31" });
  const missing = rows.filter((r) => !r.isWeeklyOff);
  assert.ok(missing.length > 0);
  assert.ok(missing.every((r) => r.status === "missing"));
  assert.ok(!missing.some((r) => r.status === "absent"));
});

test("Weekly Off dates are never Missing, even with no attendance record", () => {
  const emp = employee();
  const rows = attendanceMonthDetail(emp, { attendance: [], leaves: [], from: "2026-01-01", to: "2026-01-31" });
  const weeklyOff = rows.filter((r) => r.isWeeklyOff);
  assert.ok(weeklyOff.length > 0);
  assert.ok(weeklyOff.every((r) => r.status === "week-off"));
});

test("a date covered by approved Paid Leave is Paid Leave, never Missing", () => {
  const emp = employee();
  const leaves = [{ employeeId: emp.id, status: "approved", from: "2026-01-06", to: "2026-01-06", paid: true }];
  const rows = attendanceMonthDetail(emp, { attendance: [], leaves, from: "2026-01-01", to: "2026-01-31" });
  const row = rows.find((r) => r.date === "2026-01-06");
  assert.equal(row.status, "paid-leave");
});

test("an existing attendance record on a date is shown as-is, with its actual check-in/check-out/hours", () => {
  const emp = employee();
  const attendance = [{ id: "ATT-1", employeeId: emp.id, date: "2026-01-07", status: "absent", checkIn: "", checkOut: "" }];
  const rows = attendanceMonthDetail(emp, { attendance, leaves: [], from: "2026-01-01", to: "2026-01-31" });
  const row = rows.find((r) => r.date === "2026-01-07");
  assert.equal(row.status, "absent");
  assert.equal(row.recordId, "ATT-1");
});

// ---- 8, 9: manual correction can create a Missing day and edit an existing (wrong) day,
// reusing the existing validateAttendance / duplicate-prevention path, no second attendance
// system introduced ----

test("the day editor excludes the record being edited from the duplicate check, so saving over an existing day never fails as its own duplicate", () => {
  const fn = app.slice(app.indexOf("function showAttendanceDayEditor"), app.indexOf("function bindAttendancePayroll()"));
  assert.match(fn, /others=state\.attendance\.filter\(\(a=>a\.id!==existing\?\.id\)\)/);
  assert.match(fn, /validateAttendance\(raw,\{employees:state\.employees,attendance:others,leaves:state\.leaveTransactions,settings:state\.settings\[0\]\}\)/);
});

test("saving reuses the existing record's id when one exists, and only mints a new id otherwise -- update in place, never a duplicate row", () => {
  const fn = app.slice(app.indexOf("function showAttendanceDayEditor"), app.indexOf("function bindAttendancePayroll()"));
  assert.match(fn, /id:existing\?\.id\|\|uid\("ATT"\)/);
  assert.match(fn, /createdAt:existing\?\.createdAt\|\|\(new Date\)\.toISOString\(\)/);
  assert.match(fn, /await put\("attendance",record\)/);
});

test("validateAttendance itself rejects a genuine duplicate against a different record for the same employee and date", () => {
  const emp = employee();
  const raw = { employeeId: emp.employeeId, date: "2026-01-07", status: "present", checkIn: "09:30", checkOut: "18:00", breakHours: 1 };
  const result = validateAttendance(raw, { employees: [emp], attendance: [{ employeeId: emp.id, date: "2026-01-07" }] });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Duplicate attendance/);
});

// ---- 11, 12, 13, 14: after a correction, the summary recalculates via the same, already
// trusted attendanceSummary -- Present/Paid Leave counts and Worked/OT hours all update ----

test("saving triggers the existing recalculation + re-render path (recalculateDraftPayrolls, then the modal helper's own load+render), no page reload required", () => {
  const fn = app.slice(app.indexOf("function showAttendanceDayEditor"), app.indexOf("function bindAttendancePayroll()"));
  assert.match(fn, /await recalculateDraftPayrolls\(\);/);
  assert.doesNotMatch(fn, /location\.reload/);
});

test("turning a Missing working day into Present raises the Present count and leaves Paid Leave unchanged", () => {
  const emp = employee();
  const before = attendanceSummary(emp, { attendance: [], leaves: [], from: "2026-01-05", to: "2026-01-05" });
  assert.equal(before.presentDays, 0);
  const after = attendanceSummary(emp, { attendance: [{ employeeId: emp.id, date: "2026-01-05", status: "present", hours: 8, overtimeHours: 1 }], leaves: [], from: "2026-01-05", to: "2026-01-05" });
  assert.equal(after.presentDays, 1);
  assert.equal(after.paidLeaveDays, 0);
  assert.equal(after.workedHours, 8);
  assert.equal(after.overtimeHours, 1);
});

test("recording that same day as Paid Leave instead leaves Present unchanged and raises Paid Leave", () => {
  const emp = employee();
  const asLeave = attendanceSummary(emp, { attendance: [{ employeeId: emp.id, date: "2026-01-05", status: "paid-leave" }], leaves: [], from: "2026-01-05", to: "2026-01-05" });
  assert.equal(asLeave.presentDays, 0);
  assert.equal(asLeave.paidLeaveDays, 1);
});

test("correcting Absent to Present with real check-in/check-out recalculates worked hours from attendanceFacts, not a stale value", () => {
  const emp = employee();
  const corrected = attendanceSummary(emp, { attendance: [{ employeeId: emp.id, date: "2026-01-10", status: "present", checkIn: "09:00", checkOut: "18:00", hours: 8, overtimeHours: 0 }], leaves: [], from: "2026-01-10", to: "2026-01-10" });
  assert.equal(corrected.presentDays, 1);
  assert.equal(corrected.lopDays, 0);
  assert.equal(corrected.workedHours, 8);
});

// ---- 9 (issue calculation): 27 expected working dates with Weekly Off correctly excluded ----

test("Attendance Issues (missingDays) only ever counts expected working dates, excluding Weekly Off, and Paid Leave is not missing", () => {
  const emp = employee();
  const summary = attendanceSummary(emp, { attendance: [], leaves: [{ employeeId: emp.id, status: "approved", from: "2026-01-01", to: "2026-01-10", paid: true }], from: "2026-01-01", to: "2026-01-31" });
  assert.equal(summary.calendarDays, 31);
  assert.ok(summary.workingDays < summary.calendarDays, "weekly-off days must be excluded from working days");
  assert.ok(summary.paidLeaveDays > 0, "the approved leave days must be counted as paid leave, not missing");
  assert.equal(summary.missingDays, summary.workingDays - summary.paidLeaveDays, "missing must only be expected working dates minus valid paid-leave/present/LOP coverage");
});

// ---- 15: company isolation -- this feature only uses the existing company-scoped store,
// never a direct/bypassing data access path ----

test("the new attendance detail/edit code only ever reads and writes through the existing company-scoped store (all/put), never a separate data path", () => {
  const detailAndEditor = app.slice(app.indexOf("function showEmployeeAttendanceDetail"), app.indexOf("function bindAttendancePayroll()"));
  assert.doesNotMatch(detailAndEditor, /\.from\(["']workspace_records["']\)|createClient\(|supabase\.rpc\(/);
  assert.match(detailAndEditor, /await put\("attendance",record\)/);
});

// ---- 16: existing Excel import path is untouched ----

// ---- Employee Master keeps one Open action per employee, but employee profile and
// attendance remain separate entry points. ----

test("the Employee Master table shows only one dynamic Open action per employee -- View, Edit and Deactivate buttons are gone from this table", () => {
  const employeesFn = app.slice(app.indexOf("function employees()"), app.indexOf("function employees()") + 2500);
  assert.match(employeesFn, /action:`<button class="text-button" data-edit-employee="\$\{e\.id\}">Open<\/button>`/);
  assert.doesNotMatch(employeesFn, /data-open-employee-attendance="\$\{e\.id\}"|data-view-employee="\$\{e\.id\}"|data-toggle-employee="\$\{e\.id\}"/);
});

test("Employee Master Open uses the existing employee profile editor and never opens attendance", () => {
  const employeesFn = app.slice(app.indexOf("function employees()"), app.indexOf("function employees()") + 2500);
  assert.match(employeesFn, /data-edit-employee="\$\{e\.id\}"/);
  assert.doesNotMatch(employeesFn, /data-open-employee-attendance="\$\{e\.id\}"/);
  assert.match(app, /data-edit-employee\]"\)\.forEach\(\(b=>b\.onclick=\(\)=>openEmployee\(b\.dataset\.editEmployee,"IN",false,false\)\)\)/);
});

test("Attendance keeps its own employee action inside the Attendance workflow", () => {
  const attendanceFn = app.slice(app.indexOf("function attendanceWorkflow()"), app.indexOf("function payrollWorkflow()"));
  assert.match(attendanceFn, /data-open-employee-attendance="\$\{e\.id\}"/);
  assert.match(app, /button\.onclick=\(\)=>showEmployeeAttendanceDetail\(button\.dataset\.openEmployeeAttendance\)/);
});

test("the existing country-aware employee profile exposes UAE master fields and updates the same employee record", () => {
  const formFn = app.slice(app.indexOf("function employeeForm"), app.indexOf("function openEmployee"));
  const openFn = app.slice(app.indexOf("function openEmployee"), app.indexOf("function downloadEmployeeTemplate"));
  for (const field of ["employeeId","firstName","lastName","email","phone","dateOfBirth","gender","nationality","departmentId","designation","joiningDate","employmentType","workLocation","employmentStatus","basicSalary","housingAllowance","transportAllowance","otherAllowances","emiratesId","workPermitNumber","visaNumber","visaExpiry","workPermitExpiry","salaryPaymentMethod","bankName","accountHolderName","bankAccount","iban"]) {
    assert.match(formFn, new RegExp(`(?:field|select)\\(\\"${field}\\"`), `${field} must remain available in the employee profile`);
  }
  assert.match(openFn, /prepareEmployeeRecord\(old,/);
  assert.match(openFn, /Employee Profile/);
  assert.match(openFn, /record\.active=v\.employmentStatus!=="inactive"/);
  assert.match(openFn, /await put\("employees",/);
  assert.match(openFn, /if\(recalculate\)await recalculateDraftPayrolls\(\)/);
  assert.doesNotMatch(openFn, /put\("attendance"|put\("leaveTransactions"/);
});

test("Add Employee is untouched and still uses the existing employee edit modal (openEmployee) -- only per-row View/Edit/Deactivate were removed", () => {
  assert.match(app, /data-add-employee\]"\)\.forEach\(\(b=>b\.onclick=\(\)=>openEmployee\(/);
  assert.match(app, /function openEmployee/);
});

test("the attendance sheet shows Employee ID, Employee name, Department, Designation and a selectable month, generated from the clicked employee's own data", () => {
  const fn = app.slice(app.indexOf("function showEmployeeAttendanceDetail"), app.indexOf("function showAttendanceDayEditor"));
  assert.match(fn, /<strong>Employee ID:<\/strong> \$\{esc\(employee\.employeeId\)\}/);
  assert.match(fn, /<strong>Employee:<\/strong> \$\{esc\(`\$\{employee\.firstName\} \$\{employee\.lastName\}`\)\}/);
  assert.match(fn, /<strong>Department:<\/strong> \$\{esc\(departmentName\)\}/);
  assert.match(fn, /<strong>Designation:<\/strong> \$\{esc\(employee\.designation\|\|"—"\)\}/);
  assert.match(fn, /<input class="input" type="month" data-attendance-sheet-month value="\$\{esc\(p\.month\)\}">/);
});

test("changing the month on the attendance sheet re-opens it for the same employee with the newly selected month", () => {
  const fn = app.slice(app.indexOf("function showEmployeeAttendanceDetail"), app.indexOf("function showAttendanceDayEditor"));
  assert.match(fn, /attendancePeriod=\{month:event\.target\.value\};showEmployeeAttendanceDetail\(employeeId\)/);
  assert.match(fn, /if\(!\/\^\\d\{4\}-\\d\{2\}\$\/\.test\(event\.target\.value\)\)return;/, "an invalid/partial month value while typing must not attempt to reload");
});

// ---- UI/usability correction: larger attendance sheet modal, Employee ID search instead
// of a giant dropdown for CASE A, and CASE B (Missing -> Add) stays fully preselected with
// no employee search at all. No calculation/payroll logic is touched by any of this. ----

const styles = read("../src/hr-payroll/styles.css");

test("the attendance sheet modal uses a wider 'xl' size, distinct from and larger than the existing 'wide' modals", () => {
  assert.match(app, /modal\(`\$\{esc\(`\$\{employee\.firstName\} \$\{employee\.lastName\}`\)\} — \$\{reportMonthLabel\(p\.month\)\} Attendance`,body,\(\(\)=>false\),"xl","Close"\)/);
  assert.match(app, /class="modal \$\{wide==="xl"\?"wide xl":wide\?"wide":""\}"/);
  assert.match(styles, /\.modal\.xl\{width:min\(1200px,96vw\)\}/);
  assert.match(styles, /\.modal\.wide\{width:min\(820px,100%\)\}/);
});

test("the modal body still scrolls internally and never grows unbounded beyond the viewport", () => {
  assert.match(styles, /\.modal\{[^}]*max-height:92vh/);
  assert.match(styles, /\.modal-body\{[^}]*overflow:auto/);
});

test("CASE A: the main Attendance page's manual entry form uses an Employee ID search field, not a <select> listing every employee", () => {
  const formSection = app.slice(app.indexOf('<form id="attendance-manual-form">'), app.indexOf('<form id="attendance-manual-form">') + 400);
  assert.match(formSection, /\$\{employeeIdSearchField\(\)\}/);
  assert.doesNotMatch(formSection, /select\("employeeId"/);
});

test("the Employee ID search field has no preloaded option list, searches by id first, then name, and caps results to 10", () => {
  const fn = app.slice(app.indexOf("function employeeSearchMatches"), app.indexOf("function bindEmployeeIdSearch"));
  assert.match(fn, /state\.employees\.filter\(\(e=>e\.active!==false\)\)/, "must search only active employees");
  assert.match(fn, /String\(e\.employeeId\|\|""\)\.toLowerCase\(\)\.startsWith\(q\)/, "employee id is the primary/priority match");
  assert.match(fn, /\.slice\(0,10\)/, "results must be capped to a small number");
  const field = app.slice(app.indexOf("function employeeIdSearchField"), app.indexOf("function employeeIdSearchField") + 600);
  assert.doesNotMatch(field, /<select/);
});

test("Employee ID search results can only ever come from state.employees, which is already scoped to the current company -- no cross-company access path exists", () => {
  const fn = app.slice(app.indexOf("function employeeSearchMatches"), app.indexOf("function bindEmployeeIdSearch"));
  assert.match(fn, /state\.employees\.filter/);
  assert.doesNotMatch(fn, /company_id|companyId|\.from\(["']workspace_records["']\)/, "must not bypass the already company-scoped state.employees with a separate query");
});

test("selecting an Employee ID search result fills the hidden employeeId field the submit handler already reads, and shows department/designation confirmation", () => {
  const fn = app.slice(app.indexOf("function bindEmployeeIdSearch"), app.indexOf("function bindAttendancePayroll()"));
  assert.match(fn, /hidden\.value=employee\.id;input\.value=`\$\{employee\.employeeId\} — \$\{employee\.firstName\} \$\{employee\.lastName\}`/);
  assert.match(fn, /selected\.textContent=`\$\{dept\(employee\.departmentId\)\?\.name\|\|employee\.departmentName\|\|"—"\} · \$\{employee\.designation\|\|"—"\}`/);
});

test("submitting the manual form with no Employee ID selected is rejected with a clear message before anything is saved", () => {
  const submitHandler = app.slice(app.indexOf('addEventListener("submit",(async event=>{event.preventDefault();try{const values=Object.fromEntries(new FormData(event.target)),from=values.attendanceFrom'), app.indexOf('addEventListener("submit",(async event=>{event.preventDefault();try{const values=Object.fromEntries(new FormData(event.target)),from=values.attendanceFrom') + 500);
  assert.match(submitHandler, /if\(!values\.employeeId\)throw Error\("Search and select an Employee ID"\);/);
  const guardPos = submitHandler.indexOf('if(!values.employeeId)');
  const putPos = app.indexOf('for(const record of prepared)await put("attendance",record)');
  assert.ok(guardPos !== -1 && putPos !== -1 && (app.indexOf(submitHandler) + guardPos) < putPos, "the guard must run before any record is prepared/saved");
});

test("CASE B (opened from Missing -> Add on the employee monthly sheet) never shows an employee search or dropdown -- Employee and Date are already fixed", () => {
  const fn = app.slice(app.indexOf("function showAttendanceDayEditor"), app.indexOf("function employeeIdSearchField"));
  assert.doesNotMatch(fn, /data-employee-search|<select[^>]*employeeId|employeeIdSearchField/);
  assert.match(fn, /const employee=emp\(employeeId\);if\(!employee\)return;/);
  assert.match(fn, /raw=\{employeeId:employee\.id,date,/, "employee and date come from the closure, never from a form field the user fills in");
});

test("CASE B still recalculates the summary and clears Missing back to the corrected status via the same existing path", () => {
  const rows = attendanceMonthDetail(employee(2), { attendance: [{ id: "A1", employeeId: "E-2", date: "2026-01-02", status: "present", checkIn: "09:00", checkOut: "18:00", hours: 8 }], leaves: [], from: "2026-01-01", to: "2026-01-31" });
  const jan2 = rows.find((r) => r.date === "2026-01-02");
  assert.equal(jan2.status, "present");
  assert.notEqual(jan2.status, "missing");
});

test("the Excel attendance import pathway is unmodified by this feature", () => {
  assert.match(attendanceImportSource, /export function attendanceImportRecordId/);
  assert.match(attendanceImportSource, /export async function saveAttendanceImport/);
  assert.match(app, /\$\("\[data-attendance-template\]"\)\?\.addEventListener\("click",downloadAttendanceTemplate\)/);
  assert.match(app, /\$\("#attendance-quick-file"\)\?\.addEventListener\("change",importAttendance\)/);
});
