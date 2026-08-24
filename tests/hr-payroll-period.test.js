import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { payrollForEmployee, workingDates } from "../src/hr-payroll/core.js";
import { canonicalPayrollPeriod, payrollAttendanceIssues, payrollIssueSummary, repairDraftPayrollRun } from "../src/hr-payroll/payroll-period.js";

test("monthly payroll periods use exact calendar boundaries without timezone shifts",()=>{
  assert.deepEqual(canonicalPayrollPeriod("2026-07"),{period:"2026-07",from:"2026-07-01",to:"2026-07-31"});
  assert.deepEqual(canonicalPayrollPeriod("2026-08"),{period:"2026-08",from:"2026-08-01",to:"2026-08-31"});
  assert.deepEqual(canonicalPayrollPeriod("2026-09"),{period:"2026-09",from:"2026-09-01",to:"2026-09-30"});
  assert.deepEqual(canonicalPayrollPeriod("2026-02"),{period:"2026-02",from:"2026-02-01",to:"2026-02-28"});
  assert.deepEqual(canonicalPayrollPeriod("2028-02"),{period:"2028-02",from:"2028-02-01",to:"2028-02-29"});
});

test("existing wrong July draft is repaired and recalculated from all 2430 July attendance rows",()=>{
  const employees=Array.from({length:90},(_,index)=>({id:`E-${index+1}`,employeeId:`EMP-${String(index+1).padStart(3,"0")}`,firstName:"Employee",lastName:String(index+1),basicSalary:3000,allowances:0,deductions:0,overtimeRate:0,active:true,weeklyOffType:"one",weeklyOffDays:["Sunday"]}));
  const julyDates=workingDates("2026-07-01","2026-07-31",employees[0]);
  assert.equal(julyDates.length,27);
  const attendance=employees.flatMap(employee=>julyDates.map(date=>({id:`ATT-${employee.id}-${date}`,employeeId:employee.id,date,status:"present",hours:8,overtimeHours:0})));
  assert.equal(attendance.length,2430);
  const draft={id:"PAY-JULY",period:"2026-07",from:"2026-08-01",to:"2026-08-30",status:"draft",items:[]},result=repairDraftPayrollRun(draft,{employees,attendance,calculate:payrollForEmployee});
  assert.equal(result.changed,true);
  assert.equal(result.run.from,"2026-07-01");
  assert.equal(result.run.to,"2026-07-31");
  assert.equal(result.run.employeeCount,90);
  assert.equal(result.run.items.every(item=>item.presentDays===27&&item.missingDays===0),true);
  assert.equal(payrollIssueSummary(result.run.items),"");
});

test("approved historical payroll periods are never repaired automatically",()=>{
  const approved={id:"PAY-OLD",period:"2026-07",from:"2026-08-01",to:"2026-08-30",status:"approved",items:[{employeeCode:"EMP-001",issues:[]}]},result=repairDraftPayrollRun(approved,{employees:[],attendance:[],calculate:payrollForEmployee});
  assert.equal(result.changed,false);
  assert.equal(result.run,approved);
});

test("missing attendance errors are concise and employee-specific",()=>{
  const items=Array.from({length:90},(_,index)=>({employeeCode:`EMP-${String(index+1).padStart(3,"0")}`,issues:["25 attendance day(s) missing"]})),summary=payrollIssueSummary(items);
  assert.match(summary,/EMP-001: 25 attendance day\(s\) missing/);
  assert.match(summary,/and 82 more employees/);
  assert.equal((summary.match(/attendance day/g)||[]).length,8);
});

test("attendance issue rows contain expected recorded and missing day counts",()=>{
  assert.deepEqual(payrollAttendanceIssues([{employeeCode:"EMP-008",name:"Employee 8",workingDays:27,missingDays:14}]),[{employeeId:"EMP-008",employee:"Employee 8",expectedWorkingDays:27,recordedDays:13,missingDays:14}]);
});

test("draft payroll exposes View Recalculate Delete Draft and Approve actions",()=>{
  const source=readFileSync(new URL("../src/hr-payroll/app.js",import.meta.url),"utf8");
  for(const text of ["View","Recalculate","Delete Draft","Approve"])assert.match(source,new RegExp(`>${text}<`));
  assert.match(source,/data-view-attendance-issues/);
  assert.match(source,/Attendance is incomplete for \$\{attendanceIssues\.length\} employees/);
});

test("payroll UI derives readonly dates from the selected month and repairs drafts on startup",()=>{
  const source=readFileSync(new URL("../src/hr-payroll/app.js",import.meta.url),"utf8");
  assert.match(source,/canonicalPayrollPeriod\(v\.period\)/);
  assert.match(source,/field\("from","From date","date",initial\.from,"readonly"\)/);
  assert.match(source,/periodInput\.addEventListener\("change"/);
  assert.match(source,/await repairStoredDraftPayrollPeriods\(\)/);
});
