import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { attendanceFacts, attendanceSummary, monthPeriod, payrollForEmployee, periodCalendar, validateAttendance, validateWeeklyOff, weeklyOffConfig, workingDates } from "../src/hr-payroll/core.js";

const employee=(number=1)=>({id:`E-${number}`,employeeId:`EMP-00${number}`,firstName:`Employee`,lastName:String(number),basicSalary:30000,allowances:2000,deductions:500,overtimeRate:100,active:true});

test("manual and imported attendance share validation and duplicate detection",()=>{
  const emp=employee(),settings={standardHours:8,shiftStart:"09:30",shiftEnd:"18:00"};
  const raw={employeeId:emp.employeeId,date:"2026-08-03",status:"present",checkIn:"09:30",checkOut:"19:30",breakHours:1,overtimeHours:2};
  const first=validateAttendance(raw,{employees:[emp],settings});
  assert.equal(first.valid,true);
  assert.deepEqual(first.facts,{hours:9,lateMinutes:0,earlyMinutes:0,overtimeHours:2,weeklyOffWork:false});
  const duplicate=validateAttendance(raw,{employees:[emp],settings,batch:[{employeeId:emp.id,date:raw.date}]});
  assert.equal(duplicate.valid,false);
  assert.match(duplicate.errors.join(" "),/Duplicate attendance/);
});

test("attendance summary connects present, paid leave, LOP, worked hours and overtime",()=>{
  const emp=employee(),attendance=[
    {employeeId:emp.id,date:"2026-08-03",status:"present",hours:8,overtimeHours:0},
    {employeeId:emp.id,date:"2026-08-04",status:"present",hours:8,overtimeHours:2},
    {employeeId:emp.id,date:"2026-08-05",status:"remote",hours:8,overtimeHours:0},
    {employeeId:emp.id,date:"2026-08-06",status:"absent",hours:0,overtimeHours:0}
  ],leaves=[{employeeId:emp.id,from:"2026-08-07",to:"2026-08-07",status:"approved",paid:true}];
  assert.deepEqual(attendanceSummary(emp,{attendance,leaves,from:"2026-08-03",to:"2026-08-07"}),{calendarDays:5,weeklyOffDays:0,workingDays:5,presentDays:3,paidLeaveDays:1,unpaidLeaveDays:0,leaveBreakdown:{Leave:1},lopDays:1,weeklyOffWorkedDays:0,missingDays:0,workedHours:24,overtimeHours:2,payableDays:4,weeklyOffConfig:{type:"one",days:["Sunday"]}});
  const pay=payrollForEmployee(emp,{attendance,leaves,from:"2026-08-03",to:"2026-08-07"});
  assert.equal(pay.earnedBasic,30000);
  assert.equal(pay.lopDeduction,6000);
  assert.equal(pay.otPay,200);
  assert.equal(pay.net,25700);
  assert.deepEqual(pay.issues,[]);
});

test("payroll blocks missing attendance and salary information for all four employees",()=>{
  const employees=[1,2,3,4].map(employee),dates=workingDates("2026-08-03","2026-08-07"),attendance=employees.flatMap(emp=>dates.map(day=>({employeeId:emp.id,date:day,status:"present",hours:8,overtimeHours:0})));
  assert.equal(employees.map(emp=>payrollForEmployee(emp,{attendance,from:"2026-08-03",to:"2026-08-07"})).every(item=>item.issues.length===0),true);
  const incomplete=payrollForEmployee({...employees[0],basicSalary:0},{attendance:attendance.filter(row=>row.date!==dates[0]),from:"2026-08-03",to:"2026-08-07"});
  assert.match(incomplete.issues.join(" "),/attendance day.*missing/i);
  assert.match(incomplete.issues.join(" "),/Basic salary is missing/);
});

