import { assertCompanyCountryChangeAllowed, companyProfileCountryModel, normalizeCompanyProfileInput } from "../company/profile.js";

const config = globalThis.INFOBRIDGE_SUPABASE || {};
export const isSupabaseConfigured = Boolean(config.url && config.publishableKey && globalThis.supabase?.createClient);

export const supabase = isSupabaseConfigured
  ? globalThis.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

let companyCache = { userId: "", value: null, promise: null };

export function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured. Add the project URL and publishable key to /supabase-config.js.");
  return supabase;
}

export async function currentSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function currentUser() {
  const session = await currentSession();
  return session?.user || null;
}

export async function ownedCompany() {
  const client = requireSupabase();
  const user = await currentUser();
  if (!user) return null;
  if (companyCache.userId === user.id && companyCache.value) return companyCache.value;
  if (companyCache.userId === user.id && companyCache.promise) return companyCache.promise;
  companyCache = {
    userId: user.id,
    value: null,
    promise: client.from("companies").select("*").eq("owner_id", user.id).maybeSingle().then(({ data, error }) => {
      if (error) throw error;
      companyCache.value = data;
      companyCache.promise = null;
      return data;
    }).catch((error) => { companyCache.promise = null; throw error; }),
  };
  return companyCache.promise;
}

export async function saveOwnedCompany(input) {
  const client = requireSupabase();
  const user = await currentUser();
  if (!user) throw new Error("Sign in before saving a company profile.");
  const existing = await ownedCompany();
  const normalized = normalizeCompanyProfileInput(input);
  assertCompanyCountryChangeAllowed(companyToProfile(existing), normalized.country);
  const row = {
    ...(existing?.id ? { id: existing.id } : {}),
    owner_id: user.id,
    name: normalized.name,
    legal_name: normalized.legalName || normalized.name,
    business_type: normalized.businessType,
    state: normalized.state,
    gst_registered: Boolean(normalized.gstRegistered),
    gstin: normalized.gstin || null,
    vat_registered: Boolean(normalized.vatRegistered),
    trn: normalized.trn || null,
    trade_license_number: normalized.tradeLicenseNumber || null,
    trade_license_expiry_date: normalized.tradeLicenseExpiryDate || null,
    tax_system: normalized.taxSystem,
    tax_number: normalized.taxNumber || null,
    address: normalized.address || null,
    logo: normalized.logo || null,
    country: normalized.country,
    currency: normalized.currency,
    date_format: normalized.dateFormat || "DD/MM/YYYY",
    financial_year: normalized.financialYear,
    invoice_prefix: normalized.invoicePrefix || "INV",
    quotation_prefix: normalized.quotationPrefix || "QUO",
    profile_complete: normalized.profileComplete !== false,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await client.from("companies").upsert(row, { onConflict: "owner_id" }).select().single();
  if (error) throw error;
  companyCache = { userId: user.id, value: data, promise: null };
  return data;
}

export async function ensureDefaultCompany() {
  const existing = await ownedCompany();
  if (existing) return existing;
  const user = await currentUser();
  if (!user) throw new Error("Sign in before creating a company workspace.");
  const metadataName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name;
  const emailName = String(user.email || "Account").split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const displayName = String(metadataName || emailName || "My").trim();
  const year = new Date().getFullYear(), start = new Date().getMonth() >= 3 ? year : year - 1;
  return saveOwnedCompany({ name: `${displayName} Workspace`, legalName: `${displayName} Workspace`, businessType: "Other", state: "Not provided", gstRegistered: false, financialYear: `${start}-${String(start + 1).slice(-2)}`, profileComplete: false });
}

export function companyToProfile(row) {
  if (!row) return null;
  const model = companyProfileCountryModel(row.country), country = model.code;
  const gstin = country === "IN" ? row.gstin || "" : "";
  const trn = country === "AE" ? row.trn || (row.tax_system === "VAT" ? row.tax_number : "") || "" : "";
  return {
    version: 3,
    companyId: row.id,
    ownerId: row.owner_id,
    name: row.name,
    legalName: row.legal_name,
    businessType: row.business_type,
    state: row.state,
    gstRegistered: country === "IN" && Boolean(row.gst_registered),
    gstin,
    vatRegistered: country === "AE" && Boolean(row.vat_registered),
    trn,
    tradeLicenseNumber: row.trade_license_number || "",
    tradeLicenseExpiryDate: row.trade_license_expiry_date || "",
    taxSystem: model.taxSystem,
    taxNumber: country === "AE" ? trn : gstin,
    address: row.address || "",
    logo: row.logo || "",
    country,
    currency: model.currency,
    dateFormat: row.date_format,
    financialYear: row.financial_year,
    invoicePrefix: row.invoice_prefix,
    quotationPrefix: row.quotation_prefix,
    profileComplete: row.profile_complete !== false,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}
