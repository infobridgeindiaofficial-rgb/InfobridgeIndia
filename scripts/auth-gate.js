import { companyToProfile, currentCompany, currentSession, isSupabaseConfigured, supabase } from "/supabase/client.js";
import { HOME_ROUTE, clearTemporaryNavigation, destinationAfterAuth, isProtectedRoute, normalizePath, profileDisplayName, saveIntendedDestination, setLastWorkspace } from "/auth/core.js";
import { currentCompanyName, publishAdministrationCompany } from "/administration-workspace/company.js";
import { createCountryContext } from "/country/registry.js";

const temporary = sessionStorage;
const path = `${location.pathname}${location.search}${location.hash}`;
const safePath = normalizePath(path) || HOME_ROUTE;
const verifiedReturn = location.pathname === "/login.html" && new URLSearchParams(location.search).get("verified") === "1";
let session = await currentSession().catch(() => null);
let user = session?.user || null;

if (verifiedReturn && user) {
  await supabase.auth.signOut({ scope: "local" });
  session = null;
  user = null;
}

let companyLoadError = null;
const companyRow = user ? await currentCompany().catch((error) => { companyLoadError = error; return null; }) : null;
const profile = companyToProfile(companyRow);
const companyRoute = ["/company-setup.html", "/company-profile.html"].includes(location.pathname);
const authRoute = ["/login.html", "/signup.html"].includes(location.pathname);

if (isProtectedRoute(safePath) && companyLoadError) {
  throw new Error(`Saved company data could not be loaded. Nothing was reset or overwritten. ${companyLoadError.message}`);
} else if (isProtectedRoute(safePath) && !user) {
  saveIntendedDestination(safePath, temporary);
  location.replace("/login.html");
} else if (isProtectedRoute(safePath) && !profile) {
  location.replace("/company-setup.html");
} else if (companyRoute && !user) {
  location.replace("/login.html");
} else if (location.pathname === "/company-profile.html" && !profile) {
  location.replace("/company-setup.html");
} else if (location.pathname === "/company-setup.html" && profile?.profileComplete) {
  location.replace(HOME_ROUTE);
} else if (authRoute && user) {
  location.replace(profile ? destinationAfterAuth(temporary) : "/company-setup.html");
} else {
  if (isProtectedRoute(safePath)) setLastWorkspace(safePath, temporary);

  function closeProfileMenu() {
    document.querySelectorAll("[data-profile-dropdown]").forEach((menu) => { menu.hidden = true; });
    document.querySelectorAll("[data-profile-toggle]").forEach((button) => button.setAttribute("aria-expanded", "false"));
  }

  function renderHeaderState(activeSession, activeProfile) {
    const activeUser = activeSession?.user || null;
    window.InfoBridgeSession = activeSession;
    window.InfoBridgeUser = activeUser;
    window.InfoBridgeCompany = activeProfile;
    window.InfoBridgeCountryContext = activeProfile ? createCountryContext(activeProfile) : null;
    window.InfoBridgeCountryConfig = window.InfoBridgeCountryContext?.config || null;
    window.InfoBridgeSupabaseConfigured = isSupabaseConfigured;

    document.querySelectorAll("[data-auth-logged-out]").forEach((node) => { node.hidden = Boolean(activeUser); });
    document.querySelectorAll("[data-auth-logged-in]").forEach((node) => { node.hidden = !activeUser; });
    if (!activeUser) { closeProfileMenu(); return; }

    const accountName = profileDisplayName(null, activeUser);
    const headerName = currentCompanyName(activeProfile?.name || accountName);
    const initials = accountName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "IB";
    document.querySelectorAll("[data-auth-company-name]").forEach((node) => { node.textContent = headerName; });
    document.querySelectorAll("[data-auth-display-name]").forEach((node) => { node.textContent = accountName; });
    document.querySelectorAll("[data-auth-email]").forEach((node) => { node.textContent = activeUser.email || ""; });
    document.querySelectorAll("[data-auth-company-detail]").forEach((node) => {
      node.textContent = activeProfile?.name || "";
      node.hidden = !activeProfile?.name;
    });
    document.querySelectorAll("[data-company-initials], [data-session-initials]").forEach((node) => { node.textContent = initials; });
    document.querySelectorAll("[data-company-fy]").forEach((node) => { node.textContent = activeProfile ? `FY ${activeProfile.financialYear} · ${activeProfile.state}` : "Company setup required"; });
  }

  function bindHeaderActions() {
    document.addEventListener("click", async (event) => {
      const toggle = event.target.closest("[data-profile-toggle]");
      if (toggle) {
        event.stopPropagation();
        const menu = toggle.parentElement?.querySelector("[data-profile-dropdown]");
        if (menu) {
          const willOpen = menu.hidden;
          closeProfileMenu();
          menu.hidden = !willOpen;
          toggle.setAttribute("aria-expanded", String(willOpen));
        }
        return;
      }
      const logout = event.target.closest("[data-auth-logout]");
      if (logout) {
        event.preventDefault();
        closeProfileMenu();
        logout.disabled = true;
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) { logout.disabled = false; return; }
        clearTemporaryNavigation(temporary);
        ["infobridgeindia.auth.session.v1", "infobridgeindia.company.profile.v1"].forEach((key) => localStorage.removeItem(key));
        renderHeaderState(null, null);
        location.replace(HOME_ROUTE);
        return;
      }
      closeProfileMenu();
    });
  }

  async function syncAdministrationCompany(activeUser,activeProfile){if(!activeUser||!activeProfile?.companyId)return;try{const query=supabase.from("workspace_records").select("data").eq("owner_id",activeProfile.ownerId).eq("company_id",activeProfile.companyId).eq("module","administration").eq("collection","state").eq("record_id","infobridgeindia.administration.v2").maybeSingle(),timeout=new Promise((_,reject)=>setTimeout(()=>reject(Error("Administration company lookup timed out")),1500)),result=await Promise.race([query,timeout]);if(result?.data?.data)publishAdministrationCompany(result.data.data,activeProfile.companyId,{broadcast:false})}catch(error){console.warn("Using authenticated company name until Administration is available.",error)}}
  const initializeHeader = () => { renderHeaderState(session, profile); bindHeaderActions();syncAdministrationCompany(user,profile); };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", initializeHeader, { once: true });
  else initializeHeader();

  supabase?.auth.onAuthStateChange((_event, nextSession) => {
    setTimeout(async () => {
      const nextUser = nextSession?.user || null;
      const nextProfile = nextUser ? companyToProfile(await currentCompany().catch(() => null)) : null;
      renderHeaderState(nextSession, nextProfile);
      if (!nextUser && isProtectedRoute(safePath)) location.replace("/login.html");
    }, 0);
  });

  addEventListener("pageshow", async (event) => {
    if (!event.persisted || !isProtectedRoute(safePath)) return;
    if (!await currentSession().catch(() => null)) location.replace("/login.html");
  });
}
