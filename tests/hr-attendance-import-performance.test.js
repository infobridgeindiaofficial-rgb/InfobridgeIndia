import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { attendanceSummary, payrollForEmployee, workingDates } from "../src/hr-payroll/core.js";
import { ATTENDANCE_IMPORT_BATCH_SIZE, saveAttendanceImport } from "../src/hr-payroll/attendance-import.js";
import { attendanceImportProgressController } from "../src/hr-payroll/attendance-import-ui.js";
import { writeInChunks } from "../src/supabase/workspace-bulk.js";

function validRows(count){return Array.from({length:count},(_,index)=>{const employeeNumber=Math.floor(index/27)+1,day=index%27+1,employee={id:`E-${employeeNumber}`,employeeId:`EMP-${employeeNumber}`};return{index:index+1,valid:true,employee,raw:{employeeId:employee.employeeId,date:`2026-07-${String(day).padStart(2,"0")}`,status:"present",checkIn:"09:00",checkOut:"17:00",breakHours:0,overtimeHours:0,remarks:""},facts:{hours:8,lateMinutes:0,earlyMinutes:0,overtimeHours:0,weeklyOffWork:false}}})}

function memoryStore(){const collections=new Map(),operations=[];const rows=name=>{if(!collections.has(name))collections.set(name,new Map());return collections.get(name)};return{operations,async putMany(name,values,options){return writeInChunks(values,async chunk=>{operations.push({type:"bulk",name,count:chunk.length});for(const value of chunk)rows(name).set(value.id,value)},{...options})},async put(name,value){operations.push({type:"put",name,count:1});rows(name).set(value.id,value);return value},all:name=>[...rows(name).values()]}}

for(const count of[1,90,2430])test(`${count} valid attendance rows persist in conservative batches without duplicates`,async()=>{
  const store=memoryStore(),progress=[];
  const result=await saveAttendanceImport({store,valid:validRows(count),fileName:"attendance.xlsx",createId:prefix=>`${prefix}-1`,onProgress:(saved,total)=>progress.push([saved,total])});
  assert.equal(result.saved,count);
  assert.equal(store.all("attendance").length,count);
  assert.equal(store.operations.filter(item=>item.type==="bulk"&&item.name==="attendance").length,Math.ceil(count/ATTENDANCE_IMPORT_BATCH_SIZE));
  assert.deepEqual(progress.at(-1),[count,count]);
  await saveAttendanceImport({store,valid:validRows(count),fileName:"attendance.xlsx",createId:prefix=>`${prefix}-retry`});
  assert.equal(store.all("attendance").length,count);
});

test("2430 rows require five attendance upserts plus one import metadata write",async()=>{
  const store=memoryStore();await saveAttendanceImport({store,valid:validRows(2430),fileName:"attendance.xlsx",createId:prefix=>`${prefix}-1`});
  assert.equal(store.operations.filter(item=>item.type==="bulk"&&item.name==="attendance").length,5);
  assert.equal(store.operations.filter(item=>item.type==="put"&&item.name==="attendanceImports").length,1);
});

test("a failed batch reports its row range and saved count and retry stays idempotent",async()=>{
  const values=validRows(1200),saved=new Map(),attempts=[];
  const store={async putMany(name,rows,options){return writeInChunks(rows,async(chunk,info)=>{attempts.push(info.batchNumber);if(info.batchNumber===2&&attempts.filter(x=>x===2).length===1)throw Error("network unavailable");for(const row of chunk)saved.set(row.id,row)},options)},async put(){}};
  await assert.rejects(()=>saveAttendanceImport({store,valid:values,fileName:"attendance.xlsx",createId:p=>`${p}-1`}),error=>error.saved===500&&error.batchNumber===2&&error.startRow===501&&error.endRow===1000);
  await saveAttendanceImport({store,valid:values,fileName:"attendance.xlsx",createId:p=>`${p}-2`});
  assert.equal(saved.size,1200);
});

test("persisted imported attendance refreshes summaries and remains payroll-readable",async()=>{
  const store=memoryStore(),employee={id:"E-1",employeeId:"EMP-1",firstName:"Test",lastName:"Employee",basicSalary:27000,allowances:0,deductions:0,overtimeRate:0,weeklyOffDays:["Sunday"]};
  await saveAttendanceImport({store,valid:validRows(27),fileName:"attendance.xlsx",createId:p=>`${p}-1`});
  const attendance=store.all("attendance"),inputs={attendance,from:"2026-07-01",to:"2026-07-31"};
  assert.equal(attendanceSummary(employee,inputs).presentDays,23);
  assert.equal(attendanceSummary(employee,inputs).workedHours,216);
  assert.equal(payrollForEmployee(employee,inputs).presentDays,23);
});

test("payroll resolves imported attendance by stable Employee ID after internal record IDs change",async()=>{
  const employee={id:"NEW-INTERNAL-ID",employeeId:"EMP-008",firstName:"Eight",lastName:"Employee",basicSalary:27000,weeklyOffDays:["Friday"]},dates=workingDates("2026-07-01","2026-07-31",employee),attendance=dates.map(date=>({id:`ATT-EMP-008-${date}`,employeeId:"OLD-INTERNAL-ID",employeeCode:"EMP-008",date,status:"present",hours:8,overtimeHours:0}));
  const summary=attendanceSummary(employee,{attendance,from:"2026-07-01",to:"2026-07-31"});
  assert.equal(summary.workingDays,26);assert.equal(summary.presentDays,26);assert.equal(summary.missingDays,0);
});

test("rendered attendance save control disables, persists, and updates all 2430 rows without a null element",async()=>{
  const button={disabled:false,textContent:"Save attendance"},progress={textContent:""},form={querySelector:selector=>selector==="[data-modal-submit]"?button:selector==="[data-attendance-import-progress]"?progress:null},controls=attendanceImportProgressController(form,2430),store=memoryStore();
  controls.start();
  assert.equal(button.disabled,true);
  assert.equal(button.textContent,"Saving attendance... 0 / 2430");
  const result=await saveAttendanceImport({store,valid:validRows(2430),fileName:"attendance.xlsx",createId:p=>`${p}-ui`,onProgress:saved=>controls.update(saved)});
  assert.equal(result.saved,2430);
  assert.deepEqual(store.operations.filter(item=>item.type==="bulk"&&item.name==="attendance").map(item=>item.count),[500,500,500,500,430]);
  assert.equal(button.textContent,"Saving attendance... 2430 / 2430");
});

test("attendance import button and error state recover after persistence failure",()=>{
  const button={disabled:false,textContent:"Save attendance"},progress={textContent:""},form={querySelector:selector=>selector==="[data-modal-submit]"?button:progress},controls=attendanceImportProgressController(form,2430),error=Error("network unavailable");
  controls.start();controls.update(500);controls.fail(error,500);
  assert.equal(button.disabled,false);
  assert.equal(button.textContent,"Retry attendance import");
  assert.match(progress.textContent,/failed after 500 \/ 2430 rows.*network unavailable/);
});

test("attendance import modal renders an explicit stable submit control",()=>{
  const source=readFileSync(new URL("../src/hr-payroll/app.js",import.meta.url),"utf8");
  assert.match(source,/<button type="submit" class="btn primary" data-modal-submit>/);
  assert.match(source,/attendanceImportProgressController\(form,valid\.length\)/);
  assert.match(source,/attendance records imported successfully\./);
  assert.doesNotMatch(source,/for\(const r of valid\)await put\("attendance"/);
});
