import{periodCalendar}from"./core.js";

export const STANDARD_LEAVE_TYPES=Object.freeze([
  {id:"STANDARD:vacation",name:"Vacation",paymentType:"paid",allowedDays:0,status:"active"},
  {id:"STANDARD:casual",name:"Casual Leave",paymentType:"paid",allowedDays:0,status:"active"},
  {id:"STANDARD:sick",name:"Sick Leave",paymentType:"paid",allowedDays:0,status:"active"},
  {id:"STANDARD:medical",name:"Medical Leave",paymentType:"paid",allowedDays:0,status:"active"},
  {id:"STANDARD:emergency",name:"Emergency Leave",paymentType:"paid",allowedDays:0,status:"active"},
  {id:"STANDARD:unpaid",name:"Unpaid Leave",paymentType:"unpaid",allowedDays:0,status:"active"},
  {id:"STANDARD:maternity",name:"Maternity Leave",paymentType:"paid",allowedDays:0,status:"active"},
  {id:"STANDARD:parental",name:"Paternity / Parental Leave",paymentType:"paid",allowedDays:0,status:"active"},
  {id:"STANDARD:other",name:"Other Leave",paymentType:"paid",allowedDays:0,status:"active",paymentSelectable:true},
]);

export function availableLeaveTypes(configured=[]){const configuredByName=new Map(configured.map(type=>[String(type.name).trim().toLowerCase(),type])),standardNames=new Set(STANDARD_LEAVE_TYPES.map(type=>type.name.toLowerCase()));return[...STANDARD_LEAVE_TYPES.map(type=>({...type,...configuredByName.get(type.name.toLowerCase())})),...configured.filter(type=>!standardNames.has(String(type.name).trim().toLowerCase()))]}

export const leaveTypeAllowedDays=type=>Math.max(0,Number(type?.allowedDays??type?.annualDays??0));
export const leaveTypeIsActive=type=>type?.status?type.status==="active":type?.active!==false;
export const leaveTypeIsPaid=type=>type?.paymentType?type.paymentType==="paid":type?.paid!==false;

export function leaveApplicationDays(application,employee,settings={}){
  if(!application?.from||!application?.to||application.to<application.from)return[];
  return periodCalendar(application.from,application.to,employee,settings).workingDates;
}

export function leaveUsage(type,employee,applications=[],settings={}){
  return applications.filter(item=>item.status==="approved"&&item.leaveTypeId===type.id&&(item.employeeId===employee.id||String(item.employeeId).toLowerCase()===String(employee.employeeId).toLowerCase())).reduce((sum,item)=>sum+leaveApplicationDays(item,employee,settings).length,0);
}

export function employeeLeaveBalances(employee,types=[],applications=[],settings={}){
  return types.map(type=>{const allowed=leaveTypeAllowedDays(type),used=leaveUsage(type,employee,applications,settings);return{leaveTypeId:type.id,name:type.name,paymentType:leaveTypeIsPaid(type)?"paid":"unpaid",allowed,used,available:Math.max(0,allowed-used),active:leaveTypeIsActive(type)}});
}

export function validateLeaveApplication({application,employee,type,applications=[],settings={}}){
  if(!employee)throw Error("Select an employee.");if(!type||!leaveTypeIsActive(type))throw Error("Select an active leave type.");
  const dates=leaveApplicationDays(application,employee,settings);if(!dates.length)throw Error("The selected period contains no employee working days.");
  const allowed=leaveTypeAllowedDays(type),used=leaveUsage(type,employee,applications.filter(item=>item.id!==application.id),settings);
  if(allowed>0&&used+dates.length>allowed)throw Error(`${type.name} exceeds the available balance of ${Math.max(0,allowed-used)} day(s).`);
  return{days:dates.length,dates,paid:leaveTypeIsPaid(type),leaveTypeName:type.name};
}
