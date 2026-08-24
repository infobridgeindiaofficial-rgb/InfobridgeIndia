export const payslipRecordId=(period,employeeId)=>`PAYSLIP:${String(period)}:${String(employeeId)}`;

export function payslipsForPayroll(run,{companyName="",generatedAt=""}={}){
  if(!run?.id||!run?.period||!Array.isArray(run.items))throw Error("A valid payroll run is required.");
  const seen=new Set();
  return run.items.map(item=>{
    if(!item?.employeeId)throw Error("Every payroll item requires a stable employee identity.");
    const id=payslipRecordId(run.period,item.employeeId);
    if(seen.has(id))throw Error(`Duplicate employee ${item.employeeId} in payroll ${run.period}.`);
    seen.add(id);
    return{...item,id,runId:run.id,period:run.period,from:run.from,to:run.to,company:companyName,generatedAt};
  });
}

export async function approvePayrollAndGeneratePayslips({store,run,companyName,companyProfileSnapshot,approvedAt=new Date().toISOString()}={}){
  if(!store?.put||!store?.all)throw Error("Payroll workspace persistence is unavailable.");
  if(run?.status!=="draft")throw Error("Only a draft payroll can be approved.");
  const records=payslipsForPayroll(run,{companyName,generatedAt:approvedAt});
  if(typeof store.putMany==="function")await store.putMany("payslips",records,{batchSize:25});
  else for(const record of records)await store.put("payslips",record);
  const persisted=await store.all("payslips"),expectedIds=new Set(records.map(record=>record.id)),persistedIds=new Set(persisted.map(record=>record.id));
  const missing=[...expectedIds].filter(id=>!persistedIds.has(id));
  if(missing.length)throw Error(`Payslip persistence verification failed: ${missing.length} of ${records.length} payslips are missing.`);
  for(const old of persisted){
    if(old.runId===run.id&&records.some(record=>record.employeeId===old.employeeId)&&!expectedIds.has(old.id))await store.remove("payslips",old.id);
  }
  const approvedRun={...run,companyName,companyProfileSnapshot,status:"approved",locked:true,approvedAt,payslipCount:records.length};
  await store.put("payrollRuns",approvedRun);
  const savedRun=await store.get?.("payrollRuns",run.id);
  if(store.get&&savedRun?.status!=="approved")throw Error("Payroll approval persistence could not be verified.");
  return{run:approvedRun,payslips:records};
}
