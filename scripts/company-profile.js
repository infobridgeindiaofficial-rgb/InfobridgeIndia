import { companyToProfile, currentUser, ensureDefaultCompany, ownedCompany, saveOwnedCompany } from "/supabase/client.js";
import { currentIndianFinancialYear, destinationAfterSetup, validateCompanyProfile } from "/auth/core.js";

if (!await currentUser()) location.replace("/login.html");

const form = document.querySelector("[data-company-form]");
const gstinField = form?.querySelector("[data-gstin-field]");
const gstinInput = form?.elements.gstin;
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

function updateGst() {
  const registered = form.elements.gstRegistered.value === "yes";
  gstinField.hidden = !registered;
  gstinInput.required = registered;
  if (!registered) gstinInput.value = "";
}

function fill(profile) {
  if (!profile) return;
  ["name", "businessType", "state", "gstin", "address"].forEach((key) => { if (form.elements[key]) form.elements[key].value = profile[key] || ""; });
  form.elements.gstRegistered.value = profile.gstRegistered ? "yes" : "no";
  logo = profile.logo || "";
  if (logo) {
    const preview = form.querySelector("[data-logo-preview]");
    preview.innerHTML = `<img src="${logo}" alt="Current company logo">`;
    preview.hidden = false;
  }
  updateGst();
}

form?.querySelectorAll('[name="gstRegistered"]').forEach((input) => input.addEventListener("change", updateGst));
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
    const clean = validateCompanyProfile({ ...data, gstRegistered: data.gstRegistered === "yes", logo });
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
updateGst();
