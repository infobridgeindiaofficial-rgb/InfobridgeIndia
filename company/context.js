import { companyToProfile, currentCompany, currentUser, requireSupabase } from "../supabase/client.js";
import { createCountryContext } from "../country/registry.js";

export function normalizeCurrentCompany(company) {
  if (!company) return null;
  const profile = company.companyId ? company : companyToProfile(company);
  if (!profile?.companyId || !profile?.ownerId) return null;
  return Object.freeze({ ...profile, id: profile.companyId, owner_id: profile.ownerId });
}

export function createCompanyWorkspaceContext(user, company) {
  const profile = normalizeCurrentCompany(company);
  if (!user) throw new Error("Authentication required.");
  if (!profile) throw new Error("Company setup required.");
  if (profile.ownerId !== user.id && !["company_admin","company_member"].includes(profile.accessRole)) throw new Error("Company access denied.");
  const country = createCountryContext(profile);
  return Object.freeze({ client: requireSupabase(), user, company: profile, profile, country, countryConfig: country.config });
}

export async function resolveCurrentCompanyContext({ user = globalThis.InfoBridgeUser, company = globalThis.InfoBridgeCompany } = {}) {
  const activeUser = user || await currentUser();
  const activeCompany = normalizeCurrentCompany(company) || normalizeCurrentCompany(await currentCompany());
  const context = createCompanyWorkspaceContext(activeUser, activeCompany);
  globalThis.InfoBridgeUser = context.user;
  globalThis.InfoBridgeCompany = context.profile;
  globalThis.InfoBridgeCountryContext = context.country;
  globalThis.InfoBridgeCountryConfig = context.countryConfig;
  return context;
}

export function activeCountryContext(company = globalThis.InfoBridgeCompany) {
  return globalThis.InfoBridgeCountryContext && (!company || globalThis.InfoBridgeCompany?.companyId === (company.companyId || company.id))
    ? globalThis.InfoBridgeCountryContext
    : createCountryContext(company);
}
