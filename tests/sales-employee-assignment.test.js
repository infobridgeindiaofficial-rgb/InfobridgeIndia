import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialState, saveLead } from "../src/sales/core.js";
import { assignedSalespersonName, eligibleSalesEmployees, employeeOptionLabel, sharedHrEmployees } from "../src/sales/employees.js";

const departments=[
  {id:"DEP-SALES",name:"Sales & CRM"},
  {id:"DEP-MKT",name:"Marketing"},
  {id:"DEP-HR",name:"HR & Payroll"}
];
const employees=[
  {id:"EMP-STABLE-1",employeeId:"EMP-001",firstName:"Asha",lastName:"Sharma",designation:"Sales Manager",departmentId:"DEP-SALES",active:true},
  {id:"EMP-STABLE-2",employeeId:"EMP-002",firstName:"Nila",lastName:"Das",designation:"Marketing Executive",departmentId:"DEP-MKT",active:true},
  {id:"EMP-STABLE-3",employeeId:"EMP-003",firstName:"Hari",lastName:"Rao",designation:"HR Manager",departmentId:"DEP-HR",active:true},
  {id:"EMP-STABLE-4",employeeId:"EMP-004",firstName:"Inactive",lastName:"Seller",designation:"Salesperson",departmentId:"DEP-SALES",active:false}
];

test("Sales assignment uses only active employees in eligible shared departments",()=>{
  const eligible=eligibleSalesEmployees(employees,departments);
  assert.deepEqual(eligible.map(employee=>employee.id),["EMP-STABLE-1","EMP-STABLE-2"]);
  assert.equal(employeeOptionLabel(eligible[0]),"EMP-001 — Asha Sharma — Sales Manager");
});

test("EMP-002 is read from the current scoped HR fallback and matched case-insensitively",async()=>{
  const userId="USER-1",companyId="COMPANY-1",key=`infobridgeindia.hr-payroll.fallback.v1:${userId}:${companyId}`;
  const mani={id:"EMP-STABLE-MANI",employeeId:"EMP-002",firstName:"mani",lastName:"kandan",designation:"supervisor",departmentId:"DEP-MANI",active:true};
  const storage={getItem:name=>name===key?JSON.stringify({employees:[mani]}):null};
  const employeesFromMaster=await sharedHrEmployees({store:{all:async()=>[]},storage,userId,companyId});
  const eligible=eligibleSalesEmployees(employeesFromMaster,[{id:"DEP-MANI",name:"  sales & crm  "}]);
  assert.equal(eligible.length,1);
  assert.equal(employeeOptionLabel(eligible[0]),"EMP-002 — mani kandan — supervisor");
});

test("lead edit and reload preserve the stable HR employee ID and display name",()=>{
  const employee=employees[0],saved=saveLead(initialState(),{
    name:"Northwind",mobile:"9876543210",stage:"New Lead",
    assignedSalespersonId:employee.id,assignedSalesperson:"Asha Sharma"
  }).record;
  const reloaded=JSON.parse(JSON.stringify(saved));
  assert.equal(reloaded.assignedSalespersonId,"EMP-STABLE-1");
  assert.equal(assignedSalespersonName(reloaded,employees),"Asha Sharma");
  const edited=saveLead({...initialState(),leads:[reloaded]},{
    ...reloaded,interest:"Annual contract"
  }).record;
  assert.equal(edited.assignedSalespersonId,"EMP-STABLE-1");
});

test("existing name-only leads remain readable and empty HR lists show guidance",()=>{
  assert.equal(assignedSalespersonName({assignedSalesperson:"Legacy Seller"},[]),"Legacy Seller");
  const source=readFileSync(new URL("../src/sales/app.js",import.meta.url),"utf8");
  assert.match(source,/createWorkspaceStore\("hr-payroll"\)/);
  assert.match(source,/No sales employees available\. Assign an employee to the Sales & CRM department in HR & Payroll\./);
  assert.match(source,/name="assignedSalespersonId"/);
  assert.match(source,/class="salesperson-helper"/);
  assert.doesNotMatch(source,/salesperson-helper[^}]*position\s*:\s*absolute/);
});

test("Sales renders from its own persisted state before optional Inventory and HR integrations load",()=>{
  const source=readFileSync(new URL("../src/sales/app.js",import.meta.url),"utf8");
  const stateReady=source.indexOf("await createWorkspaceStateStorage()");
  const firstRender=source.lastIndexOf("render();Promise.allSettled");
  const inventoryLoad=source.indexOf('inventoryCloud=await createWorkspaceStore("inventory")');
  const hrLoad=source.indexOf('hrCloud=await createWorkspaceStore("hr-payroll")');
  assert.ok(stateReady>=0&&firstRender>stateReady);
  assert.ok(inventoryLoad>stateReady&&hrLoad>stateReady);
  assert.match(source,/render\(\);Promise\.allSettled\(\[loadInventory\(\),loadSalesEmployees\(\)\]\)/);
  assert.doesNotMatch(source,/createWorkspaceStateStorage\(\),inventoryCloud=await/);
});
