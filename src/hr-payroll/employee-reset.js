export const EMPLOYEE_RESET_COLLECTIONS = Object.freeze([
  "employees",
  "attendance",
  "attendanceImports",
  "attendanceMappings",
  "attendanceCorrections",
  "leaveBalances",
  "leaveTransactions",
  "payrollRuns",
  "payrollAdjustments",
  "payslips",
]);

export async function resetEmployeeData(store) {
  if (!store?.clear) throw new Error("HR workspace storage is unavailable.");
  for (const collection of EMPLOYEE_RESET_COLLECTIONS) await store.clear(collection);
  return { cleared: [...EMPLOYEE_RESET_COLLECTIONS] };
}

export async function verifyEmployeeDataReset(store) {
  const remaining = [];
  for (const collection of EMPLOYEE_RESET_COLLECTIONS) if ((await store.all(collection)).length) remaining.push(collection);
  if (remaining.length) throw new Error(`Employee reset could not be verified for: ${remaining.join(", ")}.`);
  return true;
}

export async function resetEmployeeDataEverywhere({ authorizeReset, createCloudStore, createFallbackStore }) {
  if (!authorizeReset || !createCloudStore || !createFallbackStore) throw new Error("Secure HR reset authorization is unavailable.");
  const authorization = await authorizeReset();
  if (!authorization || authorization.authorized !== true || authorization.moduleId !== "hr_payroll") throw new Error("Secure HR reset authorization failed.");
  const fallbackStore = createFallbackStore();
  await resetEmployeeData(fallbackStore);
  const reloadedCloudStore = await createCloudStore();
  const reloadedFallbackStore = createFallbackStore();
  await verifyEmployeeDataReset(reloadedCloudStore);
  await verifyEmployeeDataReset(reloadedFallbackStore);
  return { cleared: [...EMPLOYEE_RESET_COLLECTIONS] };
}
