const root=document.querySelector("#sales-app");
const timeout=setTimeout(()=>{
  if(root?.querySelector(".sales-boot"))root.innerHTML='<div class="sales-boot"><p>Sales & CRM is taking longer than expected.</p><button class="btn primary" type="button" onclick="location.reload()">Retry</button></div>';
},10000);

async function waitForAuthenticatedCompany(){
  const deadline=Date.now()+10000;
  while(Date.now()<deadline){
    if(globalThis.InfoBridgeUser&&globalThis.InfoBridgeCompany?.companyId)return;
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  throw new Error("Authenticated company context was not ready.");
}

waitForAuthenticatedCompany().then(()=>import("./app.js")).then(()=>clearTimeout(timeout)).catch(error=>{
  clearTimeout(timeout);
  console.error("Sales & CRM startup failed.",error);
  if(root)root.innerHTML='<div class="sales-boot"><p>Sales & CRM could not be opened. Your saved data was not changed.</p><button class="btn primary" type="button" onclick="location.reload()">Retry</button></div>';
});
