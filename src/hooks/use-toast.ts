import { useCallback } from 'react';
import { create } from 'zustand';
import { toast as notify } from 'sonner';

export type ToastVariant = 'default' | 'destructive';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

let toastId = 0;

export const zustandToastStore = create<ToastState>()((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastId}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    const show = toast.variant === 'destructive' ? notify.error : notify;
    show(toast.title, { id, description: toast.description, duration: 5000,
      onDismiss: () => set((s) => ({ toasts: s.toasts.filter((item) => item.id !== id) })) });
    // Auto-remove after 5 seconds
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
    return id;
  },

  removeToast: (id) => {
    notify.dismiss(id);
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  clearToasts: () => { notify.dismiss(); set({ toasts: [] }); },
}));

/**
 * Toast notification hook.
 *
 * Returns a `toast` function that displays a notification.
 * The toast auto-dismisses after 5 seconds.
 *
 * @example
 * ```ts
 * const toast = useToast();
 * toast({ title: '保存成功', variant: 'default' });
 * toast({ title: '错误', description: '请稍后重试', variant: 'destructive' });
 * ```
 */
export function useToast() {
  const addToast = zustandToastStore((s) => s.addToast);

  // Memoize so the returned `toast` has a STABLE identity across renders.
  // Pages put `toast` in useCallback/useEffect dependency arrays; an unstable
  // identity would retrigger those effects every render (infinite re-fetch loop,
  // e.g. a list page stuck on its loading spinner).
  return useCallback(
    (opts: { title: string; description?: string; variant?: ToastVariant }) => {
      addToast({
        title: opts.title,
        description: opts.description,
        variant: opts.variant ?? 'default',
      });
    },
    [addToast]
  );
}
