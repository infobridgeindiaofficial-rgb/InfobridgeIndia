import { isSupabaseConfigured, ownedCompany, requireSupabase } from "/supabase/client.js";
import { destinationAfterAuth } from "/auth/core.js";

const form = document.querySelector("[data-local-auth-form]");
const errorBox = document.querySelector("[data-auth-error]");
const successBox = document.querySelector("[data-auth-success]");
const clearMessages = () => {
  if (errorBox) { errorBox.textContent = ""; errorBox.hidden = true; }
  if (successBox) { successBox.textContent = ""; successBox.hidden = true; }
};
const showError = (message) => {
  if (!errorBox) return;
  errorBox.textContent = String(message || "").trim();
  errorBox.hidden = !errorBox.textContent;
};

const notice = new URLSearchParams(location.search);
if (successBox && notice.get("accountCreated") === "1") {
  successBox.textContent = "Account created. Check your email to confirm your address, then log in.";
  successBox.hidden = false;
} else if (successBox && notice.get("verified") === "1") {
  successBox.textContent = "Your email is verified. Log in with your email and password.";
  successBox.hidden = false;
}

form?.addEventListener("input", clearMessages);

document.querySelector("[data-google-auth]")?.addEventListener("click", async () => {
  clearMessages();
  try {
    if (!isSupabaseConfigured) throw new Error("Authentication is not configured yet.");
    const { error } = await requireSupabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: new URL("/login.html", location.origin).href } });
    if (error) throw error;
  } catch (cause) { showError(cause.message); }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessages();
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    if (!isSupabaseConfigured) throw new Error("Authentication is not configured yet.");
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (!email || !password) throw new Error("Enter your email address and password.");
    const client = requireSupabase();
    const signup = location.pathname === "/signup.html";
    if (signup && password !== form.elements.confirmPassword.value) throw new Error("Passwords do not match.");
    const result = signup
      ? await client.auth.signUp({ email, password, options: { emailRedirectTo: new URL("/login.html?verified=1", location.origin).href } })
      : await client.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    form.elements.password.value = "";
    if (signup) {
      if (result.data.session) await client.auth.signOut({ scope: "local" });
      location.replace("/login.html?accountCreated=1");
      return;
    }
    const company = await ownedCompany();
    location.replace(company ? destinationAfterAuth(sessionStorage) : "/company-setup.html");
  } catch (cause) {
    const message = /email.*not.*confirm|not.*confirm.*email/i.test(cause.message || "")
      ? "Please confirm your email address before logging in."
      : cause.message || "Authentication failed.";
    showError(message);
  }
  finally { submit.disabled = false; }
});
