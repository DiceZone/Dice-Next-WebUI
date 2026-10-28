import { useTranslation } from 'react-i18next';
import { CircleAlert } from 'lucide-react';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export function PageError({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  return <section role="alert" className="mx-auto my-12 max-w-xl rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
    <CircleAlert className="mb-3 h-7 w-7 text-destructive" />
    <h1 className="text-xl font-semibold">{t('v2.load_error')}</h1>
    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('v2.load_error_hint')}</p>
    <div className="mt-5 flex flex-wrap gap-2">
      <Button type="button" onClick={() => window.location.reload()}>{t('v2.reload')}</Button>
      <Button variant="outline" asChild><a href="#/">{t('v2.home')}</a></Button>
    </div>
    <details className="mt-5 text-sm"><summary>{t('v2.details')}</summary>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs">{error instanceof Error ? error.message : String(error)}</pre>
    </details>
  </section>;
}
