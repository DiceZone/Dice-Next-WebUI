import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FeatureHelp } from '@/components/ui/feature-help';
import { legacyTextCounts, legacyTextIssue, type LegacyTextReport as Report } from '@/lib/legacy-templates';

export function LegacyTextReport({ report, historical = false, onDownload }: {
  report: Report; historical?: boolean; onDownload: () => void;
}) {
  const { t } = useTranslation();
  if (!report.items.length) return null;
  const title = t(historical ? 'legacy_text.upgrade_title' : 'legacy_text.report_title');
  return <section className="space-y-2 rounded-md border p-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 font-medium">{title}<FeatureHelp title={title} description={<p>{t('legacy_text.report_hint')}</p>} /></h3>
      <Button size="sm" variant="outline" onClick={onDownload}><Download className="mr-2 h-4 w-4" />{t('legacy_text.download')}</Button>
    </div>
    <p>{t('legacy_text.summary', legacyTextCounts(report.items))}</p>
    {historical && report.appliedAt && <p className="text-xs text-muted-foreground">{t('legacy_text.upgraded_at', { time: report.appliedAt })}</p>}
    <details>
      <summary className="cursor-pointer">{t('legacy_text.details')}</summary>
      <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
        {report.items.slice(0, 100).map((item, index) => <li key={index} className="break-words rounded bg-muted/50 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{item.source}{item.target && ' → ' + item.target}</span>
            <span className={item.status === 'active' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>{t('legacy_text.statuses.' + item.status)}</span>
            {item.locale && <span className="text-xs text-muted-foreground">{item.locale}</span>}
            {item.personaId && <span className="text-xs text-muted-foreground">{t('legacy_text.persona', { id: item.personaId })}</span>}
          </div>
          {item.issues.map((issue, i) => {
            const { key, detail } = legacyTextIssue(issue);
            return <p key={i} className="mt-1 text-xs text-muted-foreground">{t('legacy_text.issues.' + key, { detail })}</p>;
          })}
        </li>)}
      </ul>
      {report.items.length > 100 && <p className="mt-2 text-xs text-muted-foreground">{t('legacy_text.remainder', { count: report.items.length - 100 })}</p>}
    </details>
  </section>;
}
