import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { amountInWords, companyPayslipSnapshot, maskPaymentValue, renderPayslipDocument } from "../src/hr-payroll/payslip.js";

const slip={period:"2026-07",from:"2026-07-01",to:"2026-07-31",company:"Old snapshot",name:"Mariam Ali",employeeId:"E1",employeeCode:"EMP-001",calendarDays:31,workingDays:27,weeklyOffDays:4,presentDays:26,paidLeaveDays:1,lopDays:0,workedHours:208,overtimeHours:2,basic:12000,earnedBasic:12000,allowances:2000,otPay:250,adjustments:100,lopDeduction:0,deductions:350,gross:14350,net:14000,generatedAt:"2026-08-01T10:00:00.000Z"};
const employee={id:"E1",employeeId:"EMP-001",firstName:"Mariam",lastName:"Ali",designation:"Operations Manager",departmentId:"D1",joiningDate:"2024-01-15",employmentType:"limited",workLocation:"Dubai",salaryPaymentMethod:"bank-transfer",bankName:"Example Bank",bankAccount:"1234567890",iban:"AE070331234567890123456",emiratesId:"784-SECRET",passportNumber:"P-SECRET",visaNumber:"V-SECRET"};
const uae={country:"AE",name:"Example Trading",legalName:"Example Trading LLC",address:"Business Bay, Dubai",logo:"data:image/png;base64,AAAA",trn:"100123456700003",tradeLicenseNumber:"DET-123",currency:"AED"};

test("professional UAE payslip reuses company logo for header and printable watermark",()=>{
  const html=renderPayslipDocument({payslip:slip,employee,company:uae,departmentName:"Operations"});
  assert.equal((html.match(/data:image\/png;base64,AAAA/g)||[]).length,2);
  assert.match(html,/class="company-logo"/);
  assert.match(html,/class="watermark"/);
  assert.match(html,/@media print[\s\S]*\.watermark\{display:block!important\}/);
  assert.match(html,/Example Trading LLC/);
  assert.match(html,/Business Bay, Dubai/);
  assert.match(html,/Trade Licence No\./);
  assert.match(html,/DET-123/);
  assert.match(html,/TRN/);
  assert.match(html,/100123456700003/);
});

test("missing company logo renders a valid payslip without logo or watermark",()=>{
  const html=renderPayslipDocument({payslip:slip,employee,company:{...uae,logo:""}});
  assert.doesNotMatch(html,/class="company-logo"/);
  assert.doesNotMatch(html,/class="watermark"/);
  assert.match(html,/class="sheet"/);
});

test("draft payslips dynamically use the latest Company Profile branding and details",()=>{
  const updated={...uae,name:"Updated Trading",legalName:"Updated Trading LLC",address:"New registered address",logo:"data:image/png;base64,NEW",trn:"100000000000009",tradeLicenseNumber:"DET-NEW"};
  const html=renderPayslipDocument({payslip:slip,employee,company:updated});
  assert.equal((html.match(/data:image\/png;base64,NEW/g)||[]).length,2);
  for(const value of ["Updated Trading LLC","New registered address","100000000000009","DET-NEW"])assert.match(html,new RegExp(value));
  assert.doesNotMatch(html,/Example Trading LLC|DET-123|100123456700003/);
});

test("finalized payslip company snapshot stays stable after Company Profile changes",()=>{
  const finalized={...slip,companyProfileSnapshot:companyPayslipSnapshot(uae)};
  const changed={...uae,legalName:"Later Name LLC",logo:"data:image/png;base64,LATER",trn:"100000000000009",tradeLicenseNumber:"DET-LATER"};
  const html=renderPayslipDocument({payslip:finalized,employee,company:changed});
  assert.equal((html.match(/data:image\/png;base64,AAAA/g)||[]).length,2);
  assert.doesNotMatch(html,/Later Name LLC|base64,LATER|DET-LATER|100000000000009/);
  assert.match(html,/Example Trading LLC/);
  assert.match(html,/DET-123/);
  assert.match(html,/100123456700003/);
});

test("employee, payment and attendance details render without sensitive identity documents",()=>{
  const html=renderPayslipDocument({payslip:slip,employee,company:uae,departmentName:"Operations"});
  for(const value of ["Mariam Ali","EMP-001","Operations Manager","Operations","2024-01-15","Dubai","208","2"])assert.match(html,new RegExp(value));
  assert.match(html,/Example Bank/);
  assert.match(html,/\*\*\*\* \*\*\*\* \*\*\*\* 7890/);
  assert.match(html,/AE\*\* \*\*\*\* \*\*\*\* 3456/);
  for(const secret of ["784-SECRET","P-SECRET","V-SECRET"])assert.doesNotMatch(html,new RegExp(secret));
});

test("earnings deductions and net values are rendered unchanged in AED",()=>{
  const html=renderPayslipDocument({payslip:slip,employee,company:uae});
  for(const amount of ["12,000.00","2,000.00","250.00","100.00","14,350.00","350.00","14,000.00"])assert.match(html,new RegExp(amount.replace(".","\\.")));
  assert.doesNotMatch(html,/-AED|-AED&nbsp;/);
  assert.equal(amountInWords(14500,"AED"),"Fourteen Thousand Five Hundred UAE Dirhams Only");
});

test("India payslips retain INR and GST while UAE excludes GST and PAN",()=>{
  const india=renderPayslipDocument({payslip:slip,employee,company:{country:"IN",legalName:"India Company Pvt Ltd",gstin:"27AAAAA0000A1Z5",pan:"AAAAA0000A",currency:"INR"}});
  const ae=renderPayslipDocument({payslip:slip,employee,company:uae});
  assert.match(india,/₹|INR/);
  assert.match(india,/GSTIN/);
  assert.match(india,/27AAAAA0000A1Z5/);
  assert.doesNotMatch(ae,/GSTIN|PAN|784-SECRET/);
  assert.match(ae,/AED/);
});

test("print controls are hidden and payslip sections avoid page splitting",()=>{
  const html=renderPayslipDocument({payslip:slip,employee,company:uae});
  assert.match(html,/\.print-controls\{display:none!important\}/);
  assert.match(html,/break-inside:avoid/);
  assert.match(html,/@page\{size:A4/);
  assert.equal(maskPaymentValue("1234567890"),"**** **** **** 7890");
});

test("HR print action uses the shared payslip renderer and current profile",()=>{
  const source=readFileSync(new URL("../src/hr-payroll/app.js",import.meta.url),"utf8");
  assert.match(source,/companyProfileSnapshot:run\?\.companyProfileSnapshot/);
  assert.match(source,/renderPayslipDocument\(\{payslip:printRecord,employee(?::employee)?,company:window\.InfoBridgeCompany\|\|\{\},departmentName(?::departmentName)?\}\)/);
});
test("payslip shows only used leave types and unpaid leave separately",()=>{const html=renderPayslipDocument({payslip:{...slip,paidLeaveDays:4,unpaidLeaveDays:1,leaveBreakdown:{Vacation:4,"Unpaid Leave":1,Medical:0}},employee,company:uae});assert.match(html,/Unpaid Leave \/ LOP/);assert.match(html,/Vacation: 4 days/);assert.match(html,/Unpaid Leave: 1 day/);assert.doesNotMatch(html,/Medical: 0/)});
