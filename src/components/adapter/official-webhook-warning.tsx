import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { officialWebhookNeedsPublicUrl } from '@/lib/adapter-connection';

export function OfficialWebhookWarning() {
  const { t } = useTranslation();
  if (typeof window === 'undefined' || !officialWebhookNeedsPublicUrl(window.location.href)) return null;
  return <p role="alert" className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    <span>{t('adapters.webhook_public_required')}</span>
  </p>;
}
