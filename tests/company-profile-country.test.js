import test from "node:test";
import assert from "node:assert/strict";
import { companyProfileCountryModel, normalizeCompanyProfileInput, switchCompanyCountryDraft, canEditCompanyCountry, assertCompanyCountryChangeAllowed } from "../src/company/profile.js";
import { supportedCountryOptions } from "../src/country/registry.js";
import { bootstrap, defaultState } from "../src/administration/core.js";
import { saveConfiguredCompany } from "../src/administration/country.js";

test("country registry is the one Company Setup selector source",()=>{
  assert.deepEqual(supportedCountryOptions(),[{code:"IN",name:"India"},{code:"AE",name:"United Arab Emirates (UAE)"}]);
});

test("India company input persists canonical jurisdiction defaults and ignores UAE fields",()=>{
  const profile=normalizeCompanyProfileInput({country:"India",name:"India Co",state:"Kerala",emirate:"Dubai",taxRegistered:true,taxNumber:"27ABCDE1234F1Z5",trn:"100123456700003",tradeLicenseNumber:"DED-OLD",currency:"AED",taxSystem:"VAT"});
  assert.deepEqual({country:profile.country,state:profile.state,currency:profile.currency,taxSystem:profile.taxSystem,gstin:profile.gstin,trn:profile.trn,licence:profile.tradeLicenseNumber},{country:"IN",state:"Kerala",currency:"INR",taxSystem:"GST",gstin:"27ABCDE1234F1Z5",trn:"",licence:""});
  assert.equal(companyProfileCountryModel(profile).regionLabel,"State");
});

test("UAE company input persists canonical jurisdiction defaults and ignores India fields",()=>{
  const profile=normalizeCompanyProfileInput({country:"United Arab Emirates",name:"Dubai Co",state:"Kerala",emirate:"Dubai",taxRegistered:true,taxNumber:"100123456700003",gstin:"27ABCDE1234F1Z5",tradeLicenseNumber:"DED-123",tradeLicenseExpiryDate:"2027-01-31",currency:"INR",taxSystem:"GST"});
  assert.deepEqual({country:profile.country,state:profile.state,currency:profile.currency,taxSystem:profile.taxSystem,gstin:profile.gstin,trn:profile.trn,licence:profile.tradeLicenseNumber},{country:"AE",state:"Dubai",currency:"AED",taxSystem:"VAT",gstin:"",trn:"100123456700003",licence:"DED-123"});
  assert.equal(companyProfileCountryModel(profile).regionLabel,"Emirate");
});

test("pre-save country switching preserves common fields and clears incompatible jurisdiction fields",()=>{
  const common={name:"Common Company",address:"Shared address",logo:"data:image/png;base64,AA",businessType:"LLP",state:"Kerala",taxRegistered:true,taxNumber:"27ABCDE1234F1Z5"};
  const uae=switchCompanyCountryDraft(common,"AE");
  assert.deepEqual([uae.name,uae.address,uae.logo,uae.country,uae.currency,uae.taxSystem,uae.state,uae.taxNumber],["Common Company","Shared address","data:image/png;base64,AA","AE","AED","VAT","",""]);
  const india=switchCompanyCountryDraft({...uae,emirate:"Dubai",tradeLicenseNumber:"DED-123"},"IN");
  assert.deepEqual([india.name,india.address,india.country,india.currency,india.taxSystem,india.emirate,india.tradeLicenseNumber],["Common Company","Shared address","IN","INR","GST","",""]);
});

test("country is editable only for initial or explicitly incomplete company setup",()=>{
  assert.equal(canEditCompanyCountry(null),true);
  assert.equal(canEditCompanyCountry({companyId:"C1",profileComplete:false}),true);
  assert.equal(canEditCompanyCountry({companyId:"C1",profileComplete:true,country:"IN"}),false);
  assert.doesNotThrow(()=>assertCompanyCountryChangeAllowed({companyId:"C1",profileComplete:true,country:"India"},"IN"));
  assert.throws(()=>assertCompanyCountryChangeAllowed({companyId:"C1",profileComplete:true,country:"IN"},"AE"),/country is locked/);
});

test("Administration company save canonicalizes initial jurisdiction and locks it thereafter",()=>{
  let state=bootstrap(defaultState()),placeholder=state.companies[0];
  const initial=saveConfiguredCompany(state,{id:placeholder.id,legalName:"Dubai LLC",tradeName:"Dubai",businessType:"Limited Liability Company (LLC)",country:"UAE",state:"Dubai",city:"Dubai",timezone:"Asia/Dubai",vatStatus:"Registered",trn:"100123456700003"});
  assert.deepEqual([initial.record.country,initial.record.currency,initial.record.taxSystem,initial.record.trn],["AE","AED","VAT","100123456700003"]);
  assert.throws(()=>saveConfiguredCompany(initial.state,{...initial.record,country:"IN",state:"Kerala",city:"Kochi",gstStatus:"Unregistered"}),/country is locked/);
});
