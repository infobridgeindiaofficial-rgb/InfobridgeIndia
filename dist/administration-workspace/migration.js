import { MODULE_KEYS } from "./repository.js";

const idbStores = {
  InfoBridgeIndiaInventory: ["settings", "warehouses", "products", "movements", "counts"],
  InfoBridgeIndiaGST: ["setup", "uploads", "mappings", "rows", "settings"],
  InfoBridgeIndiaHRPayroll: ["employees", "attendance", "leave", "payroll", "payslips", "reports", "settings"],
};

function migrateObject(value, companyId, branchId) {
  let changed = 0;
  for (const collection of Object.values(value || {})) {
    if (!Array.isArray(collection)) continue;
    for (const record of collection) {
      if (!record || typeof record !== "object") continue;
      if (!record.companyId) { record.companyId = companyId; changed++; }
      if (!record.branchId) { record.branchId = branchId; changed++; }
    }
  }
  return changed;
}

function openDatabase(name, timeoutMs = 1800) {
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      const request = indexedDB.open(name);
      request.onsuccess = () => finish(request.result);
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
    } catch {
      finish(null);
    }
  });
}

async function migrateDatabase(name, stores, companyId, branchId) {
  const db = await openDatabase(name);
  if (!db) return { changed: 0, skipped: true };
  let changed = 0;
  for (const storeName of stores) {
    if (!db.objectStoreNames.contains(storeName)) continue;
    const records = await new Promise(resolve => {
      const request = db.transaction(storeName).objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
    const updates = [];
    for (const record of records) {
      let dirty = false;
      if (!record.companyId) { record.companyId = companyId; dirty = true; }
      if (!record.branchId) { record.branchId = branchId; dirty = true; }
      if (dirty) { updates.push(record); changed++; }
    }
    if (updates.length) {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        updates.forEach(record => store.put(record));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || Error("Migration transaction aborted"));
      });
    }
  }
  db.close();
  return { changed, skipped: false };
}

export async function migrateExistingData(state, repo, storage = localStorage) {
  // Browser-wide legacy databases are deliberately not auto-imported into an
  // authenticated cloud company because their original owner cannot be proven.
  if (globalThis.InfoBridgeWorkspaceStorage) return { state, changed: 0, idempotent: true };
  if (state.migration.version >= 1) return { state, changed: 0, idempotent: true };
  const snapshot = repo.snapshot();
  state.migration.snapshots.push({
    id: `MIG-${Date.now()}`,
    createdAt: snapshot.createdAt,
    localStorageKeys: Object.keys(snapshot.values),
    snapshot,
  });
  let changed = 0;
  const skippedDatabases = [];
  try {
    for (const key of MODULE_KEYS) {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const value = JSON.parse(raw);
      changed += migrateObject(value, state.currentCompanyId, state.currentBranchId);
      storage.setItem(key, JSON.stringify(value));
    }
    for (const [name, stores] of Object.entries(idbStores)) {
      const result = await migrateDatabase(name, stores, state.currentCompanyId, state.currentBranchId);
      changed += result.changed;
      if (result.skipped) skippedDatabases.push(name);
    }
    state.migration.version = 1;
    state.migration.completedAt = new Date().toISOString();
    state.migration.recordsTagged = changed;
    state.migration.skippedDatabases = skippedDatabases;
    repo.save(state);
    return { state, changed, idempotent: false, skippedDatabases };
  } catch (error) {
    repo.restoreSnapshot(snapshot);
    throw Error(`Migration rolled back: ${error.message}`);
  }
}

export function effectiveCompanyId(record, state) {
  return record?.companyId || state.currentCompanyId;
}

export function effectiveBranchId(record, state) {
  return record?.branchId || state.currentBranchId;
}
