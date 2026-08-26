import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("Sales startup scopes persistence hydration to the Sales state record",()=>{
  const app=read("src/sales/app.js"),workspace=read("src/supabase/workspace.js");
  assert.match(app,/createWorkspaceStateStorage\(\{recordKey:"infobridgeindia\.sales\.v1"\}\)/);
  assert.match(workspace,/if \(recordKey\) query = query\.eq\("record_id", recordKey\)/);
});

test("Sales startup reports rejected or stalled initialization instead of loading forever",()=>{
  const page=read("src/pages/app/sales-workspace.js"),bootstrap=read("src/sales/bootstrap.js");
  assert.match(page,/sales-workspace\/bootstrap\.js/);
  assert.match(bootstrap,/waitForAuthenticatedCompany\(\)\.then\(\(\)=>import\("\.\/app\.js"\)\).*\.catch\(error=>/s);
  assert.match(bootstrap,/setTimeout\(.*10000\)/s);
  assert.match(bootstrap,/Your saved data was not changed/);
});

test("Sales waits for the auth gate's company context instead of racing duplicate startup",()=>{
  const bootstrap=read("src/sales/bootstrap.js");
  assert.match(bootstrap,/globalThis\.InfoBridgeUser&&globalThis\.InfoBridgeCompany\?\.companyId/);
  assert.match(bootstrap,/await new Promise\(resolve=>setTimeout\(resolve,25\)\)/);
});

test("quotation UI accepts qualified leads and uses country-neutral wording",()=>{
  const app=read("src/sales/app.js");
  assert.match(app,/\["Qualified","Quotation Sent","Negotiation"\]\.includes\(lead\.stage\)/);
  assert.match(app,/name="partyRef"/);
  assert.match(app,/data-quotation-party/);
  assert.match(app,/country-aware tax calculations and source traceability/);
  assert.match(app,/stopImmediatePropagation\(\);countryQuotationModal\(\)/);
});

test("quotation form and preview branch into UAE VAT or India GST fields from company country",()=>{
  const app=read("src/sales/app.js");
  assert.match(app,/const ae=country==="AE"/);
  assert.match(app,/Item \/ service code \(optional\)/);
  assert.match(app,/placeholder="HSN \/ SAC"/);
  assert.match(app,/placeField=ae\?"":field\("placeOfSupply","Place of Supply \/ State Code"/);
  assert.match(app,/ae\?"VAT %":"GST %"/);
  assert.match(app,/Grand Total AED/);
  assert.match(app,/CGST[\s\S]*SGST[\s\S]*IGST/);
  assert.match(app,/company\.defaultVatRate\?\?company\.defaultGstRate/);
  assert.match(app,/countryQuotationModal\(\)/);
});

test("Quotations exposes separate UAE and India creation actions",()=>{
  const app=read("src/sales/app.js");
  assert.match(app,/data-quotation-country=\"AE\">UAE Quotation/);
  assert.match(app,/data-quotation-country=\"IN\">India Quotation/);
  assert.match(app,/quotationWorkspace\(button\.dataset\.quotationCountry\)/);
  assert.match(app,/class=\"quotation-workspace\"/);
  assert.match(app,/data-workspace-lines/);
  assert.match(app,/data-quote-status=\"Draft\">Save Draft/);
  assert.match(app,/data-quote-status=\"Sent\">Save Quotation/);
});
