import type { ReactNode } from 'react';

/** Retain the last preview while refreshing, without replacing it with a line of loading text. */
export function AsyncPreview({ loading, loadingLabel, error, children }: {
  loading: boolean;
  loadingLabel: string;
  error?: string;
  children: ReactNode;
}) {
  return <div className="mt-3 space-y-2">
    <div className="min-h-4 text-xs" aria-live="polite" aria-atomic="true">
      {loading && <span role="status" className="text-muted-foreground">{loadingLabel}</span>}
      {!loading && error && <span role="alert" className="text-destructive">{error}</span>}
    </div>
    <div aria-busy={loading} className="min-h-24">{children}</div>
  </div>;
}
