import { breadcrumbs } from "../../components/layout.js";

const states = ["Andaman and Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chandigarh","Chhattisgarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka","Kerala","Ladakh","Lakshadweep","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Puducherry","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"];
const emirates = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];
const indiaBusinessTypes = ["Sole Proprietorship","Partnership","LLP","Private Limited Company","Public Limited Company","One Person Company","Other"];

function companyForm(isSetup) {
  return `<section class="section section-sm"><div class="container company-form-shell">
    ${breadcrumbs([{ label: "Home", href: "/index.html" }, { label: isSetup ? "Company setup" : "Company Profile" }])}
    <div class="section-head" style="margin-top:var(--sp-6);"><span class="eyebrow">${isSetup ? "Quick setup" : "Business settings"}</span><h1 class="h-2">${isSetup ? "Set up your company" : "Company Profile"}</h1><p>${isSetup ? "Add the essentials once so every workspace can use the same company details." : "Review and update the company details shared across your InfoBridgeIndia workspaces."}</p></div>
    <form class="card card-pad-lg stack-6" data-company-form data-mode="${isSetup ? "setup" : "profile"}" novalidate>
      <div class="form-grid">
        <div class="field full"><label for="company-country">Country *</label><select class="input" id="company-country" name="country" required><option value="IN">India</option><option value="AE">United Arab Emirates (UAE)</option></select></div>
        <div class="field"><label for="company-name">Company name *</label><input class="input" id="company-name" name="name" autocomplete="organization" required></div>
        <div class="field"><label for="business-type">Business type *</label><select class="input" id="business-type" name="businessType" required><option value="">Select business type</option>${indiaBusinessTypes.map((type) => `<option>${type}</option>`).join("")}</select></div>
        <div class="field" data-india-jurisdiction><label for="company-state">State or Union Territory *</label><select class="input" id="company-state" name="state" required><option value="">Select state or union territory</option>${states.map((state) => `<option>${state}</option>`).join("")}</select></div>
        <div class="field" data-uae-jurisdiction hidden><label for="company-emirate">Emirate *</label><select class="input" id="company-emirate" name="emirate" disabled><option value="">Select emirate</option>${emirates.map((emirate) => `<option>${emirate}</option>`).join("")}</select></div>
        <fieldset class="field company-fieldset"><legend data-tax-registration-label data-india-label="GST Registered? *" data-uae-label="VAT Registered? *">GST Registered? *</legend><div class="row-gap-4"><label class="checkbox-row"><input type="radio" name="taxRegistered" value="yes"> Yes</label><label class="checkbox-row"><input type="radio" name="taxRegistered" value="no" checked> No</label></div></fieldset>
        <div class="field full" data-tax-number-field hidden><label for="company-tax-number" data-tax-number-label data-india-label="GSTIN *" data-uae-label="TRN *">GSTIN *</label><input class="input" id="company-tax-number" name="taxNumber" maxlength="15" autocomplete="off" placeholder="27ABCDE1234F1Z5"><span class="hint" data-tax-number-hint>15-character Goods and Services Tax Identification Number.</span></div>
        <div class="field" data-uae-field hidden><label for="trade-license-number">Trade Licence Number</label><input class="input" id="trade-license-number" name="tradeLicenseNumber" autocomplete="off"></div>
        <div class="field" data-uae-field hidden><label for="trade-license-expiry">Trade Licence Expiry Date</label><input class="input" id="trade-license-expiry" name="tradeLicenseExpiryDate" type="date"></div>
        <div class="field full"><label for="company-address">Business address <span class="text-muted">(optional)</span></label><textarea class="input" id="company-address" name="address" autocomplete="street-address"></textarea></div>
        <div class="field full"><label for="company-logo">Company logo <span class="text-muted">(optional)</span></label><input class="input company-file" id="company-logo" name="logoFile" type="file" accept="image/png,image/jpeg,image/webp"><span class="hint">PNG, JPG or WebP, up to 1 MB. Stored only in this browser.</span><div class="company-logo-preview" data-logo-preview hidden></div></div>
      </div>
      <div><div class="form-section-title">Workspace defaults</div><div class="company-defaults"><span>Country <strong data-default-country>India</strong></span><span>Currency <strong data-default-currency>INR</strong></span><span>Tax system <strong data-default-tax>GST</strong></span><span>Date format <strong>DD/MM/YYYY</strong></span><span>Financial year <strong data-financial-year></strong></span><span>Invoice prefix <strong>INV</strong></span><span>Quotation prefix <strong>QUO</strong></span></div></div>
      <div class="banner banner-danger" data-company-error hidden></div><div class="banner banner-success" data-company-success hidden>Company profile saved.</div>
      <div class="row-gap-3"><button class="btn btn-primary" type="submit">${isSetup ? "Save and continue" : "Save changes"}</button>${isSetup ? '<button class="btn btn-secondary" type="button" data-skip-company>Skip for now</button>' : '<a class="btn btn-secondary" href="/index.html">Cancel</a>'}</div>
    </form>
  </div></section><script type="module" src="/scripts/company-profile.js?v=20260823-india-uae"></script>`;
}

export const companySetupPage = () => ({ route: "/company-setup.html", title: "Company setup", description: "Set up the company profile shared by InfoBridgeIndia workspaces.", active: "", body: companyForm(true) });
export const companyProfilePage = () => ({ route: "/company-profile.html", title: "Company Profile", description: "Manage the company profile shared by InfoBridgeIndia workspaces.", active: "", body: companyForm(false) });
