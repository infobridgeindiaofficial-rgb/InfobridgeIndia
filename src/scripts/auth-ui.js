import { currentCompany, isSupabaseConfigured, requireSupabase } from "/supabase/client.js";
import { destinationAfterAuth } from "/auth/core.js";

const form = document.querySelector("[data-local-auth-form]");
const errorBox = document.querySelector("[data-auth-error]");
const successBox = document.querySelector("[data-auth-success]");
const loginPanel = document.querySelector("[data-login-panel]");
const recoveryPanel = document.querySelector("[data-recovery-panel]");
const recoveryForm = document.querySelector("[data-recovery-form]");
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
const invitationToken=notice.get("invite")||"";
const memberInvitationToken=notice.get("memberInvite")||"";
const invitationDestination=invitationToken?`/company-admin-invite.html?token=${encodeURIComponent(invitationToken)}`:memberInvitationToken?`/company-member-invite.html?token=${encodeURIComponent(memberInvitationToken)}`:"";
const invitationQuery=invitationToken?`invite=${encodeURIComponent(invitationToken)}`:memberInvitationToken?`memberInvite=${encodeURIComponent(memberInvitationToken)}`:"";
if(invitationQuery){document.querySelectorAll('a[href="/login.html"],a[href="/signup.html"]').forEach(link=>{link.href=`${link.getAttribute("href")}?${invitationQuery}`})}
if (successBox && notice.get("accountCreated") === "1") {
  successBox.textContent = "Account created. Check your email to confirm your address, then log in.";
  successBox.hidden = false;
} else if (successBox && notice.get("verified") === "1") {
  successBox.textContent = "Your email is verified. Log in with your email and password.";
  successBox.hidden = false;
} else if (successBox && notice.get("passwordReset") === "1") {
  successBox.textContent = "Your password was changed successfully. Log in with your new password.";
  successBox.hidden = false;
}

form?.addEventListener("input", clearMessages);

document.querySelector("[data-forgot-password]")?.addEventListener("click", (event) => {
  event.preventDefault();
  clearMessages();
  recoveryForm.elements.email.value = form.elements.email.value.trim();
  loginPanel.hidden = true;
  recoveryPanel.hidden = false;
  recoveryForm.elements.email.focus();
});

document.querySelector("[data-back-to-login]")?.addEventListener("click", () => {
  recoveryPanel.hidden = true;
  loginPanel.hidden = false;
  form.elements.email.focus();
});

recoveryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = recoveryForm.querySelector("[data-recovery-error]");
  const success = recoveryForm.querySelector("[data-recovery-success]");
  const submit = recoveryForm.querySelector('[type="submit"]');
  error.hidden = true; success.hidden = true; submit.disabled = true;
  try {
    if (!isSupabaseConfigured) throw new Error("Authentication is not configured yet.");
    const email = recoveryForm.elements.email.value.trim();
    if (!email || !recoveryForm.elements.email.checkValidity()) throw new Error("Enter a valid email address.");
    const { error: recoveryError } = await requireSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: "https://infobridgeindia.online/reset-password.html",
    });
    if (recoveryError) throw recoveryError;
    success.textContent = "If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.";
    success.hidden = false;
  } catch (cause) {
    error.textContent = cause.message || "Unable to send the reset email. Please try again.";
    error.hidden = false;
  } finally { submit.disabled = false; }
});

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
      ? await client.auth.signUp({ email, password, options: { emailRedirectTo: new URL(invitationDestination||"/login.html?verified=1", location.origin).href } })
      : await client.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    form.elements.password.value = "";
    if (signup) {
      if (result.data.session) await client.auth.signOut({ scope: "local" });
      if(invitationDestination)location.replace(invitationDestination);else location.replace("/login.html?accountCreated=1");
      return;
    }
    const company = await currentCompany();
    location.replace(invitationDestination||(company ? destinationAfterAuth(sessionStorage) : "/company-setup.html"));
  } catch (cause) {
    const message = /email.*not.*confirm|not.*confirm.*email/i.test(cause.message || "")
      ? "Please confirm your email address before logging in."
      : cause.message || "Authentication failed.";
    showError(message);
  }
  finally { submit.disabled = false; }
});
