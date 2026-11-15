const guards = new Map<() => Promise<boolean>, (() => void) | undefined>();
export function registerNavigationGuard(guard: () => Promise<boolean>, discard?: () => void) {
  guards.set(guard, discard);
  return () => { guards.delete(guard); };
}
export async function confirmPageLeave() {
  try {
    const pending = [...guards];
    for (const [guard] of pending) if (!await guard()) return false;
    for (const [, discard] of pending) discard?.();
  } catch { return false; } // A failed confirmation must never discard the draft.
  return true;
}
