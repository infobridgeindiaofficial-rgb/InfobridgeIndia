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

export async function resetEmployeeDataEverywhere({ activeStore, createCloudStore, createFallbackStore }) {
  if (!activeStore || !createCloudStore || !createFallbackStore) throw new Error("Employee reset storage is unavailable.");
  const cloudStore = activeStore.offline ? await createCloudStore() : activeStore;
  const fallbackStore = createFallbackStore();
  await resetEmployeeData(cloudStore);
  await resetEmployeeData(fallbackStore);
  const reloadedCloudStore = await createCloudStore();
  const reloadedFallbackStore = createFallbackStore();
  await verifyEmployeeDataReset(reloadedCloudStore);
  await verifyEmployeeDataReset(reloadedFallbackStore);
  return { cleared: [...EMPLOYEE_RESET_COLLECTIONS] };
}
