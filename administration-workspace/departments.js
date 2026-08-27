export const ADMINISTRATION_STORAGE_KEY="infobridgeindia.administration.v2";

const CORE_DEPARTMENT_DEFINITIONS=Object.freeze([
  {code:"FIN",name:"Finance & Accounting",aliases:["Finance & Accounts"]},
  {code:"SALES",name:"Sales & CRM",aliases:["Sales"]},
  {code:"PUR",name:"Purchases & Procurement",codeAliases:["PROC"],aliases:["Procurement"]},
  {code:"INV",name:"Inventory & Warehouse",codeAliases:["WHS"],aliases:["Warehouse / Stores"]},
  {code:"HR",name:"HR & Payroll",aliases:["Human Resources"]},
  {code:"PROJ",name:"Projects & Operations",aliases:["Projects"]},
  {code:"DOC",name:"Documents"},
  {code:"APR",name:"Internal Requests",aliases:["Approvals & Workflows","Approvals"]},
  {code:"BANK",name:"Banking"},
  {code:"RPT",name:"Reports & Analytics"},
  {code:"ADMIN",name:"Administration"}
]);
export const DEFAULT_DEPARTMENTS=Object.freeze(CORE_DEPARTMENT_DEFINITIONS.map((item,order)=>Object.freeze({code:item.code,name:item.name,order})));
// One-time cleanup: these two custom departments are no longer wanted and must stop
// appearing anywhere (Appoint Member, Default Department Access). Only exact-name,
// non-system rows are affected -- core/system departments are never touched here.
const RETIRED_CUSTOM_DEPARTMENT_NAMES=new Set(["house keeping","service"]);
const norm=value=>String(value||"").trim().toLowerCase();
const safe=value=>String(value||"COMPANY").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-|-$/g,"").toUpperCase();
const matchesCore=(row,item)=>[item.code,...item.codeAliases||[]].some(code=>norm(row.code)===norm(code))||[item.name,...item.aliases||[]].some(name=>norm(row.name)===norm(name));
const coreDefinition=row=>CORE_DEPARTMENT_DEFINITIONS.find(item=>matchesCore(row,item));
export const stableDepartmentId=(companyId,code)=>`DEP-${safe(companyId)}-${safe(code)}`;
const stableDepartmentAccessId=(companyId,code)=>`DDA-${safe(companyId)}-${safe(code)}`;

// Maps each system-default department to the InfoBridgeIndia module it naturally corresponds to,
// so appointing someone to that department can automatically seed sensible default access.
// Custom (company-created) departments have no obvious module mapping and get an empty
// default template -- the Owner configures their access explicitly from Roles & Permissions.
export const DEPARTMENT_MODULE_BY_CODE=Object.freeze({FIN:"Finance & Accounting",SALES:"Sales & CRM",PUR:"Purchases & Procurement",INV:"Inventory & Warehouse",HR:"HR & Payroll",PROJ:"Projects & Operations",DOC:"Documents",APR:"Internal Requests",BANK:"Banking",RPT:"Reports & Analytics",ADMIN:"Administration"});
const MEMBER_DEFAULT_ACTIONS=Object.freeze(["View","Create","Edit"]);
const HEAD_DEFAULT_ACTIONS=Object.freeze(["View","Create","Edit","Approve","Import","Export","Manage Settings"]);
const ADMIN_HEAD_EXTRA_ACTIONS=Object.freeze(["Manage Users","Manage Permissions","View Audit"]);
const permissionsFor=(module,actions)=>module?{[module]:Object.fromEntries(actions.map(action=>[action,true]))}:{};

function assignChanged(row,values){let changed=false;for(const[key,value]of Object.entries(values))if(row[key]!==value){row[key]=value;changed=true}if(changed)row.updatedAt=new Date().toISOString();return row}

