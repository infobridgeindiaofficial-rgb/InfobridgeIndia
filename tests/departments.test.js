import test from "node:test";
import assert from "node:assert/strict";
import { defaultState } from "../src/administration/core.js";
import { DEFAULT_DEPARTMENTS, absorbLegacyDepartments, ensureDefaultDepartments, orderedDepartments, stableDepartmentId } from "../src/administration/departments.js";

const company=id=>({id,legalName:id,tradeName:id,active:true});
const expectedDefaults=["General","Management","Administration","Human Resources","Finance & Accounts","Sales","Marketing","Business Development","Operations","Customer Service","Procurement","Supply Chain","Logistics","Warehouse / Stores","Information Technology","Engineering","Projects","Quality","Health, Safety & Environment (HSE)","Legal & Compliance","Facilities Management","Maintenance","Production / Manufacturing","Research & Development","Security","Transport"];

test("all global defaults are stable, ordered, and idempotent",()=>{
  const state={...defaultState(),currentCompanyId:"CO-A",companies:[company("CO-A")],departments:[{id:"CUSTOM-1",companyId:"CO-A",name:"Kitchen",code:"KITCHEN",active:true}]};
  ensureDefaultDepartments(state);
  const once=JSON.stringify(state);
  ensureDefaultDepartments(state);
  assert.equal(JSON.stringify(state),once);
  const rows=orderedDepartments(state,"CO-A");
  assert.equal(DEFAULT_DEPARTMENTS.length,26);
  assert.deepEqual(DEFAULT_DEPARTMENTS.map(row=>row.name),expectedDefaults);
  assert.equal(rows.length,27);
  assert.deepEqual(rows.slice(0,26).map(row=>row.name),DEFAULT_DEPARTMENTS.map(row=>row.name));
  assert.equal(rows[26].name,"Kitchen");
  assert.equal(new Set(rows.map(row=>row.code)).size,27);
  assert.equal(rows[0].id,stableDepartmentId("CO-A","GEN"));
});

test("legacy module defaults retire safely while referenced IDs and custom departments survive",()=>{
  const state={...defaultState(),currentCompanyId:"CO-A",companies:[company("CO-A")],departments:[
    {id:"DEP-OLD-SALES",companyId:"CO-A",name:"Sales & CRM",code:"SALES",active:true,systemDefault:true},
    {id:"DEP-OLD-DOC",companyId:"CO-A",name:"Documents",code:"DOC",active:true,systemDefault:true},
    {id:"CUSTOM-CIVIL",companyId:"CO-A",name:"Civil",code:"CIVIL",active:true}
  ]};
  ensureDefaultDepartments(state);
  assert.equal(state.departments.find(row=>row.id==="DEP-OLD-SALES").name,"Sales");
  assert.equal(state.departments.find(row=>row.id==="DEP-OLD-DOC").active,false);
  assert.equal(orderedDepartments(state,"CO-A").some(row=>row.name==="Documents"),false);
  assert.equal(orderedDepartments(state,"CO-A",{includeIds:["DEP-OLD-DOC"]}).some(row=>row.id==="DEP-OLD-DOC"),true);
  assert.equal(state.departments.find(row=>row.id==="CUSTOM-CIVIL").active,true);
});

test("active selectors are company isolated while historical inactive records can be included",()=>{
  const state={...defaultState(),currentCompanyId:"CO-A",companies:[company("CO-A"),company("CO-B")],departments:[
    {id:"OLD",companyId:"CO-A",name:"Old team",code:"OLD",active:false},
    {id:"OTHER",companyId:"CO-B",name:"Other company team",code:"OCT",active:true}
  ]};
  ensureDefaultDepartments(state);
  assert.equal(orderedDepartments(state,"CO-A").some(row=>row.id==="OLD"),false);
  assert.equal(orderedDepartments(state,"CO-A",{includeIds:["OLD"]}).some(row=>row.id==="OLD"),true);
  assert.equal(orderedDepartments(state,"CO-A",{includeIds:["OLD"]}).some(row=>row.companyId==="CO-B"),false);
});

test("legacy HR departments merge into Administration without duplicating General",()=>{
  const memory=new Map(),storage={companyId:"CO-A",getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)};
  memory.set("infobridgeindia.administration.v2",JSON.stringify({...defaultState(),currentCompanyId:"CO-A",companies:[company("CO-A")],departments:[]}));
  const map=absorbLegacyDepartments([{id:"HR-GEN",name:"General",active:true},{id:"HR-OPS",name:"Operations",active:true}],storage);
  const saved=JSON.parse(memory.get("infobridgeindia.administration.v2"));
  assert.equal(saved.departments.filter(row=>row.name==="General").length,1);
  assert.equal(saved.departments.filter(row=>row.name==="Operations").length,1);
  assert.equal(map.get("HR-GEN"),stableDepartmentId("CO-A","GEN"));
  assert.equal(map.get("HR-OPS"),stableDepartmentId("CO-A","OPS"));
});
