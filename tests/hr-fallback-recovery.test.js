import test from "node:test";
import assert from "node:assert/strict";
import { recoverLegacyHrFallback } from "../src/hr-payroll/fallback-recovery.js";

const storeFor=(database,companyId)=>({
  user:{id:"USER-1"},company:{id:companyId},
  async all(collection){return[...(database.get(`${companyId}:${collection}`)||[])]},
  async putMany(collection,rows){const key=`${companyId}:${collection}`,current=new Map((database.get(key)||[]).map(row=>[row.id,row]));for(const row of rows)current.set(row.id,row);database.set(key,[...current.values()])}
});

test("legacy company-scoped fallback employees and related HR records migrate to cloud once",async()=>{
  const database=new Map(),cloud=storeFor(database,"COMPANY-A"),localData={employees:[{id:"E1"},{id:"E2"}],attendance:[{id:"A1",employeeId:"E1"}],leaveTransactions:[{id:"L1",employeeId:"E2"}],payrollRuns:[{id:"P1"}],payslips:[{id:"S1",employeeId:"E1"}]};
  const collections=["employees","attendance","leaveTransactions","payrollRuns","payslips"];
  const first=await recoverLegacyHrFallback({cloudStore:cloud,localData,collections});
  assert.equal(first.recovered,true);assert.equal(first.cloudCounts.employees,0);assert.equal(first.localCounts.employees,2);assert.equal(first.finalCounts.employees,2);
  for(const collection of collections)assert.deepEqual(await cloud.all(collection),localData[collection]);
  const second=await recoverLegacyHrFallback({cloudStore:cloud,localData,collections});
  assert.equal(second.recovered,false);assert.equal((await cloud.all("employees")).length,2);
});

test("empty browser state can never replace existing cloud HR records",async()=>{
  const database=new Map([["COMPANY-A:employees",[{id:"E1"},{id:"E2"}]],["COMPANY-A:attendance",[{id:"A1"}]]]),cloud=storeFor(database,"COMPANY-A");
  const result=await recoverLegacyHrFallback({cloudStore:cloud,localData:{},collections:["employees","attendance"]});
  assert.equal(result.recovered,false);assert.equal(result.finalCounts.employees,2);assert.equal((await cloud.all("attendance")).length,1);
});

test("legacy fallback recovery cannot cross company scope",async()=>{
  const database=new Map([["COMPANY-B:employees",[{id:"OTHER"}]]]),companyA=storeFor(database,"COMPANY-A");
  await recoverLegacyHrFallback({cloudStore:companyA,localData:{employees:[{id:"A1"}]},collections:["employees"]});
  assert.deepEqual(await companyA.all("employees"),[{id:"A1"}]);
  assert.deepEqual(database.get("COMPANY-B:employees"),[{id:"OTHER"}]);
});
