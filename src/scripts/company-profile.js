import { companyToProfile, currentUser, ensureDefaultCompany, ownedCompany, saveOwnedCompany } from "/supabase/client.js";
import { currentIndianFinancialYear, destinationAfterSetup, validateCompanyProfile } from "/auth/core.js";

if (!await currentUser()) location.replace("/login.html");

const form = document.querySelector("[data-company-form]");
const taxNumberField = form?.querySelector("[data-tax-number-field]");
const taxNumberInput = form?.elements.taxNumber;
const error = form?.querySelector("[data-company-error]");
const success = form?.querySelector("[data-company-success]");
let logo = "";

function clearMessages() {
  error.textContent = ""; error.hidden = true;
  success.textContent = "Company profile saved."; success.hidden = true;
}

function showError(message) {
  error.textContent = String(message || "").trim();
  error.hidden = !error.textContent;
}

document.querySelectorAll("[data-financial-year]").forEach((node) => { node.textContent = currentIndianFinancialYear(); });

const indiaBusinessTypes = ["Sole Proprietorship", "Partnership", "LLP", "Private Limited Company", "Public Limited Company", "One Person Company", "Other"];
const uaeBusinessTypes = ["Sole Establishment / Sole Proprietorship", "Civil Company", "Limited Liability Company (LLC)", "Single Person LLC", "Partnership", "Branch of UAE Company", "Branch of Foreign Company", "Free Zone Company", "Free Zone Establishment", "Other"];

function setOptions(select, placeholder, values, selected = "") {
  select.replaceChildren(new Option(placeholder, ""), ...values.map((value) => new Option(value, value)));
  select.value = values.includes(selected) ? selected : "";
}

function updateTaxRegistration({ clearWhenUnregistered = true } = {}) {
  const registered = form.elements.taxRegistered.value === "yes";
  taxNumberField.hidden = !registered;
  taxNumberInput.required = registered;
  if (!registered && clearWhenUnregistered) taxNumberInput.value = "";
}

function updateCountry({ preserveValues = false } = {}) {
  const country = form.elements.country.value === "AE" ? "AE" : "IN";
  const businessType = preserveValues ? form.elements.businessType.value : "";
  setOptions(form.elements.businessType, "Select business type", country === "AE" ? uaeBusinessTypes : indiaBusinessTypes, businessType);
  const indiaJurisdiction = form.querySelector("[data-india-jurisdiction]");
  const uaeJurisdiction = form.querySelector("[data-uae-jurisdiction]");
  indiaJurisdiction.hidden = country === "AE";
  uaeJurisdiction.hidden = country !== "AE";
  form.elements.state.disabled = country === "AE";
  form.elements.state.required = country !== "AE";
  form.elements.emirate.disabled = country !== "AE";
  form.elements.emirate.required = country === "AE";
  form.querySelector("[data-tax-registration-label]").textContent = country === "AE" ? "VAT Registered? *" : "GST Registered? *";
  form.querySelector("[data-tax-number-label]").textContent = country === "AE" ? "TRN *" : "GSTIN *";
  form.querySelector("[data-tax-number-hint]").textContent = country === "AE" ? "15-digit UAE Tax Registration Number." : "15-character Goods and Services Tax Identification Number.";
  taxNumberInput.placeholder = country === "AE" ? "100123456700003" : "27ABCDE1234F1Z5";
  taxNumberInput.inputMode = country === "AE" ? "numeric" : "text";
  form.querySelectorAll("[data-uae-field]").forEach((field) => { field.hidden = country !== "AE"; });
  form.querySelector("[data-default-country]").textContent = country === "AE" ? "United Arab Emirates" : "India";
  form.querySelector("[data-default-currency]").textContent = country === "AE" ? "AED" : "INR";
  form.querySelector("[data-default-tax]").textContent = country === "AE" ? "VAT" : "GST";
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
  form.elements.country.value = profile.country === "AE" ? "AE" : "IN";
  updateCountry({ preserveValues: true });
  if (profile.businessType && ![...form.elements.businessType.options].some((option) => option.value === profile.businessType)) form.elements.businessType.add(new Option(profile.businessType, profile.businessType));
  ["name", "businessType", "address", "tradeLicenseNumber", "tradeLicenseExpiryDate"].forEach((key) => { if (form.elements[key]) form.elements[key].value = profile[key] || ""; });
  if (profile.country === "AE") form.elements.emirate.value = profile.state || "";
  else form.elements.state.value = profile.state || "";
  const registered = profile.country === "AE" ? profile.vatRegistered : profile.gstRegistered;
  form.elements.taxRegistered.value = registered ? "yes" : "no";
  taxNumberInput.value = profile.country === "AE" ? profile.trn || "" : profile.gstin || "";
  logo = profile.logo || "";
  if (logo) {
    const preview = form.querySelector("[data-logo-preview]");
    preview.innerHTML = `<img src="${logo}" alt="Current company logo">`;
    preview.hidden = false;
  }
  updateTaxRegistration({ clearWhenUnregistered: false });
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
    const clean = validateCompanyProfile({ ...data, taxRegistered: data.taxRegistered === "yes", logo });
    const profile = companyToProfile(await saveOwnedCompany({ ...clean, legalName: clean.name }));
    window.InfoBridgeCompany = profile;
    document.querySelectorAll("[data-auth-company-name]").forEach((node) => { node.textContent = profile.name; });
    if (form.dataset.mode === "setup") location.replace(destinationAfterSetup(sessionStorage));
    else { success.hidden = false; success.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  } catch (cause) { showError(cause.message || "Unable to save the company profile."); }
});

form?.addEventListener("input", clearMessages);
form?.querySelector("[data-skip-company]")?.addEventListener("click", async (event) => {
  clearMessages();
  event.currentTarget.disabled = true;
  try {
    const profile = companyToProfile(await ensureDefaultCompany());
    window.InfoBridgeCompany = profile;
    location.replace(destinationAfterSetup(sessionStorage));
  } catch (cause) {
    showError(cause.message || "Unable to continue without company details.");
    event.currentTarget.disabled = false;
  }
});

fill(companyToProfile(await ownedCompany()));
if (!form.elements.businessType.options.length) updateCountry();
updateTaxRegistration({ clearWhenUnregistered: false });
