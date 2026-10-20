import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INTENDED_KEY, currentIndianFinancialYear, destinationAfterSetup, getLastWorkspace, isProtectedRoute, isPublicToolRoute, normalizePath, profileDisplayName, readableEmailName, saveIntendedDestination, setLastWorkspace, validateCompanyProfile } from "../src/auth/core.js";
import { companyToProfile } from "../src/supabase/client.js";

class MemoryStorage { constructor() { this.values = new Map(); } getItem(key) { return this.values.get(key) ?? null; } setItem(key, value) { this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); } }

test("protected routes include every private business workspace but exclude public GST", () => {
  for (const route of ["/app/finance.html", "/app/sales.html", "/app/purchases.html", "/inventory/index.html", "/hr-payroll/index.html", "/app/projects.html", "/app/documents.html", "/app/approvals.html", "/app/banking.html", "/app/reports.html", "/app/admin.html"]) assert.equal(isProtectedRoute(route), true, route);
  for (const route of ["/app/gst/index.html", "/app/gst/gstr-1.html"]) assert.equal(isProtectedRoute(route), false, route);
});
test("company setup always returns to the main page", () => { const storage = new MemoryStorage(); saveIntendedDestination("/app/reports.html?range=fy#profit", storage); setLastWorkspace("/app/banking.html", storage); assert.equal(destinationAfterSetup(storage), "/index.html"); assert.equal(storage.getItem(INTENDED_KEY), null); });
test("external and protocol-relative destinations are rejected", () => { assert.equal(normalizePath("https://evil.example/app/finance.html"), ""); assert.equal(normalizePath("//evil.example/app/finance.html"), ""); });
test("last workspace is company-session temporary navigation state", () => { const storage = new MemoryStorage(); setLastWorkspace("/app/banking.html", storage); assert.equal(getLastWorkspace(storage), "/app/banking.html"); });
test("public tools and GST Workspace remain public", () => { for (const route of ["/gst-calculator.html", "/app/gst/index.html", "/app/gst/gstr-1.html"]) assert.equal(isPublicToolRoute(route), true, route); });
test("company defaults remain India focused", () => { const profile = validateCompanyProfile({ name: "A", businessType: "Partnership", state: "Kerala", gstRegistered: false }); assert.deepEqual([profile.currency, profile.dateFormat, profile.financialYear, profile.invoicePrefix, profile.quotationPrefix], ["INR", "DD/MM/YYYY", currentIndianFinancialYear(), "INV", "QUO"]); });
test("registered companies require a valid GSTIN", () => assert.throws(() => validateCompanyProfile({ name: "A", businessType: "Other", state: "Delhi", gstRegistered: true, gstin: "BAD" }), /valid GSTIN/));
test("new India companies use explicit GST and INR defaults", () => {
  const profile = validateCompanyProfile({ country: "IN", name: "India Co", businessType: "LLP", state: "Kerala", taxRegistered: false });
  assert.deepEqual([profile.country, profile.taxSystem, profile.currency, profile.gstRegistered, profile.gstin, profile.vatRegistered], ["IN", "GST", "INR", false, "", false]);
});
test("India GST registration controls GSTIN validation and storage", () => {
  const registered = validateCompanyProfile({ country: "IN", name: "India Co", businessType: "Partnership", state: "Delhi", taxRegistered: true, taxNumber: "27ABCDE1234F1Z5" });
  assert.deepEqual([registered.gstRegistered, registered.gstin, registered.taxNumber], [true, "27ABCDE1234F1Z5", "27ABCDE1234F1Z5"]);
  const unregistered = validateCompanyProfile({ country: "IN", name: "India Co", businessType: "Other", state: "Delhi", taxRegistered: false, taxNumber: "27ABCDE1234F1Z5" });
  assert.deepEqual([unregistered.gstRegistered, unregistered.gstin, unregistered.taxNumber], [false, "", ""]);
});
test("new UAE companies use explicit VAT and AED defaults", () => {
  const profile = validateCompanyProfile({ country: "AE", name: "Dubai Co", businessType: "Limited Liability Company (LLC)", emirate: "Dubai", taxRegistered: false, tradeLicenseNumber: "DED-123", tradeLicenseExpiryDate: "2027-01-31" });
  assert.deepEqual([profile.country, profile.taxSystem, profile.currency, profile.vatRegistered, profile.trn, profile.tradeLicenseNumber], ["AE", "VAT", "AED", false, "", "DED-123"]);
});
test("UAE VAT registration requires an exact 15-digit TRN", () => {
  assert.throws(() => validateCompanyProfile({ country: "AE", name: "Dubai Co", businessType: "Other", emirate: "Dubai", taxRegistered: true, taxNumber: "123" }), /15 digits/);
  const profile = validateCompanyProfile({ country: "AE", name: "Dubai Co", businessType: "Other", emirate: "Dubai", taxRegistered: true, taxNumber: "100123456700003" });
  assert.deepEqual([profile.vatRegistered, profile.trn, profile.taxNumber, profile.gstin], [true, "100123456700003", "100123456700003", ""]);
});
test("UAE requires emirate and ignores an empty or stale India state", () => {
  const profile = validateCompanyProfile({ country: "AE", name: "Dubai Co", businessType: "Other", state: "", emirate: "Dubai", taxRegistered: false });
  assert.equal(profile.state, "Dubai");
  assert.throws(() => validateCompanyProfile({ country: "AE", name: "Dubai Co", businessType: "Other", state: "Kerala", emirate: "", taxRegistered: false }), /Select an emirate/);
});
test("India requires state and never uses a hidden UAE emirate", () => {
  const profile = validateCompanyProfile({ country: "IN", name: "India Co", businessType: "Other", state: "Kerala", emirate: "Dubai", taxRegistered: false });
  assert.equal(profile.state, "Kerala");
  assert.throws(() => validateCompanyProfile({ country: "IN", name: "India Co", businessType: "Other", state: "", emirate: "Dubai", taxRegistered: false }), /Select a state or union territory/);
});
test("UAE non-VAT companies discard a stale TRN", () => {
  const profile = validateCompanyProfile({ country: "AE", name: "Dubai Co", businessType: "Other", emirate: "Ajman", taxRegistered: false, taxNumber: "100123456700003" });
  assert.deepEqual([profile.vatRegistered, profile.trn, profile.taxNumber], [false, "", ""]);
});
test("saved UAE profiles reload with country-specific tax and licence data", () => {
  const profile = companyToProfile({ id: "C1", owner_id: "U1", name: "Dubai Co", legal_name: "Dubai Co LLC", business_type: "Limited Liability Company (LLC)", state: "Dubai", country: "AE", vat_registered: true, trn: "100123456700003", trade_license_number: "DED-123", trade_license_expiry_date: "2027-01-31", tax_system: "VAT", tax_number: "100123456700003", currency: "AED" });
  assert.deepEqual([profile.country, profile.state, profile.vatRegistered, profile.trn, profile.tradeLicenseNumber, profile.currency], ["AE", "Dubai", true, "100123456700003", "DED-123", "AED"]);
});
test("stored currency and tax conflicts resolve from saved company country without rewriting the row", () => {
  const row={id:"C1",owner_id:"U1",name:"Dubai Co",business_type:"Other",state:"Dubai",country:"UAE",currency:"INR",tax_system:"GST",profile_complete:true};
  const profile=companyToProfile(row);
  assert.deepEqual([profile.country,profile.currency,profile.taxSystem],["AE","AED","VAT"]);
  assert.deepEqual([row.country,row.currency,row.tax_system],["UAE","INR","GST"]);
});
test("legacy profiles without a country remain India GST profiles", () => {
  const profile = companyToProfile({ id: "C1", owner_id: "U1", name: "Legacy", legal_name: "Legacy", business_type: "Limited liability partnership", state: "Kerala", gst_registered: true, gstin: "27ABCDE1234F1Z5", currency: "INR" });
  assert.deepEqual([profile.country, profile.taxSystem, profile.taxNumber, profile.gstRegistered, profile.gstin, profile.businessType], ["IN", "GST", "27ABCDE1234F1Z5", true, "27ABCDE1234F1Z5", "Limited liability partnership"]);
  assert.match(readFileSync(new URL("../src/scripts/company-profile.js", import.meta.url), "utf8"), /businessType\.add\(new Option\(profile\.businessType/);
});
test("country switching updates business, jurisdiction, tax labels and workspace defaults", () => {
  const page = readFileSync(new URL("../src/pages/marketing/company.js", import.meta.url), "utf8");
  const script = readFileSync(new URL("../src/scripts/company-profile.js", import.meta.url), "utf8");
  assert.match(page, /name="country" required/);
  assert.match(page, /name="state" required/);
  assert.match(page, /name="emirate" disabled/);
  assert.match(page, /supportedCountryOptions\(\)/);
  assert.match(page, /countryRegistry\.AE\.jurisdictions/);
  assert.match(page, /Trade Licence Number/);
  assert.match(script, /companyProfileCountryModel\(form\.elements\.country\.value\)/);
  assert.match(script, /data-default-currency/);
  assert.match(script, /model\.taxNumberLabel/);
  assert.match(page, /data-uae-label="VAT Registered\? \*"/);
  assert.match(page, /data-uae-label="TRN \*"/);
  assert.match(page, /company-profile\.js\?v=20260824-country-profile/);
  assert.match(script, /form\.elements\.state\.disabled = country === "AE"/);
  assert.match(script, /form\.elements\.emirate\.required = country === "AE"/);
  assert.match(script, /control\.disabled = !model\.showTradeLicence/);
  assert.match(script, /data\.country = form\.elements\.country\.value/);
});
test("email login and signup call Supabase Auth methods", () => { const source = readFileSync(new URL("../src/scripts/auth-ui.js", import.meta.url), "utf8"); assert.match(source, /auth\.signUp\(/); assert.match(source, /auth\.signInWithPassword\(/); });
test("password recovery uses the production reset route and updates through Supabase", () => {
  const auth = readFileSync(new URL("../src/scripts/auth-ui.js", import.meta.url), "utf8");
  const reset = readFileSync(new URL("../src/scripts/reset-password.js", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/pages/marketing/login.js", import.meta.url), "utf8");
  assert.match(page, /data-forgot-password/);
  assert.match(page, /<button type="button" data-forgot-password/);
  assert.doesNotMatch(page, /href="#"[^>]*Forgot password/);
  assert.match(page, /auth-ui\.js\?v=20260823-password-recovery/);
  assert.match(auth, /auth\.resetPasswordForEmail\(email/);
  assert.match(auth, /https:\/\/infobridgeindia\.online\/reset-password\.html/);
  assert.match(reset, /auth\.getSession\(\)/);
  assert.match(reset, /auth\.updateUser\(\{ password \}\)/);
});
test("Google uses Supabase OAuth without a fake session", () => { const source = readFileSync(new URL("../src/scripts/auth-ui.js", import.meta.url), "utf8"); assert.match(source, /auth\.signInWithOAuth\(\{ provider: "google"/); assert.doesNotMatch(source, /startSession/); });
test("logout uses Supabase signOut", () => { const source = readFileSync(new URL("../src/scripts/auth-gate.js", import.meta.url), "utf8"); assert.match(source, /auth\.signOut\(\{ scope: "local" \}\)/); });
test("shared header initializes after a late session check and follows auth changes", () => {
  const source = readFileSync(new URL("../src/scripts/auth-gate.js", import.meta.url), "utf8");
  assert.match(source, /document\.readyState === "loading"/);
  assert.match(source, /auth\.onAuthStateChange/);
  assert.match(source, /renderHeaderState\(null, null\)/);
  assert.match(source, /location\.replace\(HOME_ROUTE\)/);
});
test("shared profile dropdown exposes identity, company and one centralized logout", () => {
  const layout = readFileSync(new URL("../src/components/layout.js", import.meta.url), "utf8");
  assert.match(layout, /data-auth-display-name/);
  assert.match(layout, /data-auth-email/);
  assert.match(layout, /data-auth-company-detail/);
  assert.match(layout, />Company Profile</);
  assert.match(layout, /data-auth-logout[^>]*>Log out/);
});
test("profile identity prefers company, then metadata, then readable email", () => {
  const user = { email: "mohamed.khan@example.com", user_metadata: { full_name: "Mohamed K" } };
  assert.equal(profileDisplayName({ name: "Khan Traders" }, user), "Khan Traders");
  assert.equal(profileDisplayName(null, user), "Mohamed K");
  assert.equal(profileDisplayName(null, { email: user.email, user_metadata: {} }), "Mohamed Khan");
  assert.equal(readableEmailName("first_last@example.com"), "First Last");
});
test("signup requires matching password confirmation and uses verification return", () => {
  const source = readFileSync(new URL("../src/scripts/auth-ui.js", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/pages/marketing/login.js", import.meta.url), "utf8");
  assert.match(page, /name="confirmPassword"/);
  assert.match(source, /password !== form\.elements\.confirmPassword\.value/);
  assert.match(source, /login\.html\?verified=1/);
  assert.match(source, /location\.replace\("\/login\.html\?accountCreated=1"\)/);
  assert.match(source, /Please confirm your email address before logging in\./);
});
test("authenticated routing and setup always resolve to the main page", () => {
  const gate = readFileSync(new URL("../src/scripts/auth-gate.js", import.meta.url), "utf8");
  const company = readFileSync(new URL("../src/scripts/company-profile.js", import.meta.url), "utf8");
  assert.match(gate, /profile \? destinationAfterAuth\(temporary\) : "\/company-setup\.html"/);
  assert.match(company, /destinationAfterSetup\(sessionStorage\)/);
  assert.match(readFileSync(new URL("../src/auth/core.js", import.meta.url), "utf8"), /consumeIntendedDestination\(storage\); return HOME_ROUTE/);
  assert.match(gate, /location\.replace\("\/login\.html"\)/);
});
test("company setup can be skipped into one incomplete owner workspace", () => {
  const page = readFileSync(new URL("../src/pages/marketing/company.js", import.meta.url), "utf8");
  const script = readFileSync(new URL("../src/scripts/company-profile.js", import.meta.url), "utf8");
  const client = readFileSync(new URL("../src/supabase/client.js", import.meta.url), "utf8");
  assert.match(page, /data-skip-company>Skip for now/);
  assert.match(script, /ensureDefaultCompany\(\)/);
  assert.match(client, /if \(existing\) return existing/);
  assert.match(client, /profileComplete: false/);
});
test("empty auth and company banners remain hidden", () => {
  const styles = readFileSync(new URL("../src/styles/components.css", import.meta.url), "utf8");
  const company = readFileSync(new URL("../src/scripts/company-profile.js", import.meta.url), "utf8");
  const auth = readFileSync(new URL("../src/scripts/auth-ui.js", import.meta.url), "utf8");
  assert.match(styles, /\.banner\[hidden\]/);
  assert.match(company, /error\.textContent = ""; error\.hidden = true/);
  assert.match(auth, /errorBox\.textContent = ""; errorBox\.hidden = true/);
});
test("HR seeds settings from the authenticated main company instead of blocking onboarding", () => {
  const source = readFileSync(new URL("../src/hr-payroll/app.js", import.meta.url), "utf8");
  assert.match(source, /window\.InfoBridgeCompany/);
  assert.match(source, /companyId:company\.companyId/);
  assert.match(source, /await ensureHrSettings\(\);await repairStoredDraftPayrollPeriods\(\);render\(\)/);
});
test("HR startup uses the built department asset and always has a bounded failure exit", () => {
  const source = readFileSync(new URL("../src/hr-payroll/app.js", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/pages/app/hr-payroll-workspace.js", import.meta.url), "utf8");
  assert.match(source, /\/administration-workspace\/departments\.js/);
  assert.match(source, /async function openDb\(\)\{store=await createWorkspaceStore\("hr-payroll"\)\}/);
  assert.doesNotMatch(source, /Promise\.race\(\[createWorkspaceStore\("hr-payroll"\)/);
  assert.match(page, /InfoBridgeHrBootTimer/);
  assert.match(page, />Retry</);
  assert.match(page, />Back to main page</);
});
test("retired Products route builds only an immediate home redirect", () => {
  const build = readFileSync(new URL("../build.js", import.meta.url), "utf8");
  assert.doesNotMatch(build, /productsOverviewPage/);
  assert.match(build, /writeRoute\("\/products\.html"/);
  assert.match(build, /window\.location\.replace\("\/index\.html"\)/);
});
