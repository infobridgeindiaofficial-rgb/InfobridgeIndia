const LOCKED_PAYROLL_STATUSES=new Set(["approved","locked","finalised","finalized"]);

function runRange(run){if(run?.from&&run?.to)return{from:run.from,to:run.to};if(!/^\d{4}-\d{2}$/.test(run?.period||""))return{};const[year,month]=run.period.split("-").map(Number),last=new Date(Date.UTC(year,month,0)).getUTCDate();return{from:`${run.period}-01`,to:`${run.period}-${String(last).padStart(2,"0")}`}}
const overlaps=(leave,run)=>{const{from,to}=runRange(run);return Boolean(leave?.from&&leave?.to&&from&&to&&leave.from<=to&&leave.to>=from)};

export function lockedPayrollForLeave(leave,runs=[],employee){
  if(!leave||leave.status!=="approved")return null;
  const identities=new Set([leave.employeeId,leave.employeeCode,employee?.id,employee?.employeeId].filter(Boolean).map(String));
  return runs.find(run=>LOCKED_PAYROLL_STATUSES.has(String(run.status).toLowerCase())&&overlaps(leave,run)&&(run.items||[]).some(item=>[item.employeeId,item.employeeCode].filter(Boolean).some(value=>identities.has(String(value)))))||null;
}
