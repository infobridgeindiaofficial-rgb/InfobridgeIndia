import{requireSupabase}from"../supabase/client.js";
const rpc=async(name,args)=>{const{data,error}=await requireSupabase().rpc(name,args);if(error)throw error;return data};
export const companyRoleDirectory=async companyId=>await rpc("company_role_directory",{p_company_id:companyId})||[];
export const updateCompanyMemberPermissions=(companyId,memberId,permissions)=>rpc("update_company_member_permissions",{p_company_id:companyId,p_member_id:memberId,p_permissions:permissions});
export const removeCompanyMemberAccess=(companyId,memberId)=>rpc("remove_company_member_access",{p_company_id:companyId,p_member_id:memberId});