function ensureDepartmentDefaultAccess(state,companyId,departmentId,code){
  state.departmentDefaultAccess=Array.isArray(state.departmentDefaultAccess)?state.departmentDefaultAccess:[];
  if(state.departmentDefaultAccess.some(x=>x.departmentId===departmentId))return;
  const module=DEPARTMENT_MODULE_BY_CODE[code],headActions=code==="ADMIN"?[...HEAD_DEFAULT_ACTIONS,...ADMIN_HEAD_EXTRA_ACTIONS]:HEAD_DEFAULT_ACTIONS,timestamp=new Date().toISOString();
  state.departmentDefaultAccess.push({id:stableDepartmentAccessId(companyId,code),companyId,departmentId,memberPermissions:permissionsFor(module,MEMBER_DEFAULT_ACTIONS),headPermissions:permissionsFor(module,headActions),createdAt:timestamp,updatedAt:timestamp});
}

export function ensureDefaultDepartments(state,companyIds){
  state.departments=Array.isArray(state.departments)?state.departments:[];
  const ids=companyIds||state.companies?.map(company=>company.id)||[state.currentCompanyId];
  for(const companyId of ids.filter(Boolean)){
    const claimed=new Set();
    for(const item of CORE_DEPARTMENT_DEFINITIONS){
      let row=state.departments.find(candidate=>candidate.companyId===companyId&&!claimed.has(candidate.id)&&matchesCore(candidate,item));
      if(!row){const timestamp=new Date().toISOString();row={id:stableDepartmentId(companyId,item.code),companyId,name:item.name,code:item.code,active:true,isSystem:true,systemDefault:true,retiredSystemDefault:false,defaultOrder:DEFAULT_DEPARTMENTS.find(entry=>entry.code===item.code).order,createdAt:timestamp,updatedAt:timestamp};state.departments.push(row)}
      else assignChanged(row,{name:item.name,code:item.code,active:true,isSystem:true,systemDefault:true,retiredSystemDefault:false,defaultOrder:DEFAULT_DEPARTMENTS.find(entry=>entry.code===item.code).order});
      claimed.add(row.id);
      ensureDepartmentDefaultAccess(state,companyId,row.id,item.code);
    }
    for(const row of state.departments.filter(candidate=>candidate.companyId===companyId&&candidate.systemDefault===true&&!claimed.has(candidate.id)))assignChanged(row,{active:false,isSystem:false,retiredSystemDefault:true});
    for(const row of state.departments.filter(candidate=>candidate.companyId===companyId&&!candidate.isSystem&&!candidate.systemDefault&&candidate.active!==false&&RETIRED_CUSTOM_DEPARTMENT_NAMES.has(norm(candidate.name))))assignChanged(row,{active:false});
  }
  return state;
}

