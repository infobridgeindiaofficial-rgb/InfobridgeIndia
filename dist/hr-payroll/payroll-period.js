import { monthPeriod } from "./core.js";

export function canonicalPayrollPeriod(period){return{period:String(period||""),...monthPeriod(period)}}

export function repairDraftPayrollRun(run,{employees,attendance,leaves=[],adjustments=[],settings={},calculate}){
  if(run.status!=="draft")return{changed:false,run};
  const canonical=canonicalPayrollPeriod(run.period);
  if(run.from===canonical.from&&run.to===canonical.to)return{changed:false,run};
  const items=employees.filter(employee=>employee.active!==false).map(employee=>calculate(employee,{attendance,leaves,adjustments,settings,from:canonical.from,to:canonical.to}));
  return{changed:true,run:{...run,...canonical,items,employeeCount:items.length,totalNet:items.reduce((sum,item)=>sum+item.net,0),periodRepairedAt:new Date().toISOString(),recalculatedAt:new Date().toISOString()}};
}

export function payrollIssueSummary(items,limit=8){
  const affected=items.map(item=>({employee:item.employeeCode||item.name||item.employeeId||"Employee",issues:item.issues||[]})).filter(item=>item.issues.length);
  if(!affected.length)return"";
  const shown=affected.slice(0,limit).map(item=>`${item.employee}: ${item.issues.join(", ")}`),remaining=affected.length-shown.length;
  return`${shown.join("; ")}${remaining?`; and ${remaining} more employee${remaining===1?"":"s"}`:""}`;
}

export function payrollAttendanceIssues(items=[]){return items.filter(item=>Number(item.missingDays)>0).map(item=>({employeeId:item.employeeCode||item.employeeId,employee:item.name||"Employee",expectedWorkingDays:Number(item.workingDays||0),recordedDays:Math.max(0,Number(item.workingDays||0)-Number(item.missingDays||0)),missingDays:Number(item.missingDays||0)}))}
