import { isSupabaseConfigured, requireSupabase } from "/supabase/client.js";

const form = document.querySelector("[data-reset-password-form]");
const intro = document.querySelector("[data-reset-intro]");
const errorBox = document.querySelector("[data-reset-error]");
const successBox = document.querySelector("[data-reset-success]");
const loginLink = document.querySelector("[data-reset-login]");
const client = isSupabaseConfigured ? requireSupabase() : null;

function showLinkError(message) {
  intro.textContent = message;
  intro.style.color = "var(--danger-600)";
  loginLink.hidden = false;
}

async function initializeRecovery() {
  if (!client) return showLinkError("Authentication is not configured yet.");
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const linkError = params.get("error_description") || hash.get("error_description");
  if (linkError) return showLinkError(decodeURIComponent(linkError.replace(/\+/g, " ")));

  const { data, error } = await client.auth.getSession();
  if (error || !data.session) return showLinkError("This password reset link is invalid or has expired. Request a new link from the login page.");
  history.replaceState(null, "", location.pathname);
  intro.textContent = "Enter and confirm your new password.";
  form.hidden = false;
  form.elements.password.focus();
}

form.addEventListener("input", () => { errorBox.hidden = true; errorBox.textContent = ""; });
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true; successBox.hidden = true;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    const password = form.elements.password.value;
    const confirmation = form.elements.confirmPassword.value;
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    if (password !== confirmation) throw new Error("Passwords do not match.");
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    await client.auth.signOut({ scope: "local" });
    form.elements.password.value = ""; form.elements.confirmPassword.value = "";
    successBox.textContent = "Your password has been changed successfully. You can now log in with your new password.";
    successBox.hidden = false; submit.hidden = true; loginLink.hidden = false;
    setTimeout(() => location.replace("/login.html?passwordReset=1"), 2500);
  } catch (cause) {
    errorBox.textContent = cause.message || "Unable to update your password. Please request a new reset link.";
    errorBox.hidden = false;
  } finally { submit.disabled = false; }
});

initializeRecovery().catch(() => showLinkError("Unable to verify this reset link. Please request a new one."));
