import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
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

/**
 * Toast viewport — a fixed container at the bottom-right of the screen
 * that renders active toast notifications.
 */
function ToastViewport() {
  const toasts = zustandToastStore((s) => s.toasts);
  const removeToast = zustandToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all animate-in slide-in-from-right-full',
            toast.variant === 'destructive'
              ? 'border-destructive bg-destructive text-destructive-foreground'
              : 'border-border bg-background text-foreground'
          )}
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description && (
              <p className="text-sm opacity-90">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
ToastViewport.displayName = 'ToastViewport';

export { ToastViewport, useToast };
export type { Toast, ToastVariant };
