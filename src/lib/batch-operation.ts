/** Keep failures selected for retry; never report partial success as full success. */
export async function runBatch<T>(items: readonly T[], operation: (item: T) => Promise<void>) {
  const succeeded: T[] = [];
  const failed: T[] = [];
  for (const item of items) {
    try { await operation(item); succeeded.push(item); }
    catch { failed.push(item); }
  }
  return { succeeded, failed };
}
