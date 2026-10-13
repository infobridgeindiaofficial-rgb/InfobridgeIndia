const monthOf=value=>String(value||"").slice(0,7);

export function reportMonthLabel(period){
  if(!/^\d{4}-\d{2}$/.test(period))return period||"";
  const[year,month]=period.split("-").map(Number);
  return new Intl.DateTimeFormat("en",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1)));
}

function leaveDaysInMonth(leave,period){
  if(Array.isArray(leave.dates)&&leave.dates.length)return leave.dates.filter(day=>monthOf(day)===period).length;
  if(!leave.from||!leave.to)return monthOf(leave.from)===period?Number(leave.days||0):0;
  const start=new Date(`${leave.from}T00:00:00Z`),end=new Date(`${leave.to}T00:00:00Z`);
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<start)return 0;
  let count=0;
  for(let day=start;day<=end;day=new Date(day.getTime()+86400000))if(monthOf(day.toISOString())===period)count++;
  return count;
}

export function summarizeHrReport({period,employees=[],departments=[],attendance=[],payrollRuns=[],leaveTypes=[],leaveTransactions=[]}){
  const active=employees.filter(employee=>employee.active!==false);
  const monthAttendance=attendance.filter(record=>monthOf(record.date)===period);
  const approvedPayroll=payrollRuns.filter(run=>run.status==="approved"&&monthOf(run.period||run.from)===period).reduce((sum,run)=>sum+Number(run.totalNet||0),0);
  const approvedLeave=leaveTransactions.filter(leave=>leave.status==="approved");
  return{
    period,periodLabel:reportMonthLabel(period),headcount:active.length,
    presentDays:monthAttendance.filter(record=>record.status==="present").length,
    absentDays:monthAttendance.filter(record=>record.status==="absent").length,
    approvedPayroll,
    departments:departments.map(department=>({department:department.name,count:active.filter(employee=>employee.departmentId===department.id).length})),
    leaves:leaveTypes.map(type=>({type:type.name,taken:approvedLeave.filter(leave=>leave.leaveTypeId===type.id).reduce((sum,leave)=>sum+leaveDaysInMonth(leave,period),0)}))
  };
}

const csvCell=value=>`"${String(value??"").replaceAll('"','""')}"`;
export function reportCsv(summary,{companyName="",currency=""}={}){
  const rows=[["Report Month",summary.periodLabel],["Period",summary.period],["Company",companyName],["Headcount",summary.headcount],["Present Days",summary.presentDays],["Absent Days",summary.absentDays],["Approved Payroll",summary.approvedPayroll],["Currency",currency],[],["Department","Employees"],...summary.departments.map(row=>[row.department,row.count]),[],["Leave Type","Days Taken"],...summary.leaves.map(row=>[row.type,row.taken])];
  return rows.map(row=>row.map(csvCell).join(",")).join("\n");
}
