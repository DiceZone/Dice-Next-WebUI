import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ChevronDown, Link2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FeatureHelp } from '@/components/ui/feature-help';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RecentLogEntry } from '@/types/dashboard';
import type { LogLevel } from '@/types/log';
import { LOG_LEVELS, logAtLeast, logMessageId, logTimestamp, normalizeLogLevel } from '@/lib/runtime-logs';
import { useLogFollow } from '@/hooks/use-log-follow';
import { cn } from '@/lib/utils';

interface RecentLogsProps { logs: RecentLogEntry[]; }
const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  trace: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  debug: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  warn: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};

function RuntimeLogRow({ log, onRelated }: { log: RecentLogEntry; onRelated?: (log: RecentLogEntry) => void }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const level = normalizeLogLevel(log.level);
  const messageId = logMessageId(log);
  return (
    <div className="border-b px-4 py-3 last:border-b-0 hover:bg-muted/30 transition-colors">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:grid-cols-[155px_72px_82px_minmax(0,1fr)]">
        <time className="col-span-2 text-[10px] text-muted-foreground font-mono sm:col-span-1">{logTimestamp(log.timestamp)}</time>
        <Badge variant="outline" className={cn('w-fit text-[10px] px-1.5 py-0 font-mono', LOG_LEVEL_COLORS[level])}>{level.toUpperCase()}</Badge>
        <span className="text-xs font-medium break-words">[{log.module || '系统'}]</span>
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <p className="break-words whitespace-pre-wrap text-xs leading-relaxed [overflow-wrap:anywhere]">{log.message}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {messageId && onRelated && <button type="button" aria-label={`${t('runtime_logs.show_related')}: ${messageId}`} onClick={() => onRelated(log)} className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
              <Link2 className="h-3 w-3" />{t('runtime_logs.show_related')}
            </button>}
            {log.details && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
              <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />{t('runtime_logs.details')}
            </button>}
          </div>
        </div>
      </div>
      {expanded && <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-muted/50 p-3 text-[10px] whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{JSON.stringify(log.details, null, 2)}</pre>}
    </div>
  );
}

export const RecentLogs: React.FC<RecentLogsProps> = ({ logs }) => {
  const { t } = useTranslation();
  const [minimum, setMinimum] = useState<LogLevel>(() => {
    try { return normalizeLogLevel(localStorage.getItem('dice-log-display-level')); } catch { return 'info'; }
  });
  const [query, setQuery] = useState('');
  const [related, setRelated] = useState<RecentLogEntry | null>(null);
  const visible = useMemo(() => logs.filter((log) => logAtLeast(log.level, minimum)
    && (!query.trim() || [log.module, log.message, logMessageId(log), JSON.stringify(log.details)]
      .join(' ').toLowerCase().includes(query.trim().toLowerCase()))), [logs, minimum, query]);
  const { scrollRef, contentRef, following, onScroll, jumpToLatest } = useLogFollow(visible);
  const relatedId = related ? logMessageId(related) : undefined;
  // Correlated records intentionally ignore the list threshold. An ERROR row's
  // diagnostics retain its source even if its INFO plan was never recorded.
  const relatedLogs = relatedId ? logs.filter((log) => logMessageId(log) === relatedId) : [];
  const changeMinimum = (value: string) => {
    const level = normalizeLogLevel(value); setMinimum(level);
    try { localStorage.setItem('dice-log-display-level', level); } catch { /* browser storage unavailable */ }
  };
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="pb-3 shrink-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">{t('dashboard.recent_logs')}
            <FeatureHelp title={t('dashboard.recent_logs')} description={t('runtime_logs.help')} />
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('runtime_logs.display_level')}</span>
            <Select value={minimum} onValueChange={changeMinimum}>
              <SelectTrigger aria-label={t('runtime_logs.display_level')} className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{LOG_LEVELS.map((level) => <SelectItem key={level} value={level}>{level.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('runtime_logs.search')} aria-label={t('runtime_logs.search')} className="h-8 text-xs" />
      </CardHeader>
      <CardContent className="relative flex-1 min-h-0 p-0">
        <ScrollArea ref={scrollRef} onScroll={onScroll} tabIndex={0} role="region" aria-label={t('dashboard.recent_logs')} className="h-[400px] overscroll-contain scroll-auto lg:absolute lg:inset-0 lg:h-auto">
          <div ref={contentRef} className="min-h-full">
            {visible.length === 0 ? <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">{t(logs.length ? 'runtime_logs.empty' : 'dashboard.no_logs')}</div>
              : visible.map((log) => <RuntimeLogRow key={log.id} log={log} onRelated={setRelated} />)}
          </div>
        </ScrollArea>
        {!following && <div className="absolute bottom-3 right-3 z-10">
          <span className="sr-only" role="status">{t('runtime_logs.follow_paused')}</span>
          <Button type="button" size="sm" variant="secondary" onClick={jumpToLatest} className="gap-1.5 rounded-full border shadow-md">
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />{t('runtime_logs.back_to_latest')}
          </Button>
        </div>}
      </CardContent>
      <Dialog open={!!related} onOpenChange={(open) => { if (!open) setRelated(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{t('runtime_logs.related')}</DialogTitle><DialogDescription className="font-mono break-all">msgID: {relatedId}</DialogDescription></DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto">
            {(relatedLogs.length ? relatedLogs : related ? [related] : []).map((log) => <RuntimeLogRow key={log.id} log={log} />)}
          </div>
          <Button variant="outline" onClick={() => setRelated(null)}>{t('common.close')}</Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
export default RecentLogs;
