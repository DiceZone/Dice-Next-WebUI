/**
 * C#30: Import Result Card — displays structured import results
 * (success/skipped/failed counts + detail list)
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, XCircle, FileText } from 'lucide-react';

export interface ImportDetailItem {
  name: string;
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
}

export interface ImportResultData {
  success: number;
  skipped: number;
  failed: number;
  details: ImportDetailItem[];
}

interface Props {
  title: string;
  result: ImportResultData | null;
}

export const ImportResultCard: React.FC<Props> = ({ title, result }) => {
  const { t } = useTranslation();
  if (!result) return null;

  const statusIcon = (status: string) => {
    if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === 'skipped') return <AlertCircle className="h-4 w-4 text-amber-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const statusColor = (status: string) => {
    if (status === 'success') return 'text-green-600 dark:text-green-400';
    if (status === 'skipped') return 'text-amber-600 dark:text-amber-400';
    return 'text-destructive';
  };

  return (
    <Card className="border-muted">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>

        {/* Summary stats */}
        <div className="flex gap-4 text-sm">
          <span className="text-green-600 dark:text-green-400">{t('import_result.success')} {result.success}</span>
          <span className="text-amber-600 dark:text-amber-400">{t('import_result.skipped')} {result.skipped}</span>
          <span className="text-destructive">{t('import_result.failed')} {result.failed}</span>
        </div>

        {/* Detail list */}
        {result.details.length > 0 && (
          <div className="max-h-48 overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <tbody>
                {result.details.map((d, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-1.5 align-top w-8">{statusIcon(d.status)}</td>
                    <td className="p-1.5 align-top font-mono break-all">{d.name}</td>
                    <td className={`p-1.5 align-top ${statusColor(d.status)}`}>
                      {d.reason || d.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ImportResultCard;
