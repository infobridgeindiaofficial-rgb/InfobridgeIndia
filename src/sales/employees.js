const SALES_DEPARTMENTS=new Set(["sales & crm","sales","marketing","sales & marketing"]);
const normal=value=>String(value||"").trim().toLowerCase().replace(/\s+/g," ");

export function eligibleSalesEmployees(employees=[],departments=[]){
  const departmentNames=new Map(departments.map(department=>[String(department.id),department.name]));
  return employees.filter(employee=>{
    if(employee.active===false)return false;
    const name=departmentNames.get(String(employee.departmentId))||employee.departmentName||employee.department||"";
    return SALES_DEPARTMENTS.has(normal(name));
  }).sort((a,b)=>String(a.employeeId||"").localeCompare(String(b.employeeId||"")));
}

export const employeeFullName=employee=>[employee?.firstName,employee?.lastName].filter(Boolean).join(" ").trim();
export const employeeOptionLabel=employee=>[employee?.employeeId||"—",employeeFullName(employee)||"Unnamed employee",employee?.designation||"—"].join(" — ");

export async function sharedHrEmployees({store,storage,userId,companyId}){
  const cloud=await store.all("employees"),key=`infobridgeindia.hr-payroll.fallback.v1:${userId||"local"}:${companyId||"company"}`;
  let cached=[];
  try{cached=JSON.parse(storage?.getItem(key)||"{}")?.employees||[]}catch{}
  return[...new Map([...cloud,...cached].filter(employee=>employee?.id).map(employee=>[String(employee.id),employee])).values()];
}

export function assignedSalespersonName(record,employees=[]){
  const employee=employees.find(item=>String(item.id)===String(record?.assignedSalespersonId||""));
  return employeeFullName(employee)||record?.assignedSalesperson||"Unassigned";
}
