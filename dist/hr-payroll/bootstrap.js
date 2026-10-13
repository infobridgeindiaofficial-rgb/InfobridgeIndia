import { createWorkspaceStateStorage } from "/supabase/workspace.js";
import { departmentSourceDiagnostics } from "/administration-workspace/departments.js";

// Departments belong to the Administration workspace. Hydrate that authoritative,
// current-company state before HR evaluates so sharedDepartments() sees core and
// custom rows instead of falling back to stale browser-local defaults.
globalThis.InfoBridgeRefreshAdministrationStorage = () => createWorkspaceStateStorage();
await globalThis.InfoBridgeRefreshAdministrationStorage();
console.info("InfoBridge HR department source", departmentSourceDiagnostics());
await import("./app.js");
