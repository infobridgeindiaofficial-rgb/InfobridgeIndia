import { currentUser, ownedCompany, requireSupabase } from "/supabase/client.js";

const KEY_MODULES = {
  "infobridgeindia.finance.v1": "finance",
  "infobridgeindia.sales.v1": "sales",
  "infobridgeindia.purchases.v1": "purchases",
  "infobridgeindia.banking.v1": "banking",
  "infobridgeindia.analytics.v1": "reports",
  "infobridgeindia.administration.v2": "administration",
  InfoBridgeIndiaApprovalsV2: "approvals",
};

async function context() {
  const user = globalThis.InfoBridgeUser || await currentUser();
  const activeProfile = globalThis.InfoBridgeCompany;
  const company = activeProfile?.companyId && activeProfile?.ownerId === user?.id
    ? { id: activeProfile.companyId, owner_id: activeProfile.ownerId, ...activeProfile }
    : await ownedCompany();
  if (!user) throw new Error("Authentication required.");
  if (!company) throw new Error("Company setup required.");
  if (company.owner_id !== user.id) throw new Error("Company access denied.");
  return { client: requireSupabase(), user, company };
}

async function encodeValue(value) {
  if (value instanceof Blob) {
    const bytes = new Uint8Array(await value.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return { __infobridgeBlob: true, type: value.type, name: value.name || "", base64: btoa(binary) };
  }
  if (Array.isArray(value)) return Promise.all(value.map(encodeValue));
  if (value && typeof value === "object") return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await encodeValue(item)])));
  return value;
}

function decodeValue(value) {
  if (value?.__infobridgeBlob) {
    const binary = atob(value.base64); const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return value.name ? new File([bytes], value.name, { type: value.type }) : new Blob([bytes], { type: value.type });
  }
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeValue(item)]));
  return value;
}

export async function createWorkspaceStore(module) {
  const { client, user, company } = await context();
  const { data: initialRows, error: initialError } = await client.from("workspace_records").select("collection, record_id, data").eq("owner_id", user.id).eq("company_id", company.id).eq("module", module);
  if (initialError) throw initialError;
  const collections = new Map();
  for (const row of initialRows || []) {
    if (!collections.has(row.collection)) collections.set(row.collection, new Map());
    collections.get(row.collection).set(row.record_id, decodeValue(row.data));
  }
  const collectionCache = (name) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  return {
    user,
    company,
    async all(collection) {
      return [...collectionCache(collection).values()];
    },
    async get(collection, recordId) {
      return collectionCache(collection).get(String(recordId)) || null;
    },
    async put(collection, value) {
      if (!value?.id) throw new Error("Cloud records require a stable id.");
      const row = { owner_id: user.id, company_id: company.id, module, collection, record_id: String(value.id), data: await encodeValue(value), updated_at: new Date().toISOString() };
      const { error } = await client.from("workspace_records").upsert(row, { onConflict: "company_id,module,collection,record_id" });
      if (error) throw error;
      collectionCache(collection).set(String(value.id), value);
      return value;
    },
    async remove(collection, recordId) {
      const { error } = await client.from("workspace_records").delete().eq("owner_id", user.id).eq("company_id", company.id).eq("module", module).eq("collection", collection).eq("record_id", String(recordId));
      if (error) throw error;
      collectionCache(collection).delete(String(recordId));
    },
    async clear(collection) {
      const { error } = await client.from("workspace_records").delete().eq("owner_id", user.id).eq("company_id", company.id).eq("module", module).eq("collection", collection);
      if (error) throw error;
      collectionCache(collection).clear();
    },
    async replace(collection, rows) {
      await this.clear(collection);
      for (const row of rows) await this.put(collection, row);
    },
  };
}

export async function createWorkspaceStateStorage() {
  const { client, user, company } = await context();
  const { data, error } = await client.from("workspace_records").select("module, record_id, data").eq("owner_id", user.id).eq("company_id", company.id).eq("collection", "state");
  if (error) throw error;
  const cache = new Map((data || []).map((row) => [row.record_id, JSON.stringify(row.data)]));
  const pending = new Map();
  const reportPersistenceError = (saveError) => {
    console.error("InfoBridgeIndia could not save workspace data.", saveError);
    globalThis.dispatchEvent(new CustomEvent("infobridge:workspace-save-error", { detail: saveError }));
  };
  const persist = (key, value) => {
    const module = KEY_MODULES[key];
    if (!module) return;
    const operation = client.from("workspace_records").upsert({ owner_id: user.id, company_id: company.id, module, collection: "state", record_id: key, data: JSON.parse(value), updated_at: new Date().toISOString() }, { onConflict: "company_id,module,collection,record_id" });
    pending.set(key, operation.then(({ error: saveError }) => {
      if (saveError) throw saveError;
    }).catch(reportPersistenceError).finally(() => pending.delete(key)));
  };
  const storage = {
    ownerId: user.id,
    companyId: company.id,
    getItem: (key) => cache.get(key) ?? null,
    setItem(key, value) { const text = String(value); cache.set(key, text); persist(key, text); },
    removeItem(key) {
      cache.delete(key);
      const module = KEY_MODULES[key];
      if (module) client.from("workspace_records").delete().eq("owner_id", user.id).eq("company_id", company.id).eq("module", module).eq("collection", "state").eq("record_id", key).then(({ error: removeError }) => {
        if (removeError) reportPersistenceError(removeError);
      }).catch(reportPersistenceError);
    },
    async flush() { await Promise.allSettled([...pending.values()]); },
  };
  globalThis.InfoBridgeWorkspaceStorage = storage;
  addEventListener("pagehide", () => { storage.flush(); });
  return storage;
}
