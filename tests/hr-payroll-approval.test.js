import test from "node:test";
import assert from "node:assert/strict";
import { approvePayrollAndGeneratePayslips, payslipRecordId } from "../src/hr-payroll/payroll-approval.js";

const run={id:"PAY-JULY",period:"2026-07",from:"2026-07-01",to:"2026-07-31",status:"draft",items:Array.from({length:90},(_,index)=>({employeeId:`E${index+1}`,employeeCode:`EMP-${index+1}`,name:`Employee ${index+1}`,net:4000}))};
const memoryStore=(seed={})=>{const data=new Map(Object.entries(seed).map(([name,rows])=>[name,new Map(rows.map(row=>[row.id,structuredClone(row)]))]));const map=name=>{if(!data.has(name))data.set(name,new Map());return data.get(name)};return{data,async all(name){return[...map(name).values()].map(row=>structuredClone(row))},async get(name,id){return structuredClone(map(name).get(id)||null)},async put(name,row){map(name).set(row.id,structuredClone(row));return row},async putMany(name,rows){for(const row of rows)map(name).set(row.id,structuredClone(row));return{saved:rows.length}},async remove(name,id){map(name).delete(id)}}};

test("existing July draft generates exactly 90 stable payslips before it is approved",async()=>{
  const store=memoryStore({payrollRuns:[run]}),snapshot={legalName:"Company LLC",logo:"data:image/png;base64,LOGO",trn:"100123456700003"};
  await approvePayrollAndGeneratePayslips({store,run,companyName:"Company",companyProfileSnapshot:snapshot,approvedAt:"2026-08-01T00:00:00.000Z"});
  const payslips=await store.all("payslips"),approved=await store.get("payrollRuns",run.id);
  assert.equal(payslips.length,90);assert.equal(new Set(payslips.map(item=>item.id)).size,90);assert.equal(payslips[0].id,payslipRecordId("2026-07","E1"));
  assert.equal(approved.status,"approved");assert.equal(approved.payslipCount,90);assert.deepEqual(approved.companyProfileSnapshot,snapshot);
  assert.equal("companyProfileSnapshot" in payslips[0],false,"large company/logo snapshot is stored once on the approved run");
  const reload=memoryStore({payrollRuns:await store.all("payrollRuns"),payslips});
  assert.equal((await reload.all("payslips")).length,90);assert.equal((await reload.get("payrollRuns",run.id)).status,"approved");
});

test("retry is idempotent and replaces legacy partial IDs without duplicate payslips",async()=>{
  const legacy={...run.items[0],id:`${run.id}:E1`,runId:run.id,period:run.period},store=memoryStore({payrollRuns:[run],payslips:[legacy]});
  await approvePayrollAndGeneratePayslips({store,run,companyName:"Company",companyProfileSnapshot:{}});
  const rows=await store.all("payslips");assert.equal(rows.length,90);assert.equal(rows.some(row=>row.id===legacy.id),false);
});

test("failed payslip persistence leaves the payroll draft for a safe retry",async()=>{
  const store=memoryStore({payrollRuns:[run]});store.putMany=async()=>{throw Error("Supabase payslip upsert failed")};
  await assert.rejects(()=>approvePayrollAndGeneratePayslips({store,run,companyName:"Company",companyProfileSnapshot:{}}),/upsert failed/);
  assert.equal((await store.get("payrollRuns",run.id)).status,"draft");assert.equal((await store.all("payslips")).length,0);
});
