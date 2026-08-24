import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { administrationCompanyName, companyNameFromState, readAdministrationCompany } from "../src/administration/company.js";

test("selected Administration trade name is authoritative with legal-name fallback",()=>{
  const state={currentCompanyId:"CO-1",companies:[{id:"CO-1",tradeName:"SHAYAN KARTS",legalName:"Shayan Karts Private Limited"},{id:"CO-2",tradeName:"Other",legalName:"Other Legal"}]};
  assert.equal(companyNameFromState(state,"CO-1"),"SHAYAN KARTS");
  state.companies[0].tradeName="";
  assert.equal(companyNameFromState(state,"CO-1"),"Shayan Karts Private Limited");
  assert.equal(administrationCompanyName(null),"");
});

test("company resolver remains scoped to the selected company ID",()=>{
  const state={currentCompanyId:"CO-A",companies:[{id:"CO-A",tradeName:"Alpha",legalName:"Alpha Legal"},{id:"CO-B",tradeName:"Beta",legalName:"Beta Legal"}]};
  const storage={companyId:"CO-B",getItem:()=>JSON.stringify(state)};
  assert.equal(readAdministrationCompany(storage).displayName,"Beta");
});

test("shared sidebars and HR use Administration name while historical payslips keep snapshots",()=>{
  const sidebar=readFileSync(new URL("../src/scripts/workspace-sidebar.js",import.meta.url),"utf8"),hr=readFileSync(new URL("../src/hr-payroll/app.js",import.meta.url),"utf8"),payslip=readFileSync(new URL("../src/hr-payroll/payslip.js",import.meta.url),"utf8"),layout=readFileSync(new URL("../src/components/layout.js",import.meta.url),"utf8");
  assert.match(sidebar,/currentCompanyName/);
  assert.match(hr,/companyDisplayName\(\)/);
  assert.match(hr,/companyName=companyDisplayName/);
  assert.match(hr,/company:window\.InfoBridgeCompany/);
  assert.match(payslip,/profile\.legalName\|\|profile\.name\|\|p\.company/);
  assert.match(hr,/companyProfileSnapshot=companyPayslipSnapshot/);
  assert.match(hr,/companyProfileSnapshot\}\)/);
  assert.doesNotMatch(hr,/field\("companyName","Legal company name"|field\("displayName","Display name"/);
  assert.match(layout,/profile-label" data-auth-display-name/);
});
