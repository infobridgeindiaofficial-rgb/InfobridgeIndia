import{clearCompanyCache,companyToProfile,currentUser,ownedCompany,requireSupabase}from"/supabase/client.js";
import{RESET_MODULES,changeMasterKey,companySecurityStatus,configureMasterKey,deleteCompany,masterKeyFormState,requestMasterKeyRecovery,resetMasterKeyAfterRecovery,revokeDepartmentResetKey,setDepartmentResetKey}from"/security/client.js";
import{destinationAfterAuth}from"/auth/core.js";
import{KEY as ADMINISTRATION_KEY,MODULE_KEYS as ADMINISTRATION_MODULE_KEYS}from"/administration-workspace/repository.js";

const $=selector=>document.querySelector(selector),error=$("[data-security-error]"),success=$("[data-security-success]"),masterForm=$("[data-master-form]"),departmentForm=$("[data-department-key-form]"),currentKeyField=$("[data-current-key-field]"),currentKeyInput=masterForm.elements.currentKey,deleteOpenButton=$("[data-delete-company-open]"),deletePanel=$("[data-delete-company-panel]"),deleteForm=$("[data-delete-company-form]"),deleteCancelButton=$("[data-delete-company-cancel]"),deleteNameLabel=$("[data-delete-company-name]"),forgotPrompt=$("[data-forgot-master-key-prompt]"),forgotButton=$("[data-forgot-master-key]"),recoveryPanel=$("[data-master-key-recovery-panel]"),recoveryMaskedEmail=$("[data-recovery-masked-email]"),sendRecoveryLinkButton=$("[data-send-recovery-link]"),cancelRecoveryButton=$("[data-cancel-recovery]"),recoveryStatus=$("[data-recovery-status]"),recoveryForm=$("[data-master-key-recovery-form]");
// "m*****@example.com" -- never the full address, matching the task's own masking example.
function maskEmail(emailValue){const[local,domain]=String(emailValue||"").split("@");return domain?`${local[0]||""}*****@${domain}`:emailValue||""}
let company,status,inRecoveryMode=false;
// The Danger Zone is the last section on a long page -- without scrolling the banner into
// view, a message shown while the user is scrolled down there is invisible off-screen above
// the fold, which looks exactly like "nothing happened" even though it did.
function message(text,isError=false){error.hidden=true;success.hidden=true;const box=isError?error:success;box.textContent=text;box.hidden=false;box.scrollIntoView({behavior:"smooth",block:"center"})}
function render(){const view=masterKeyFormState(status),masterCard=masterForm.closest("section");masterCard.querySelector("h2").textContent=view.title;$("[data-master-status]").textContent=view.statusText;masterForm.elements.confirmKey.closest(".field").querySelector("label").textContent=view.confirmationLabel;masterForm.querySelector("button").textContent=view.actionLabel;currentKeyInput.required=view.configured;currentKeyInput.disabled=!view.configured;if(view.configured){currentKeyField.hidden=false;if(!currentKeyField.isConnected)masterForm.prepend(currentKeyField)}else{currentKeyInput.value="";currentKeyField.remove()}if(forgotPrompt)forgotPrompt.hidden=!view.configured||inRecoveryMode||!recoveryPanel.hidden;departmentForm.querySelector("button").disabled=!view.configured;$("[data-reset-key-status]").innerHTML=RESET_MODULES.map(module=>`<p><strong>${module.label}</strong> — ${status.departmentModules.includes(module.id)?"Configured":"Not configured"}${module.executable?"":" · execution not enabled"}</p>`).join("")}
async function refresh(){status=await companySecurityStatus(company.companyId);render()}
const user=await currentUser(),profile=companyToProfile(await ownedCompany());
if(!user||!profile||profile.ownerId!==user.id){document.body.textContent="Company Owner authorization is required.";throw new Error("Owner authorization required")}
company=profile;
departmentForm.elements.moduleId.replaceChildren(...RESET_MODULES.map(module=>new Option(module.label,module.id)));
departmentForm.elements.operation.addEventListener("change",()=>{const revoke=departmentForm.elements.operation.value==="revoke";departmentForm.querySelectorAll("[data-new-reset-key]").forEach(field=>field.hidden=revoke);departmentForm.elements.newKey.required=!revoke;departmentForm.elements.confirmKey.required=!revoke});
masterForm.addEventListener("submit",async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(masterForm));try{if(values.newKey!==values.confirmKey)throw new Error("New Master Key confirmation does not match.");const wasConfigured=status.masterConfigured;if(wasConfigured){await changeMasterKey(company.companyId,values.currentKey,values.newKey);masterForm.reset();message("Master Key changed. Department Reset Keys remain valid.");await refresh()}else{await configureMasterKey(company.companyId,values.newKey);location.replace(destinationAfterAuth(sessionStorage))}}catch(cause){message(cause.message||"Unable to update Company Master Key.",true)}});
departmentForm.addEventListener("submit",async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(departmentForm));try{if(values.operation==="revoke")await revokeDepartmentResetKey(company.companyId,values.moduleId,values.masterKey);else{if(values.newKey!==values.confirmKey)throw new Error("Department Reset Key confirmation does not match.");await setDepartmentResetKey(company.companyId,values.moduleId,values.masterKey,values.newKey)}departmentForm.reset();departmentForm.elements.operation.dispatchEvent(new Event("change"));message(values.operation==="revoke"?"Department Reset Key revoked.":"Department Reset Key configured.");await refresh()}catch(cause){message(cause.message||"Unable to update Department Reset Key.",true)}});
if(deleteNameLabel)deleteNameLabel.textContent=company.name||"";
deleteOpenButton?.addEventListener("click",()=>{deletePanel.hidden=false;deleteOpenButton.hidden=true});
deleteCancelButton?.addEventListener("click",()=>{deleteForm.reset();deletePanel.hidden=true;deleteOpenButton.hidden=false});
deleteForm?.addEventListener("submit",async event=>{
  event.preventDefault();
  const submit=deleteForm.querySelector('[type="submit"]'),originalLabel=submit?.textContent;
  // Everything -- including the company-name pre-check -- runs inside this one try block,
  // so absolutely no failure path (validation, network, RPC) can end the handler without
  // showing a message. A typo in the company name is checked first and never reaches
  // Master Key verification, mirroring the existing pre-check already used by the Master
  // Key form above.
  try{
    const values=Object.fromEntries(new FormData(deleteForm));
    if(String(values.confirmName||"").trim()!==(company.name||"")) throw new Error(`Type the exact company name (${company.name}) to confirm.`);
    if(submit){submit.disabled=true;submit.textContent="Deleting…"}
    await deleteCompany(company.companyId,values.masterKey,values.confirmName);
    [ADMINISTRATION_KEY,...ADMINISTRATION_MODULE_KEYS,"infobridgeindia.auth.session.v1","infobridgeindia.company.profile.v1"].forEach(key=>localStorage.removeItem(key));
    clearCompanyCache();
    location.replace("/company-setup.html");
  }catch(cause){
    console.error("Delete Company failed:",cause);
    message(/delete_company|schema cache/i.test(cause.message||"")?"Apply the Company Deletion database migration (supabase/company-deletion.sql) before deleting a company.":cause.message||"Unable to delete the company.",true);
    if(submit){submit.disabled=false;submit.textContent=originalLabel}
  }
});
if(recoveryMaskedEmail)recoveryMaskedEmail.textContent=maskEmail(user.email);
forgotButton?.addEventListener("click",()=>{forgotPrompt.hidden=true;recoveryPanel.hidden=false;recoveryStatus.textContent=""});
cancelRecoveryButton?.addEventListener("click",()=>{recoveryPanel.hidden=true;recoveryStatus.textContent="";render()});
sendRecoveryLinkButton?.addEventListener("click",async()=>{
  sendRecoveryLinkButton.disabled=true;
  recoveryStatus.textContent="Sending recovery link…";
  try{
    await requestMasterKeyRecovery(company.companyId);
    // Reuses Supabase Auth's own email infrastructure (the same mechanism as the existing
    // "forgot password" flow) -- always the current session's own verified email, never a
    // typed-in address, and never anything that could reveal or transmit the stored key.
    const{error:otpError}=await requireSupabase().auth.signInWithOtp({email:user.email,options:{emailRedirectTo:"https://infobridgeindia.online/company-security.html?masterKeyRecovery=1",shouldCreateUser:false}});
    if(otpError)throw otpError;
    recoveryStatus.textContent="Recovery link sent. Check your inbox and spam folder, then open the link to continue here.";
  }catch(cause){
    recoveryStatus.textContent=cause.message||"Unable to send the recovery link. Please try again.";
  }finally{
    sendRecoveryLinkButton.disabled=false;
  }
});

