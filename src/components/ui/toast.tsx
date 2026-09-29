import * as React from 'react';
import { zustandToastStore, useToast, type Toast, type ToastVariant } from '@/hooks/use-toast';

/**
 * Toast notification provider.
 *
 * Wraps the application root to enable toast notifications.
 * This is a thin context provider — the actual toast state is
 * managed by zustand (see hooks/use-toast.ts).
 */
const ToastContext = React.createContext<{
  toast: (opts: { title: string; description?: string; variant?: ToastVariant }) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const addToast = zustandToastStore((s) => s.addToast);

  const toast = (opts: { title: string; description?: string; variant?: ToastVariant }) => {
    addToast({
      title: opts.title,
      description: opts.description,
      variant: opts.variant ?? 'default',
    });
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
    </ToastContext.Provider>
  );
}

// Both entry points share the same sizing, accessibility and portal behavior.
export { Toaster as ToastViewport } from './toaster';
export { useToast };
export type { Toast, ToastVariant };
