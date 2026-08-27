import { companyToProfile, currentCompany, currentUser, ownedCompany, saveOwnedCompany } from "/supabase/client.js";
import { currentIndianFinancialYear, destinationAfterSetup, validateCompanyProfile } from "/auth/core.js";
import { canEditCompanyCountry, companyProfileCountryModel } from "/company/profile.js";
import { companySecurityStatus } from "/security/client.js";

const signedInUser=await currentUser();
if (!signedInUser) location.replace("/login.html");

const form = document.querySelector("[data-company-form]");
const taxNumberField = form?.querySelector("[data-tax-number-field]");
const taxNumberInput = form?.elements.taxNumber;
const error = form?.querySelector("[data-company-error]");
const success = form?.querySelector("[data-company-success]");
let logo = "";
let activeProfile=null;

function clearMessages() {
  error.textContent = ""; error.hidden = true;
  success.textContent = "Company profile saved."; success.hidden = true;
}

function showError(message) {
  error.textContent = String(message || "").trim();
  error.hidden = !error.textContent;
}

document.querySelectorAll("[data-financial-year]").forEach((node) => { node.textContent = currentIndianFinancialYear(); });

function setOptions(select, placeholder, values, selected = "") {
  select.replaceChildren(new Option(placeholder, ""), ...values.map((value) => new Option(value, value)));
  select.value = values.includes(selected) ? selected : "";
}

function updateTaxRegistration({ clearWhenUnregistered = true } = {}) {
  const registered = form.elements.taxRegistered.value === "yes";
  taxNumberField.hidden = !registered;
  taxNumberInput.required = registered;
  taxNumberInput.disabled = !registered;
  if (!registered && clearWhenUnregistered) taxNumberInput.value = "";
}

function updateCountry({ preserveValues = false } = {}) {
  const model = companyProfileCountryModel(form.elements.country.value), country = model.code;
  const businessType = preserveValues ? form.elements.businessType.value : "";
  setOptions(form.elements.businessType, "Select business type", model.businessTypes, businessType);
  const indiaJurisdiction = form.querySelector("[data-india-jurisdiction]");
  const uaeJurisdiction = form.querySelector("[data-uae-jurisdiction]");
  indiaJurisdiction.hidden = country === "AE";
  uaeJurisdiction.hidden = country !== "AE";
  form.elements.state.disabled = country === "AE";
  form.elements.state.required = country !== "AE";
  form.elements.emirate.disabled = country !== "AE";
  form.elements.emirate.required = country === "AE";
  form.querySelector("[data-tax-registration-label]").textContent = model.taxRegistrationLabel;
  form.querySelector("[data-tax-number-label]").textContent = model.taxNumberLabel;
  form.querySelector("[data-tax-number-hint]").textContent = model.taxNumberHint;
  taxNumberInput.placeholder = model.taxNumberPlaceholder;
  taxNumberInput.inputMode = model.taxNumberInputMode;
  form.querySelectorAll("[data-uae-field]").forEach((field) => { field.hidden = !model.showTradeLicence; field.querySelectorAll("input,select,textarea").forEach(control => { control.disabled = !model.showTradeLicence; }); });
  form.querySelector("[data-default-country]").textContent = model.name;
  form.querySelector("[data-default-currency]").textContent = model.currency;
  form.querySelector("[data-default-tax]").textContent = model.taxSystem;
  if (!preserveValues) {
    form.elements.businessType.value = "";
    form.elements.state.value = "";
    form.elements.emirate.value = "";
    form.elements.taxRegistered.value = "no";
    taxNumberInput.value = "";
  }
  updateTaxRegistration();
}

function fill(profile) {
  if (!profile) return;
  const model = companyProfileCountryModel(profile);
  form.elements.country.value = model.code;
  updateCountry({ preserveValues: true });
  if (profile.businessType && ![...form.elements.businessType.options].some((option) => option.value === profile.businessType)) form.elements.businessType.add(new Option(profile.businessType, profile.businessType));
  ["name", "businessType", "address", "tradeLicenseNumber", "tradeLicenseExpiryDate"].forEach((key) => { if (form.elements[key]) form.elements[key].value = profile[key] || ""; });
  if (model.code === "AE") form.elements.emirate.value = profile.state || "";
  else form.elements.state.value = profile.state || "";
  const registered = model.code === "AE" ? profile.vatRegistered : profile.gstRegistered;
  form.elements.taxRegistered.value = registered ? "yes" : "no";
  taxNumberInput.value = model.code === "AE" ? profile.trn || "" : profile.gstin || "";
  logo = profile.logo || "";
  if (logo) {
    const preview = form.querySelector("[data-logo-preview]");
    preview.innerHTML = `<img src="${logo}" alt="Current company logo">`;
    preview.hidden = false;
  }
  updateTaxRegistration({ clearWhenUnregistered: false });
  const editable = canEditCompanyCountry(profile);
  form.elements.country.disabled = !editable;
  form.querySelector("[data-country-lock-hint]").hidden = editable;
  const securityLink=form.querySelector("[data-company-security]");if(securityLink)securityLink.hidden=profile.ownerId!==signedInUser?.id;
  if(profile.ownerId!==signedInUser?.id){form.querySelectorAll("input,select,textarea,button[type='submit']").forEach(control=>control.disabled=true);success.textContent="Company Profile is owner-managed. Your Company Admin access remains active.";success.hidden=false}
}

form?.elements.country?.addEventListener("change", () => updateCountry());
form?.querySelectorAll('[name="taxRegistered"]').forEach((input) => input.addEventListener("change", updateTaxRegistration));
form?.elements.logoFile?.addEventListener("change", (event) => {
  clearMessages();
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 1024 * 1024) { showError("Choose a logo smaller than 1 MB."); event.target.value = ""; return; }
  const reader = new FileReader();
  reader.addEventListener("load", () => { logo = String(reader.result || ""); const preview = form.querySelector("[data-logo-preview]"); preview.innerHTML = `<img src="${logo}" alt="Selected company logo">`; preview.hidden = false; });
  reader.readAsDataURL(file);
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault(); clearMessages();
  try {
    const data = Object.fromEntries(new FormData(form));
    data.country = form.elements.country.value;
    const clean = validateCompanyProfile({ ...data, taxRegistered: data.taxRegistered === "yes", logo });
    const profile = companyToProfile(await saveOwnedCompany({ ...clean, legalName: clean.name }));
    window.InfoBridgeCompany = profile;
    document.querySelectorAll("[data-auth-company-name]").forEach((node) => { node.textContent = profile.name; });
    if (form.dataset.mode === "setup") {
      let masterKeyRequired = true;
      try { masterKeyRequired = !(await companySecurityStatus(profile.companyId)).masterConfigured; } catch { /* fresh company: keep the mandatory Master Key step */ }
      location.replace(masterKeyRequired ? "/company-security.html" : destinationAfterSetup(sessionStorage));
    }
    else { success.hidden = false; success.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  } catch (cause) { showError(cause.message || "Unable to save the company profile."); }
});

form?.addEventListener("input", clearMessages);

activeProfile=companyToProfile(await currentCompany());fill(activeProfile);
if (!form.elements.businessType.options.length) updateCountry();
updateTaxRegistration({ clearWhenUnregistered: false });
