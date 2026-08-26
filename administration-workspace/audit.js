import { requireSupabase } from "../supabase/client.js";

const rpc = async (name, args) => {
  const { data, error } = await requireSupabase().rpc(name, args);
  if (error) throw error;
  return data;
};

export const legacyAuditRecord = (row) => ({
  id: row.id,
  companyId: row.companyId,
  timestamp: row.timestamp || row.created_at,
  action: row.action || "Administration changed",
  entityType: row.entityType || row.entity || "Administration",
  entityName: row.entityName || row.entity || "",
  entityId: row.entityId || row.id || "",
  actorId: row.actorId || "",
  actorName: row.actorName || row.actor || "Current account",
  actorEmail: row.actorEmail || "",
  actorRole: row.actorRole || "",
  reason: row.reason || "",
  changes: row.changes || row.metadata?.changes || [],
  legacy: true,
});

export const databaseAuditRecord = (row) => ({
  id: row.id,
  companyId: row.company_id,
  timestamp: row.created_at,
  action: row.action,
  entityType: row.entity_type,
  entityName: row.entity_name || "",
  entityId: row.entity_id || "",
  actorId: row.actor_id,
  actorName: row.actor_name || "Authenticated user",
  actorEmail: row.actor_email || "",
  actorRole: row.actor_role || "",
  reason: row.reason || "",
  changes: Array.isArray(row.changes) ? row.changes : [],
  legacy: false,
});

export async function loadCompanyAudit(companyId) {
  if (!companyId) return [];
  const rows = (await rpc("list_company_audit_log", { p_company_id: companyId })) || [];
  return rows.map(databaseAuditRecord);
}

export function companyAuditRows(databaseRows, legacyRows, companyId) {
  const seen = new Set();
  return [...databaseRows, ...(legacyRows || []).map(legacyAuditRecord)]
    .filter((row) => row.companyId === companyId)
    .filter((row) => {
      const key = `${row.legacy ? "legacy" : "database"}:${row.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}

export function formatAuditTimestamp(value, locale = "en-IN") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(date);
}

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
export function exportAuditCsv(rows, locale = "en-IN") {
  const header = ["Date/Time", "Action", "Entity Type", "Entity Name", "Actor Name", "Actor Email", "Actor Role", "Reason", "Change Details"];
  const body = rows.map((row) => [
    formatAuditTimestamp(row.timestamp, locale), row.action, row.entityType, row.entityName,
    row.actorName, row.actorEmail, row.actorRole, row.reason,
    (row.changes || []).map((change) => `${change.field}: ${change.before ?? ""} -> ${change.after ?? ""}`).join("; "),
  ]);
  return [header, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n");
}
