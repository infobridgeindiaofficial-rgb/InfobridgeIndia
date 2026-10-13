import{currentUser,requireSupabase}from"../supabase/client.js";
const rpc=async(name,args)=>{const{data,error}=await requireSupabase().rpc(name,args);if(error)throw error;return data};
export async function companyMemberDirectory(companyId){return await rpc("company_member_directory",{p_company_id:companyId})||[]}
export async function appointCompanyMember(companyId,{firstName,lastName,email,position,departmentId,isDepartmentHead=false}){
  if(!await currentUser())throw Error("Authentication required.");
  const rows=await rpc("appoint_company_member",{p_company_id:companyId,p_first_name:firstName,p_last_name:lastName,p_email:email,p_position:position,p_department_id:departmentId,p_is_department_head:Boolean(isDepartmentHead)}),
    appointment=rows?.[0];
  if(!appointment?.appointment_id)throw Error("Appointment could not be created.");
  return appointment;
}
export const cancelCompanyMemberAppointment=(companyId,appointmentId)=>rpc("cancel_company_member_appointment",{p_company_id:companyId,p_appointment_id:appointmentId});
