import { renderHead } from "../../components/layout.js";

const googleIcon = `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 01-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 01-5.5-4H3.2v2.6A10 10 0 0012 22z"/><path fill="#FBBC05" d="M6.5 14a6 6 0 010-3.9V7.5H3.2a10 10 0 000 9.1L6.5 14z"/><path fill="#EA4335" d="M12 6.1c1.6 0 3 .5 4.1 1.6l3-3A10 10 0 003.2 7.5l3.3 2.6A5.8 5.8 0 0112 6z"/></svg>`;

const authStyles = `<style>
body{background:var(--surface-50)}
.auth-form-card [hidden]{display:none!important}
.auth-form-card{width:100%;max-width:430px}
.auth-heading{text-align:center}
.auth-heading p{margin-top:6px}
.auth-logo{display:flex;align-items:center;justify-content:center}
.auth-logo img{display:block;width:auto;height:54px;max-width:230px;object-fit:contain}
.login-logo-wrap{display:flex;justify-content:center;margin-bottom:var(--sp-7)}
.login-logo-surface{padding:8px 14px;border-radius:var(--r-md);background:var(--ink-950)}
.auth-options{margin-top:var(--sp-6)}
.auth-divider{display:flex;align-items:center;gap:var(--sp-3);color:var(--ink-300);font-size:var(--fs-12);text-transform:lowercase}
.auth-divider:before,.auth-divider:after{content:"";height:1px;flex:1;background:var(--border)}
.google-auth{position:relative}
.google-auth svg{position:absolute;left:var(--sp-5)}
.auth-text-button{appearance:none;border:0;background:none;padding:0;cursor:pointer;font:inherit}
.login-shell{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:var(--sp-8) var(--sp-5)}
.signup-shell{min-height:100vh;display:grid;grid-template-columns:minmax(360px,1fr) 1fr}
.signup-side{background:radial-gradient(1000px 600px at 10% 0%,#12352d 0%,var(--ink-950) 45%),var(--ink-950);color:#fff;padding:var(--sp-16);display:flex;flex-direction:column;justify-content:space-between}
.signup-side .auth-logo{justify-content:flex-start}
.signup-side .auth-logo img{height:58px;max-width:250px}
.signup-side h2{color:#fff;margin-top:14px;max-width:440px}
.signup-side p{color:rgba(255,255,255,.68);margin-top:16px;max-width:440px}
.signup-form-wrap{display:flex;align-items:center;justify-content:center;padding:var(--sp-10)}
@media(max-width:860px){.signup-shell{grid-template-columns:1fr}.signup-side{padding:var(--sp-7) var(--sp-6)}.signup-side>div:not(:first-child){display:none}.signup-side .auth-logo{justify-content:center}.signup-form-wrap{padding:var(--sp-8) var(--sp-5)}}
@media(max-width:480px){.login-shell{align-items:flex-start;padding-top:var(--sp-8)}.auth-form-card{padding:var(--sp-6)}.signup-form-wrap{padding:var(--sp-6) var(--sp-4)}.signup-side{padding:var(--sp-5)}.auth-logo img,.signup-side .auth-logo img{height:48px;max-width:210px}}
</style>`;

function googleOption() {
  return `<div class="stack-4 auth-options"><button type="button" class="btn btn-secondary btn-block btn-lg google-auth" data-google-auth aria-label="Continue with Google">${googleIcon}Continue with Google</button><div class="auth-divider"><span>or</span></div></div>`;
}

function authForm({ signup = false }) {
  const prefix = signup ? "signup" : "login";
  return `${googleOption()}<form class="stack-4" style="margin-top:var(--sp-4)" data-local-auth-form novalidate>
    <div class="field"><label for="${prefix}-email">Email address</label><input class="input" id="${prefix}-email" name="email" type="email" autocomplete="email" placeholder="you@company.com" required></div>
    <div class="field"><div class="row-between"><label for="${prefix}-password">Password</label>${signup ? "" : '<button type="button" data-forgot-password class="auth-text-button text-small text-brand" style="font-weight:600">Forgot password?</button>'}</div><input class="input" id="${prefix}-password" name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" required></div>
    ${signup ? `<div class="field"><label for="${prefix}-confirm-password">Confirm password</label><input class="input" id="${prefix}-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" required></div>` : ""}
    <p class="text-small" data-auth-error hidden style="color:var(--danger-600);font-weight:600"></p><p class="text-small" data-auth-success hidden style="color:var(--success-700);font-weight:600"></p>
    <button class="btn btn-primary btn-block btn-lg" type="submit">${signup ? "Create account" : "Log in"}</button>
  </form>`;
}