recoveryForm?.addEventListener("submit",async event=>{
  event.preventDefault();
  const submit=recoveryForm.querySelector('[type="submit"]');
  try{
    const values=Object.fromEntries(new FormData(recoveryForm));
    if(values.newKey!==values.confirmKey)throw new Error("New Master Key confirmation does not match.");
    if(submit)submit.disabled=true;
    await resetMasterKeyAfterRecovery(company.companyId,values.newKey);
    recoveryForm.reset();
    recoveryForm.hidden=true;
    inRecoveryMode=false;
    masterForm.hidden=false;
    const url=new URL(location.href);url.searchParams.delete("masterKeyRecovery");
    history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`);
    message("Company Master Key updated successfully.");
    await refresh();
  }catch(cause){
    message(cause.message||"Unable to reset the Company Master Key.",true);
  }finally{
    if(submit)submit.disabled=false;
  }
});

if(new URLSearchParams(location.search).get("masterKeyRecovery")==="1"){
  inRecoveryMode=true;
  forgotPrompt.hidden=true;
  recoveryPanel.hidden=true;
  masterForm.hidden=true;
  recoveryForm.hidden=false;
}

try{await refresh()}catch(cause){message("Company Security is not available until the reviewed security migration is applied.",true);masterForm.querySelector("button").disabled=true;departmentForm.querySelector("button").disabled=true}
