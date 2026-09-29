import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { zustandToastStore } from '@/hooks/use-toast';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

function Toaster() {
  const { t } = useTranslation();
  const toasts = zustandToastStore((s) => s.toasts);
  const removeToast = zustandToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  // Keep notifications outside page width selectors and clipped/scrolling panels.
  return createPortal(
    <div data-toast-viewport className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[388px] flex-col-reverse gap-2 overflow-y-auto">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.variant === 'destructive' ? 'alert' : 'status'}
          aria-atomic="true"
          className={cn(
            'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all animate-in slide-in-from-right-full',
            toast.variant === 'destructive'
              ? 'border-destructive bg-destructive text-destructive-foreground'
              : 'border-border bg-background text-foreground'
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1 [overflow-wrap:anywhere]">
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description && (
              <p className="text-sm opacity-90">{toast.description}</p>
            )}
          </div>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => removeToast(toast.id)}
            className="absolute right-2 top-2 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
Toaster.displayName = 'Toaster';

export { Toaster };