export function loginPageHtml() {
  return `<!DOCTYPE html><html lang="en"><head>${renderHead({ title: "Log in", description: "Log in to InfoBridgeIndia." })}${authStyles}</head><body><main class="login-shell"><section class="card card-pad-lg auth-form-card" aria-labelledby="login-title">
    <div class="login-logo-wrap"><a href="/index.html" class="auth-logo login-logo-surface"><img src="/infobridgeindia-logo.png" alt="InfoBridgeIndia"></a></div>
    <div class="auth-heading"><h1 class="h-3" id="login-title">Welcome back</h1><p class="text-small">Log in to continue to your workspace.</p></div>
    <div data-login-panel>${authForm({ signup: false })}</div>
    <div data-recovery-panel hidden><form class="stack-4" style="margin-top:var(--sp-6)" data-recovery-form novalidate>
      <div class="auth-heading"><h2 class="h-4">Reset your password</h2><p class="text-small">Enter your account email and we will send you a secure reset link.</p></div>
      <div class="field"><label for="recovery-email">Email address</label><input class="input" id="recovery-email" name="email" type="email" autocomplete="email" placeholder="you@company.com" required></div>
      <p class="text-small" data-recovery-error hidden style="color:var(--danger-600);font-weight:600"></p><p class="text-small" data-recovery-success hidden style="color:var(--success-700);font-weight:600"></p>
      <button class="btn btn-primary btn-block btn-lg" type="submit">Send reset link</button>
      <button class="btn btn-secondary btn-block" type="button" data-back-to-login>Back to login</button>
    </form></div>
    <p class="text-small" style="margin-top:var(--sp-6);text-align:center">Don't have an account? <a href="/signup.html" class="text-brand" style="font-weight:650">Create account</a></p>
  </section></main><script type="module" src="/scripts/auth-ui.js?v=20260823-password-recovery"></script></body></html>`;
}

export function resetPasswordPageHtml() {
  return `<!DOCTYPE html><html lang="en"><head>${renderHead({ title: "Reset password", description: "Choose a new InfoBridgeIndia password." })}${authStyles}</head><body><main class="login-shell"><section class="card card-pad-lg auth-form-card" aria-labelledby="reset-title">
    <div class="login-logo-wrap"><a href="/index.html" class="auth-logo login-logo-surface"><img src="/infobridgeindia-logo.png" alt="InfoBridgeIndia"></a></div>
    <div class="auth-heading"><h1 class="h-3" id="reset-title">Choose a new password</h1><p class="text-small" data-reset-intro>Checking your secure reset link…</p></div>
    <form class="stack-4" style="margin-top:var(--sp-6)" data-reset-password-form novalidate hidden>
      <div class="field"><label for="new-password">New password</label><input class="input" id="new-password" name="password" type="password" autocomplete="new-password" minlength="6" required></div>
      <div class="field"><label for="confirm-new-password">Confirm new password</label><input class="input" id="confirm-new-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="6" required></div>
      <p class="text-small" data-reset-error hidden style="color:var(--danger-600);font-weight:600"></p><p class="text-small" data-reset-success hidden style="color:var(--success-700);font-weight:600"></p>
      <button class="btn btn-primary btn-block btn-lg" type="submit">Update password</button>
    </form>
    <p class="text-small" data-reset-login hidden style="margin-top:var(--sp-6);text-align:center"><a href="/login.html" class="text-brand" style="font-weight:650">Return to login</a></p>
  </section></main><script type="module" src="/scripts/reset-password.js"></script></body></html>`;
}

export function signupPageHtml() {
  return `<!DOCTYPE html><html lang="en"><head>${renderHead({ title: "Create account", description: "Create your InfoBridgeIndia account." })}${authStyles}</head><body><main class="signup-shell">
    <aside class="signup-side"><a href="/index.html" class="auth-logo"><img src="/infobridgeindia-logo.png" alt="InfoBridgeIndia"></a><div><span class="eyebrow">Built for Indian businesses</span><h2 class="h-2">One login. Your whole business — accounting, GST, sales, inventory, HR and banking.</h2><p>Set up your company once, then continue into the InfoBridgeIndia workspace you selected.</p></div><div class="text-micro" style="color:rgba(255,255,255,.4)">© 2026 InfoBridgeIndia Business Systems</div></aside>
    <div class="signup-form-wrap"><section class="card card-pad-lg auth-form-card" aria-labelledby="signup-title"><div class="auth-heading"><h1 class="h-3" id="signup-title">Create your account</h1><p class="text-small">Create your account to continue to your workspace.</p></div>${authForm({ signup: true })}<p class="text-small" style="margin-top:var(--sp-6);text-align:center">Already have an account? <a href="/login.html" class="text-brand" style="font-weight:650">Log in</a></p></section></div>
  </main><script type="module" src="/scripts/auth-ui.js?v=20260823-password-recovery"></script></body></html>`;
}
