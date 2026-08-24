export const ADMINISTRATION_STORAGE_KEY="infobridgeindia.administration.v2";
export const DEFAULT_DEPARTMENTS=Object.freeze([
  ["GEN","General"],["MGT","Management"],["ADMIN","Administration"],["HR","Human Resources"],
  ["FIN","Finance & Accounts"],["SALES","Sales"],["MKT","Marketing"],["BD","Business Development"],
  ["OPS","Operations"],["CS","Customer Service"],["PROC","Procurement"],["SC","Supply Chain"],
  ["LOG","Logistics"],["WHS","Warehouse / Stores"],["IT","Information Technology"],["ENG","Engineering"],
  ["PROJ","Projects"],["QUAL","Quality"],["HSE","Health, Safety & Environment (HSE)"],["LEGAL","Legal & Compliance"],
  ["FM","Facilities Management"],["MAINT","Maintenance"],["PROD","Production / Manufacturing"],["RD","Research & Development"],
  ["SEC","Security"],["TRANS","Transport"]
].map(([code,name],order)=>Object.freeze({code,name,order})));
const LEGACY_MODULE_DEFAULTS=Object.freeze({FIN:"Finance & Accounting",SALES:"Sales & CRM",PUR:"Purchases & Procurement",INV:"Inventory & Warehouse",HR:"HR & Payroll",PROJ:"Projects & Operations",DOC:"Documents",BANK:"Banking",RPT:"Reports & Analytics",APR:"Approvals & Workflows"});
const norm=value=>String(value||"").trim().toLowerCase();
const safe=value=>String(value||"COMPANY").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-|-$/g,"").toUpperCase();
export const stableDepartmentId=(companyId,code)=>`DEP-${safe(companyId)}-${safe(code)}`;
export function ensureDefaultDepartments(state,companyIds){
  state.departments=Array.isArray(state.departments)?state.departments:[];
  const ids=companyIds||state.companies?.map(company=>company.id)||[state.currentCompanyId];
  for(const companyId of ids.filter(Boolean)){
    for(const row of state.departments.filter(item=>item.companyId===companyId&&item.systemDefault===true)){
      const code=String(row.code||"").toUpperCase(),replacement=DEFAULT_DEPARTMENTS.find(item=>item.code===code),legacyName=LEGACY_MODULE_DEFAULTS[code];
      if(replacement&&legacyName&&norm(row.name)===norm(legacyName)){row.name=replacement.name;row.updatedAt=new Date().toISOString()}
      if(legacyName&&!replacement&&norm(row.name)===norm(legacyName)&&(row.active!==false||row.retiredSystemDefault!==true)){row.active=false;row.retiredSystemDefault=true;row.updatedAt=new Date().toISOString()}
    }
    for(const item of DEFAULT_DEPARTMENTS){
      const existing=state.departments.find(row=>row.companyId===companyId&&(norm(row.code)===norm(item.code)||norm(row.name)===norm(item.name)));
      if(existing){if(!existing.code)existing.code=item.code;if(existing.defaultOrder==null)existing.defaultOrder=item.order;continue}
      const timestamp=new Date().toISOString();
      state.departments.push({id:stableDepartmentId(companyId,item.code),companyId,name:item.name,code:item.code,active:true,systemDefault:true,defaultOrder:item.order,createdAt:timestamp,updatedAt:timestamp});
    }
  }
  return state;
}
export function orderedDepartments(state,companyId=state?.currentCompanyId,{activeOnly=true,includeIds=[]}={}){
  const included=new Set(includeIds.filter(Boolean)),order=new Map(DEFAULT_DEPARTMENTS.map((item,index)=>[item.code,index]));
  return(state?.departments||[]).filter(row=>row.companyId===companyId&&(!activeOnly||row.active!==false||included.has(row.id))).sort((a,b)=>{const ac=String(a.code||"").toUpperCase(),bc=String(b.code||"").toUpperCase(),ao=order.has(ac)?order.get(ac):1000,bo=order.has(bc)?order.get(bc):1000;return ao-bo||String(a.name||"").localeCompare(String(b.name||""))});
}
export function readDepartmentState(storage=globalThis.InfoBridgeWorkspaceStorage||globalThis.localStorage){try{const before=storage?.getItem(ADMINISTRATION_STORAGE_KEY)||"{}",state=ensureDefaultDepartments(JSON.parse(before)),after=JSON.stringify(state);if(after!==before&&state.companies?.length)storage?.setItem(ADMINISTRATION_STORAGE_KEY,after);return state}catch{return{departments:[],companies:[],currentCompanyId:""}}}
export function currentCompanyId(storage=globalThis.InfoBridgeWorkspaceStorage||globalThis.localStorage,state){return globalThis.InfoBridgeCompany?.companyId||storage?.companyId||state?.currentCompanyId||""}
export function sharedDepartments({includeIds=[],activeOnly=true,storage=globalThis.InfoBridgeWorkspaceStorage||globalThis.localStorage}={}){const state=readDepartmentState(storage);return orderedDepartments(state,currentCompanyId(storage,state),{activeOnly,includeIds})}
export function sharedDepartmentName(id,fallback="",options={}){return sharedDepartments({...options,activeOnly:false,includeIds:[id]}).find(row=>row.id===id)?.name||fallback||"—"}
export function departmentSelectOptions(selected="",options={}){return[{id:"",name:"Select department"},...sharedDepartments({...options,includeIds:selected?[selected]:[]})]}
export function absorbLegacyDepartments(legacy=[],storage=globalThis.InfoBridgeWorkspaceStorage||globalThis.localStorage){const state=readDepartmentState(storage),companyId=currentCompanyId(storage,state),map=new Map();if(!companyId)return map;for(const old of legacy){let row=state.departments.find(item=>item.companyId===companyId&&(norm(item.name)===norm(old.name)||old.code&&norm(item.code)===norm(old.code)));if(!row){const code=String(old.code||old.name||"DEPT").toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,16)||"DEPT";row={...old,id:old.id||stableDepartmentId(companyId,code),companyId,code,active:old.active!==false,createdAt:old.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};state.departments.push(row)}map.set(old.id,row.id)}ensureDefaultDepartments(state,[companyId]);storage?.setItem(ADMINISTRATION_STORAGE_KEY,JSON.stringify(state));return map}
export function saveSharedDepartment(value,storage=globalThis.InfoBridgeWorkspaceStorage||globalThis.localStorage){const state=readDepartmentState(storage),companyId=currentCompanyId(storage,state),name=String(value.name||"").trim();if(!companyId||!name)throw Error("Department name is required");const found=state.departments.find(row=>row.companyId===companyId&&norm(row.name)===norm(name));if(found)return found;let code=String(value.code||name).toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,16)||"DEPT";let suffix=2;while(state.departments.some(row=>row.companyId===companyId&&norm(row.code)===norm(code)))code=`${code.slice(0,13)}-${suffix++}`;const timestamp=new Date().toISOString(),row={...value,id:value.id||stableDepartmentId(companyId,code),companyId,name,code,active:value.active!==false,createdAt:value.createdAt||timestamp,updatedAt:timestamp};state.departments.push(row);storage?.setItem(ADMINISTRATION_STORAGE_KEY,JSON.stringify(state));return row}
