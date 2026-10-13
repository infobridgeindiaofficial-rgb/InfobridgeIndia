import { requireSupabase } from "../supabase/client.js";

export const RESET_MODULES=Object.freeze([
  {id:"hr_payroll",label:"HR & Payroll",executable:true},
  {id:"sales_crm",label:"Sales & CRM",executable:false},
  {id:"purchases",label:"Purchases & Procurement",executable:false},
  {id:"inventory",label:"Inventory & Warehouse",executable:false},
  {id:"finance",label:"Finance & Accounting",executable:false},
  {id:"banking",label:"Banking",executable:false},
  {id:"projects",label:"Projects",executable:false},
]);

async function rpc(name,args){const{data,error}=await requireSupabase().rpc(name,args);if(error)throw error;return data}
export async function companySecurityStatus(companyId){const rows=await rpc("company_security_status",{p_company_id:companyId}),status=Array.isArray(rows)?rows[0]:rows;return{masterConfigured:Boolean(status?.master_configured),departmentModules:status?.department_modules||[]}}
export function masterKeyFormState(securityStatus={}){
  const configured=securityStatus.masterConfigured===true;
  return configured
    ?{configured,title:"Change Company Master Key",confirmationLabel:"Confirm New Master Key",actionLabel:"Change Master Key",statusText:"Master Key configured. Enter the current key to change it."}
    :{configured,title:"Set Up Company Master Key",confirmationLabel:"Confirm Master Key",actionLabel:"Set Up Master Key",statusText:"No Master Key configured. Set one up to enable protected security operations."};
}
export const configureMasterKey=(companyId,newKey)=>rpc("configure_company_master_key",{p_company_id:companyId,p_new_key:newKey});
export const verifyMasterKey=(companyId,key)=>rpc("verify_company_master_key",{p_company_id:companyId,p_master_key:key});
export const changeMasterKey=(companyId,currentKey,newKey)=>rpc("change_company_master_key",{p_company_id:companyId,p_current_key:currentKey,p_new_key:newKey});
export const setDepartmentResetKey=(companyId,moduleId,masterKey,newKey)=>rpc("set_department_reset_key",{p_company_id:companyId,p_module_id:moduleId,p_master_key:masterKey,p_new_key:newKey});
export const revokeDepartmentResetKey=(companyId,moduleId,masterKey)=>rpc("revoke_department_reset_key",{p_company_id:companyId,p_module_id:moduleId,p_master_key:masterKey});
export const executeHrReset=(companyId,resetKey,confirmation)=>rpc("execute_department_reset",{p_company_id:companyId,p_module_id:"hr_payroll",p_reset_key:resetKey,p_confirmation:confirmation});
// Permanently deletes the entire company workspace. Owner-only and Master-Key-gated,
// enforced inside the RPC itself -- never trust a frontend-only owner check for this.
export const deleteCompany=(companyId,masterKey,confirmName)=>rpc("delete_company",{p_company_id:companyId,p_master_key:masterKey,p_confirm_name:confirmName});
// "Forgot Master Key" recovery -- audit-only request, then the actual reset RPC, which
// itself requires a fresh Supabase email verification (see company-master-key-recovery.sql).
// The email is sent separately via supabase.auth.signInWithOtp() using the already
// authenticated owner's own session email -- never an email supplied by this call.
export const requestMasterKeyRecovery=companyId=>rpc("request_master_key_recovery",{p_company_id:companyId});
export const resetMasterKeyAfterRecovery=(companyId,newKey)=>rpc("reset_master_key_after_recovery",{p_company_id:companyId,p_new_key:newKey});
