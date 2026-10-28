import { useTranslation } from 'react-i18next';

export function PageSkeleton() {
  const { t } = useTranslation();
  return <div role="status" aria-label={t('common.loading')} className="space-y-5 py-2">
    <div className="h-9 w-44 animate-pulse rounded-lg bg-muted" />
    <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((key) => <div key={key} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div>
    <div className="h-72 animate-pulse rounded-xl bg-muted" />
    <span className="sr-only">{t('common.loading')}</span>
  </div>;
}