test("manual attendance has one inline range workflow and skips employee weekly offs",()=>{
  assert.deepEqual(workingDates("2026-08-07","2026-08-10",{weeklyOffDays:["Friday","Saturday"]}),["2026-08-09","2026-08-10"]);
  const source=readFileSync(new URL("../src/hr-payroll/app.js",import.meta.url),"utf8");
  assert.match(source,/id="attendance-manual-form"/);
  assert.match(source,/>Save attendance</);
  assert.match(source,/Weekly-off days skipped/);
  assert.match(source,/field\("attendanceMonth","Attendance month","month"/);
  assert.match(source,/attendancePeriod=\{month:event\.target\.value\};render\(\)/);
  assert.doesNotMatch(source,/>Record attendance</);
  assert.doesNotMatch(source,/data-apply-attendance|attendanceYear|function openAttendance/);
});

test("selected attendance month always resolves to the complete calendar month",()=>{
  assert.deepEqual(monthPeriod("2026-01"),{from:"2026-01-01",to:"2026-01-31"});
  assert.deepEqual(monthPeriod("2026-04"),{from:"2026-04-01",to:"2026-04-30"});
  assert.deepEqual(monthPeriod("2026-02"),{from:"2026-02-01",to:"2026-02-28"});
  assert.deepEqual(monthPeriod("2028-02"),{from:"2028-02-01",to:"2028-02-29"});
});

test("31-day months count four or five actual configured weekly offs",()=>{
  const sunday={...employee(),weeklyOffType:"one",weeklyOffDays:["Sunday"]};
  assert.deepEqual(attendanceSummary(sunday,{...monthPeriod("2026-01")}),expectCalendar(31,4,27));
  assert.deepEqual(attendanceSummary(sunday,{...monthPeriod("2026-08")}),expectCalendar(31,5,26));
});

test("30-day and February calendars calculate exact working days",()=>{
  const sunday={...employee(),weeklyOffType:"one",weeklyOffDays:["Sunday"]};
  assert.deepEqual(attendanceSummary(sunday,{...monthPeriod("2026-04")}),expectCalendar(30,4,26));
  assert.deepEqual(attendanceSummary(sunday,{...monthPeriod("2026-02")}),expectCalendar(28,4,24));
  assert.deepEqual(attendanceSummary(sunday,{...monthPeriod("2028-02")}),expectCalendar(29,4,25));
});

function expectCalendar(calendarDays,weeklyOffDays,workingDays){return{calendarDays,weeklyOffDays,workingDays,presentDays:0,paidLeaveDays:0,unpaidLeaveDays:0,leaveBreakdown:{},lopDays:0,weeklyOffWorkedDays:0,missingDays:workingDays,workedHours:0,overtimeHours:0,payableDays:0,weeklyOffConfig:{type:"one",days:["Sunday"]}}}

test("employees use independent Friday, Sunday, or two-day weekly-off calendars",()=>{
  const friday={...employee(1),weeklyOffType:"one",weeklyOffDays:["Friday"]};
  const sunday={...employee(2),weeklyOffType:"one",weeklyOffDays:["Sunday"]};
  const weekend={...employee(3),weeklyOffType:"two",weeklyOffDays:["Saturday","Sunday"]};
  const period=monthPeriod("2026-08");
  assert.equal(attendanceSummary(friday,{...period}).weeklyOffDays,4);
  assert.equal(attendanceSummary(sunday,{...period}).weeklyOffDays,5);
  assert.equal(attendanceSummary(weekend,{...period}).weeklyOffDays,10);
  assert.equal(attendanceSummary(weekend,{...period}).workingDays,21);
});

test("weekly offs are not LOP and worked hours only sum selected-month records",()=>{
  const emp={...employee(),weeklyOffType:"one",weeklyOffDays:["Sunday"]};
  const attendance=[
    {employeeId:emp.id,date:"2026-07-31",status:"present",hours:10,overtimeHours:3},
    {employeeId:emp.id,date:"2026-08-02",status:"week-off",hours:0,overtimeHours:0},
    {employeeId:emp.id,date:"2026-08-03",status:"present",hours:7.5,overtimeHours:1},
    {employeeId:emp.id,date:"2026-09-01",status:"present",hours:9,overtimeHours:2}
  ];
  const august=attendanceSummary(emp,{attendance,...monthPeriod("2026-08")});
  const september=attendanceSummary(emp,{attendance,...monthPeriod("2026-09")});
  assert.equal(august.lopDays,0);
  assert.equal(august.workedHours,7.5);
  assert.equal(august.overtimeHours,1);
  assert.equal(september.workedHours,9);
  assert.equal(september.overtimeHours,2);
});

test("attendance calculations do not mutate existing employee records",()=>{
  const emp={...employee(),weeklyOffType:"two",weeklyOffDays:["Friday","Saturday"],customFields:'{"legacy":true}'};
  const before=structuredClone(emp);
  attendanceSummary(emp,{...monthPeriod("2026-08")});
  assert.deepEqual(emp,before);
});

test("weekly-off types validate exact day counts and legacy employees use company fallback",()=>{
  assert.equal(validateWeeklyOff("one",["Friday"]).valid,true);
  assert.equal(validateWeeklyOff("one",["Friday","Saturday"]).valid,false);
  assert.equal(validateWeeklyOff("two",["Friday","Saturday"]).valid,true);
  assert.equal(validateWeeklyOff("two",["Sunday"]).valid,false);
  assert.equal(validateWeeklyOff("custom",["Monday","Wednesday","Friday"]).valid,true);
  assert.deepEqual(weeklyOffConfig({}, {weeklyOff:"Friday, Saturday"}),{type:"two",days:["Friday","Saturday"]});
});

test("employee schedules handle Friday-Saturday, Friday-only, Sunday-only and four or five occurrences",()=>{
  const manager={...employee(1),weeklyOffType:"two",weeklyOffDays:["Friday","Saturday"]};
  const office={...employee(2),weeklyOffType:"two",weeklyOffDays:["Friday","Saturday"]};
  const sales={...employee(3),weeklyOffType:"one",weeklyOffDays:["Friday"]};
  const labour={...employee(4),weeklyOffType:"one",weeklyOffDays:["Sunday"]};
  assert.equal(periodCalendar("2026-02-01","2026-02-28",manager).weeklyOffDates.length,8);
  assert.equal(periodCalendar("2026-02-01","2026-02-28",office).weeklyOffDates.length,8);
  assert.equal(periodCalendar("2026-02-01","2026-02-28",sales).weeklyOffDates.length,4);
  assert.equal(periodCalendar("2026-08-01","2026-08-31",labour).weeklyOffDates.length,5);
});

test("full-month attendance omits weekly offs, keeps paid leave, and preserves weekly-off work",()=>{
  const emp={...employee(),weeklyOffType:"one",weeklyOffDays:["Sunday"]};
  const period=periodCalendar("2026-08-01","2026-08-31",emp);
  const leaveDay=period.workingDates[2],weeklyWork=period.weeklyOffDates[0];
  const attendance=period.workingDates.filter(day=>day!==leaveDay).map(day=>({employeeId:emp.id,date:day,status:"present",hours:8,overtimeHours:0}));
  attendance.push({employeeId:emp.id,date:weeklyWork,status:"present",hours:8,overtimeHours:2});
  const leaves=[{employeeId:emp.id,from:leaveDay,to:leaveDay,status:"approved",paid:true}];
  const summary=attendanceSummary(emp,{attendance,leaves,from:"2026-08-01",to:"2026-08-31"});
  assert.equal(summary.calendarDays,31);
  assert.equal(summary.weeklyOffDays,5);
  assert.equal(summary.workingDays,26);
  assert.equal(summary.presentDays,25);
  assert.equal(summary.paidLeaveDays,1);
  assert.equal(summary.weeklyOffWorkedDays,1);
  assert.equal(summary.missingDays,0);
  const imported=validateAttendance({employeeId:emp.employeeId,date:weeklyWork,status:"present",checkIn:"09:30",checkOut:"18:30",breakHours:1,overtimeHours:2},{employees:[emp]});
  assert.equal(imported.valid,true);
  assert.equal(imported.facts.weeklyOffWork,true);
  assert.match(imported.warnings.join(" "),/Weekly-off work/);
});

test("weekly-off snapshots change future drafts without mutating approved payroll history",()=>{
  const emp={...employee(),weeklyOffType:"one",weeklyOffDays:["Sunday"]};
  const period={from:"2026-08-01",to:"2026-08-31"};
  const attendance=workingDates(period.from,period.to,emp).map(date=>({employeeId:emp.id,date,status:"present",hours:8,overtimeHours:0}));
  const approved=structuredClone(payrollForEmployee(emp,{attendance,...period}));
  const changed={...emp,weeklyOffType:"two",weeklyOffDays:["Friday","Saturday"]};
  const draft=payrollForEmployee(changed,{attendance,...period});
  assert.deepEqual(approved.weeklyOffSnapshot,{type:"one",days:["Sunday"]});
  assert.deepEqual(draft.weeklyOffSnapshot,{type:"two",days:["Friday","Saturday"]});
  assert.notEqual(draft.workingDays,approved.workingDays);
  assert.deepEqual(approved.weeklyOffSnapshot,{type:"one",days:["Sunday"]});
});

test("holiday and week-off statuses are payable coverage without worked hours",()=>{
  const emp=employee(),attendance=[
    {employeeId:emp.id,date:"2026-08-03",status:"holiday",hours:0,overtimeHours:0},
    {employeeId:emp.id,date:"2026-08-04",status:"week-off",hours:0,overtimeHours:0}
  ];
  const summary=attendanceSummary(emp,{attendance,from:"2026-08-03",to:"2026-08-04"});
  assert.equal(summary.paidLeaveDays,2);
  assert.equal(summary.payableDays,2);
  assert.equal(summary.missingDays,0);
});
