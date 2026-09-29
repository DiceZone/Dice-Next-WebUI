import { useEffect, useRef } from 'react';
import { registerNavigationGuard } from '@/lib/navigation-guard';

/** Protect both hash-route changes and a full reload/close. */
export function useUnsavedChanges(active: boolean, confirmLeave: () => Promise<boolean>) {
  const confirmRef = useRef(confirmLeave);
  confirmRef.current = confirmLeave;
  useEffect(() => {
    if (!active) return;
    const unregister = registerNavigationGuard(() => confirmRef.current());
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { unregister(); window.removeEventListener('beforeunload', beforeUnload); };
  }, [active]);
}
