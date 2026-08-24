export const ATTENDANCE_IMPORT_BATCH_SIZE=500;

export function attendanceImportRecordId(employeeId,date){return`ATT-${String(employeeId).trim().toUpperCase()}-${String(date)}`}

export function prepareAttendanceImportRecords(valid,importId,createdAt=new Date().toISOString()){
  return valid.map(row=>({...row.raw,...row.facts,id:attendanceImportRecordId(row.employee.employeeId,row.raw.date),employeeId:row.employee.id,employeeCode:row.employee.employeeId,source:"csv",importId,confirmed:true,createdAt}));
}

export async function saveAttendanceImport({store,valid,bad=[],fileName,createId,onProgress=()=>{}}){
  if(!valid.length)throw Error("There are no valid rows to confirm");
  const importId=createId("IMP"),createdAt=new Date().toISOString(),attendance=prepareAttendanceImportRecords(valid,importId,createdAt);
  let attendanceResult={saved:0,batches:0};
  try{
    attendanceResult=await store.putMany("attendance",attendance,{batchSize:ATTENDANCE_IMPORT_BATCH_SIZE,onProgress});
    const corrections=bad.map(row=>({id:createId("ERR"),importId,row:row.index,raw:row.raw,errors:row.errors,status:"unresolved"}));
    if(corrections.length)await store.putMany("attendanceCorrections",corrections,{batchSize:ATTENDANCE_IMPORT_BATCH_SIZE});
    await store.put("attendanceImports",{id:importId,fileName,total:valid.length+bad.length,confirmed:valid.length,blocked:bad.length,createdAt});
    return{...attendanceResult,importId,attendance,corrections};
  }catch(error){if(error.saved==null)error.saved=attendanceResult.saved;throw error}
}
