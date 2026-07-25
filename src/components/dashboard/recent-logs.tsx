import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RecentLogEntry } from '@/types/dashboard';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface RecentLogsProps {
  logs: RecentLogEntry[];
}

const LOG_LEVEL_COLORS: Record<string, string> = {
  trace: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  debug: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  info: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  warn: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  critical: 'bg-red-200 text-red-800 dark:bg-red-950 dark:text-red-400',
};

export const RecentLogs: React.FC<RecentLogsProps> = ({ logs }) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      const container = scrollRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [logs]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('dashboard.recent_logs')}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea
          ref={scrollRef}
          className="h-[400px]"
        >
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              {t('dashboard.no_logs')}
            </div>
          ) : (
            <div className="space-y-0">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 border-b px-4 py-2.5 last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <span className="mt-0.5 shrink-0 text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                    {formatDateTime(log.timestamp)}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 text-[10px] px-1.5 py-0 leading-tight font-mono',
                      LOG_LEVEL_COLORS[log.level]
                    )}
                  >
                    {log.level.toUpperCase()}
                  </Badge>
                  <span className="min-w-0 break-words whitespace-pre-wrap text-xs leading-relaxed">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default RecentLogs;
