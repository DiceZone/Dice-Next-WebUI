const guards = new Set<() => Promise<boolean>>();
export function registerNavigationGuard(guard: () => Promise<boolean>) {
  guards.add(guard);
  return () => { guards.delete(guard); };
}
export async function confirmPageLeave() {
  try {
    for (const guard of [...guards]) if (!await guard()) return false;
  } catch { return false; } // A failed confirmation must never discard the draft.
  return true;
}