export function orderedDepartments(state,companyId=state?.currentCompanyId,{activeOnly=true,includeIds=[]}={}){const included=new Set(includeIds.filter(Boolean)),order=new Map(DEFAULT_DEPARTMENTS.map((item,index)=>[item.code,index]));return(state?.departments||[]).filter(row=>row.companyId===companyId&&!row.retiredSystemDefault&&(!activeOnly||row.active!==false||included.has(row.id))).sort((a,b)=>{const ac=String(a.code||"").toUpperCase(),bc=String(b.code||"").toUpperCase(),ao=order.has(ac)?order.get(ac):1000,bo=order.has(bc)?order.get(bc):1000;return ao-bo||String(a.name||"").localeCompare(String(b.name||""))})}
export function readDepartmentState(storage=globalThis.InfoBridgeWorkspaceStorage||globalThis.localStorage){try{const state=JSON.parse(storage?.getItem(ADMINISTRATION_STORAGE_KEY)||"null");return state&&Array.isArray(state.departments)?state:{departments:[],companies:[],currentCompanyId:""}}catch{return{departments:[],companies:[],currentCompanyId:""}}}
export function currentCompanyId(storage=globalThis.InfoBridgeWorkspaceStorage||globalThis.localStorage,state){return state?.currentCompanyId||storage?.companyId||globalThis.InfoBridgeCompany?.companyId||""}
export function sharedDepartments({includeIds=[],activeOnly=true,storage=globalThis.InfoBridgeWorkspaceStorage||globalThis.localStorage}={}){const state=readDepartmentState(storage),companyId=currentCompanyId(storage,state),authoritativeScope=Boolean(storage?.companyId&&storage.companyId===companyId),scopedState=authoritativeScope?{...state,departments:(state.departments||[]).map(row=>row.companyId?row:{...row,companyId})}:state;return orderedDepartments(scopedState,companyId,{activeOnly,includeIds})}
export function departmentSourceDiagnostics({includeIds=[],storage=globalThis.InfoBridgeWorkspaceStorage||globalThis.localStorage}={}){const state=readDepartmentState(storage),companyId=currentCompanyId(storage,state),raw=state.departments||[],resolved=sharedDepartments({includeIds,storage});return{source:storage?.companyId?"authoritative-workspace":"browser-fallback",storageCompanyId:storage?.companyId||"",profileCompanyId:globalThis.InfoBridgeCompany?.companyId||"",stateCompanyId:state.currentCompanyId||"",resolvedCompanyId:companyId,rawCount:raw.length,rawCustomCount:raw.filter(row=>!(row.isSystem||row.systemDefault)).length,resolvedCount:resolved.length,resolvedDepartments:resolved.map(row=>({id:row.id,name:row.name,active:row.active!==false,companyId:row.companyId||companyId}))}}
export function sharedDepartmentName(id,fallback="",options={}){return sharedDepartments({...options,activeOnly:false,includeIds:[id]}).find(row=>row.id===id)?.name||fallback||"—"}
export function departmentSelectOptions(selected="",options={}){return[{id:"",name:"Select department"},...sharedDepartments({...options,includeIds:selected?[selected]:[]})]}

export function absorbLegacyDepartments(legacy=[],storage=globalThis.InfoBridgeWorkspaceStorage||globalThis.localStorage){
  const state=readDepartmentState(storage),companyId=currentCompanyId(storage,state),map=new Map();if(!companyId)return map;ensureDefaultDepartments(state,[companyId]);
  for(const old of legacy){
    const definition=coreDefinition(old);let row=definition?state.departments.find(item=>item.companyId===companyId&&item.code===definition.code):state.departments.find(item=>item.companyId===companyId&&(norm(item.name)===norm(old.name)||old.code&&norm(item.code)===norm(old.code)));
    if(!row){const code=String(old.code||old.name||"DEPT").toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,16)||"DEPT";row={...old,id:old.id||stableDepartmentId(companyId,code),companyId,code,active:old.active!==false,isSystem:false,systemDefault:false,createdAt:old.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};state.departments.push(row)}
    if(definition&&old.id&&old.id!==row.id&&!state.departments.some(item=>item.companyId===companyId&&item.id===old.id))state.departments.push({...old,id:old.id,companyId,name:row.name,active:false,isSystem:false,systemDefault:false,legacyDepartmentTargetId:row.id,createdAt:old.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});
    map.set(old.id,row.id);
  }
  ensureDefaultDepartments(state,[companyId]);storage?.setItem(ADMINISTRATION_STORAGE_KEY,JSON.stringify(state));return map;
}
export function saveSharedDepartment(value,storage=globalThis.InfoBridgeWorkspaceStorage||globalThis.localStorage){const state=readDepartmentState(storage),companyId=currentCompanyId(storage,state),name=String(value.name||"").trim();if(!companyId||!name)throw Error("Department name is required");const found=state.departments.find(row=>row.companyId===companyId&&norm(row.name)===norm(name));if(found)return found;let code=String(value.code||name).toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,16)||"DEPT";let suffix=2;while(state.departments.some(row=>row.companyId===companyId&&norm(row.code)===norm(code)))code=`${code.slice(0,13)}-${suffix++}`;const timestamp=new Date().toISOString(),row={...value,id:value.id||stableDepartmentId(companyId,code),companyId,name,code,active:value.active!==false,isSystem:false,systemDefault:false,createdAt:value.createdAt||timestamp,updatedAt:timestamp};state.departments.push(row);storage?.setItem(ADMINISTRATION_STORAGE_KEY,JSON.stringify(state));return row}
