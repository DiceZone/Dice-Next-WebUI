import { useTourActive, useTourState, useTourValue } from '@/components/onboarding/tour-data';
import { tourSamples } from '@/lib/tour-samples';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpDown, CircleStop, Loader2, RefreshCw, Scroll, Search, ScrollText, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingState } from '@/components/ui/state';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { LogActionButtons } from '@/components/log-action-buttons';
import { PageHeader } from '@/components/ui/page-header';
import { FeatureHelp } from '@/components/ui/feature-help';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useServerListPage } from '@/hooks/use-server-list-page';
import { serverListUrl } from '@/lib/server-list-page';

interface GameLog {
  id: number;
  groupId: string;
  groupName?: string;
  gmId: string;
  name: string;
  status: number;
  createdAt: string;
  lastAt: string;
  count: number;
  storageBytes: number;
  imageBytes: number;
  gameCode?: string;
  gameName?: string;
}

interface GameSession {
  code: string;
  name: string;
  groups: string[];
  gms: string[];
  players: string[];
  createdAt: string;
  logCount: number;
  activeLogs: number;
  pausedLogs: number;
  endedLogs: number;
  active: boolean;
  groupNames?: Record<string, string>;
}

type SortKey = 'name' | 'group' | 'status' | 'count' | 'storage' | 'game' | 'creator' | 'createdAt' | 'lastAt';
type SessionSortKey = 'name' | 'code' | 'status' | 'logCount' | 'createdAt';
type SortDirection = 'asc' | 'desc';
const PAGE_SIZE = 20;

function formatBytes(value: number): string {
  const bytes = Number.isFinite(value) && value > 0 ? value : 0;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = bytes / 1024;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount >= 100 ? amount.toFixed(0) : amount >= 10 ? amount.toFixed(1) : amount.toFixed(2)} ${units[unit]}`;
}

export const LogsPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const dlg = useDialogs(t);
  const touring = useTourActive();
  const [page, setPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);
  const [activeTab, setActiveTab] = useTourState<'logs' | 'sessions'>('logs', 'logs');
  const [query, setQuery] = useTourState('', '');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('lastAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sessionSort, setSessionSort] = useState<SessionSortKey>('status');
  const [sessionDirection, setSessionDirection] = useState<SortDirection>('desc');
  const logList = useServerListPage<GameLog>(serverListUrl('/logs', page, PAGE_SIZE, searchTerm, sortKey, sortDirection));
  const sessionList = useServerListPage<GameSession>(serverListUrl('/game-sessions', sessionPage, PAGE_SIZE, searchTerm, sessionSort, sessionDirection));
  const logs = useTourValue(logList.data?.items || [], tourSamples.gameLogs);
  const logTotal = useTourValue(logList.data?.total || 0, tourSamples.gameLogs.length);
  const sessions = useTourValue(sessionList.data?.items || [], tourSamples.sessions);
  const sessionTotal = useTourValue(sessionList.data?.total || 0, tourSamples.sessions.length);
  const logsLoading = !touring && logList.loading;
  const sessionsLoading = !touring && sessionList.loading;
  const loadLogs = logList.load;
  const loadSessions = sessionList.load;
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadingCross, setUploadingCross] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [endingSession, setEndingSession] = useState<string | null>(null);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);

  const groupName = useCallback((id: string, name?: string) => name || `${t('logs.group')} ${id}`, [t]);
  const sessionGroupLabel = useCallback((session: GameSession, id: string) =>
    `${groupName(id, session.groupNames?.[id])} (${id})`, [groupName]);

  // Both tabs search the full server catalogue, not just the visible page.
  useEffect(() => {
    if (touring) return;
    const timer = window.setTimeout(() => { setSearchTerm(query.trim()); setPage(1); setSessionPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [query, touring]);

  const load = useCallback(async () => {
    if (!touring) await Promise.all([loadLogs(), loadSessions()]);
  }, [loadLogs, loadSessions, touring]);

  useEffect(() => {
    if (touring || !logList.data || logsLoading || logList.error) return;
    const last = Math.max(1, Math.ceil(logList.data.total / PAGE_SIZE));
    if (page > last) setPage(last);
  }, [touring, logList.data, logList.error, logsLoading, page]);
  useEffect(() => {
    if (!touring && sessionList.data && !sessionsLoading && !sessionList.error && sessionPage !== sessionList.data.page)
      setSessionPage(sessionList.data.page);
  }, [touring, sessionList.data, sessionList.error, sessionsLoading, sessionPage]);

  const status = (value: number) => value === 0 ? t('logs.status_active') : value === 1 ? t('logs.status_paused') : t('logs.status_ended');
  const cycleSort = (key: SortKey) => {
    if (key === sortKey) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection(key === 'count' || key === 'storage' ? 'desc' : 'asc'); }
    setPage(1);
  };

  const exportLog = (id: number, format: 'txt' | 'csv' | 'html') => {
    const anchor = document.createElement('a');
    anchor.href = `/api/logs/${id}/export?format=${format}`;
    anchor.click();
  };

  const deleteLog = async (log: GameLog) => {
    const confirmed = await dlg.confirm({
      title: t('logs.delete_log_title'),
      description: t('logs.delete_log_desc', {
        name: log.name,
        id: log.id,
        size: formatBytes(log.storageBytes),
        imageSize: formatBytes(log.imageBytes),
      }),
      destructive: true,
      confirmText: t('common.delete'),
    });
    if (!confirmed) return;
    setDeleting(log.id);
    try {
      const response = await fetch(`/api/logs/${log.id}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok || body.code !== 0) throw new Error(body.message || t('common.delete_fail'));
      toast({ title: t('logs.deleted', { name: log.name }) });
      await load();
    } catch (error) {
      toast({ title: t('common.delete_fail'), description: String(error), variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const uploadLog = async (log: GameLog) => {
    setUploading(log.id);
    try {
      const response = await fetch(`/api/logs/${log.id}/upload`, { method: 'POST' });
      const body = await response.json();
      if (body.code !== 0) throw new Error(body.message);
      const url = body.data?.url || '';
      try { await navigator.clipboard.writeText(url); } catch { /* Clipboard access is optional. */ }
      toast({ title: t('groups.log_uploaded'), description: url });
    } catch (error) {
      toast({ title: t('groups.log_upload_fail'), description: String(error), variant: 'destructive' });
    } finally { setUploading(null); }
  };

  const exportCross = async (session: GameSession, format: 'txt' | 'csv' | 'html') => {
    try {
      const groupNames = Object.fromEntries(session.groups.map((id) => [id, groupName(id, session.groupNames?.[id])]));
      const response = await fetch(`/api/game-sessions/${encodeURIComponent(session.code)}/export`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupNames, format }),
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `cross_game_${session.code}.${format === 'csv' ? 'csv' : format}`; anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t('logs.cross_export_fail'), variant: 'destructive' });
    }
  };

  const uploadCross = async (session: GameSession) => {
    setUploadingCross(session.code);
    try {
      const groupNames = Object.fromEntries(session.groups.map((id) => [id, groupName(id, session.groupNames?.[id])]));
      const response = await fetch(`/api/game-sessions/${encodeURIComponent(session.code)}/upload`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupNames }),
      });
      const body = await response.json();
      if (body.code !== 0) throw new Error(body.message);
      const url = body.data?.url || '';
      try { await navigator.clipboard.writeText(url); } catch { /* Clipboard access is optional. */ }
      toast({ title: t('groups.log_uploaded'), description: url });
    } catch (error) {
      toast({ title: t('groups.log_upload_fail'), description: String(error), variant: 'destructive' });
    } finally { setUploadingCross(null); }
  };


  const endSession = async (session: GameSession) => {
    const confirmed = await dlg.confirm({
      title: t('logs.end_session_title'),
      description: t('logs.end_session_desc', { name: session.name, code: session.code }),
      confirmText: t('logs.end_session'),
    });
    if (!confirmed) return;
    setEndingSession(session.code);
    try {
      const response = await fetch(`/api/game-sessions/${encodeURIComponent(session.code)}`, { method: 'PUT' });
      const body = await response.json();
      if (!response.ok || body.code !== 0) throw new Error(body.message || t('common.save_fail'));
      toast({ title: t('logs.session_ended_toast', { name: session.name }) });
      await load();
    } catch (error) {
      toast({ title: t('logs.end_session_fail'), description: String(error), variant: 'destructive' });
    } finally {
      setEndingSession(null);
    }
  };

  const deleteSession = async (session: GameSession) => {
    const confirmed = await dlg.confirm({
      title: t('logs.delete_session_title'),
      description: t('logs.delete_session_desc', {
        name: session.name,
        code: session.code,
        count: session.logCount,
      }),
      destructive: true,
      confirmText: t('common.delete'),
    });
    if (!confirmed) return;
    setDeletingSession(session.code);
    try {
      const response = await fetch(`/api/game-sessions/${encodeURIComponent(session.code)}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok || body.code !== 0) throw new Error(body.message || t('common.delete_fail'));
      toast({ title: t('logs.session_deleted_toast', { name: session.name }) });
      await load();
    } catch (error) {
      toast({ title: t('logs.delete_session_fail'), description: String(error), variant: 'destructive' });
    } finally {
      setDeletingSession(null);
    }
  };
  const LogActions: React.FC<{ log: GameLog }> = ({ log }) => <LogActionButtons
    onDownload={(format) => exportLog(log.id, format)}
    onUpload={() => void uploadLog(log)}
    onDelete={() => void deleteLog(log)}
    uploading={uploading === log.id}
    deleting={deleting === log.id}
  />;

  const SortHeader: React.FC<{ column: SortKey; children: React.ReactNode }> = ({ column, children }) => (
    <button type="button" onClick={() => cycleSort(column)} className="inline-flex items-center justify-center gap-1 whitespace-nowrap font-medium hover:text-foreground">
      {children}
      {sortKey !== column ? <ArrowUpDown className="h-3.5 w-3.5" /> : sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
    </button>
  );

  return <div className="space-y-6">
    {dlg.node}
    <PageHeader icon={Scroll} title={t('logs.title')} description={t('logs.subtitle')} help={t('page_help.logs')}
      actions={<Button variant="outline" onClick={load} disabled={logsLoading || sessionsLoading}><RefreshCw className="mr-2 h-4 w-4" />{t('common.refresh')}</Button>} />

    <div data-tour="logs-search" className="relative max-w-xl">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(activeTab === 'sessions' ? 'logs.session_search_ph' : 'logs.search_ph')} className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm" />
    </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value === 'sessions' ? 'sessions' : 'logs')}
        className="space-y-4"
      >
        <TabsList variant="page" data-tour="logs-tabs" aria-label={t('logs.title')}>
          <TabsTrigger value="logs"><ScrollText className="h-4 w-4" />{t('logs.tab_logs')} ({logTotal})</TabsTrigger>
          <TabsTrigger value="sessions"><UsersRound className="h-4 w-4" />{t('logs.tab_sessions')} ({sessionTotal})</TabsTrigger>
        </TabsList>

        <TabsContent data-tour="logs-content" value="logs" className="mt-0">
          {!touring && logList.error ? <div role="alert" className="rounded-lg border border-destructive/40 p-5 text-sm"><p>{t('common.load_fail')}</p><Button className="mt-3" variant="outline" onClick={() => void loadLogs()}>{t('common.retry')}</Button></div> :
          logs.length === 0 ? (logsLoading ? <LoadingState /> : <div className="rounded-lg border border-dashed py-14 text-center text-muted-foreground">{t('logs.no_logs')}</div>) :
            <div className={logsLoading ? 'space-y-3 opacity-60' : 'space-y-3'}>
            <div className="rt-frame overflow-x-auto rounded-lg border">
              <table className="rt rt-record rt-with-status w-full sm:min-w-[1220px] text-sm">
                <thead className="bg-muted/50 text-muted-foreground"><tr className="border-b">
                  <th className="p-3 text-center"><SortHeader column="name">{t('logs.col_name')}</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="group">{t('logs.col_group')}</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="status">{t('logs.col_status')}</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="count">{t('logs.col_count')}</SortHeader></th>
                  <th className="p-3 text-center"><div className="flex items-center justify-center gap-1.5"><SortHeader column="storage">{t('logs.col_storage')}</SortHeader><FeatureHelp title={t('logs.col_storage')} description={<p>{t('logs.storage_hint')}</p>} /></div></th>
                  <th className="p-3 text-center"><SortHeader column="game">{t('logs.col_game')}</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="creator">{t('logs.col_creator')}</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="createdAt">{t('logs.col_created')}</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="lastAt">{t('logs.col_last')}</SortHeader></th>
                  <th className="p-3 text-center">{t('logs.col_actions')}</th>
                </tr></thead>
                <tbody>{logs.map((log) => <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td data-label={t('logs.col_name')} className="rt-title p-3 text-center font-medium">#{log.id} · {log.name}</td>
                  <td data-label={t('logs.col_group')} className="rt-body p-3 text-center"><div>{groupName(log.groupId, log.groupName)}</div><div className="font-mono text-xs text-muted-foreground">{log.groupId}</div></td>
                  <td data-label={t('logs.col_status')} className="rt-status p-3 whitespace-nowrap text-center">{status(log.status)}</td>
                  <td data-label={t('logs.col_count')} className="p-3 text-center tabular-nums">{log.count}</td>
                  <td data-label={t('logs.col_storage')} className="p-3 whitespace-nowrap text-center tabular-nums"><div>{formatBytes(log.storageBytes)}</div>{log.imageBytes > 0 && <div className="text-xs text-muted-foreground">{t('logs.storage_images', { size: formatBytes(log.imageBytes) })}</div>}</td>
                  <td data-label={t('logs.col_game')} className="p-3 text-center">{log.gameCode ? <><div>{log.gameName || t('logs.unnamed_session')}</div><div className="font-mono text-xs text-muted-foreground">{log.gameCode}</div></> : <span className="text-muted-foreground">—</span>}</td>
                  <td data-label={t('logs.col_creator')} className="p-3 text-center font-mono text-xs">{log.gmId || '—'}</td>
                  <td data-label={t('logs.col_created')} className="p-3 whitespace-nowrap text-center text-xs">{log.createdAt || '—'}</td>
                  <td data-label={t('logs.col_last')} className="p-3 whitespace-nowrap text-center text-xs">{log.lastAt || '—'}</td>
                  <td data-label={t('common.actions')} className="rt-footer p-3 text-center"><LogActions log={log} /></td>
                </tr>)}</tbody>
              </table>
            </div>
            <PaginationBar total={logTotal} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} fixedSize disabled={logsLoading} />
            </div>}
        </TabsContent>

        <TabsContent value="sessions" className="mt-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('common.sort')}</span>
            <Select value={sessionSort} onValueChange={(value) => { setSessionSort(value as SessionSortKey); setSessionPage(1); }}>
              <SelectTrigger aria-label={t('common.sort')} className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="status">{t('logs.session_status')}</SelectItem>
                <SelectItem value="name">{t('logs.session_name')}</SelectItem>
                <SelectItem value="code">{t('logs.session_code')}</SelectItem>
                <SelectItem value="createdAt">{t('logs.col_created')}</SelectItem>
                <SelectItem value="logCount">{t('logs.log_stats')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => { setSessionDirection((old) => old === 'asc' ? 'desc' : 'asc'); setSessionPage(1); }}>
              {sessionDirection === 'asc' ? <ArrowUp className="mr-1 h-4 w-4" /> : <ArrowDown className="mr-1 h-4 w-4" />}
              {t(sessionDirection === 'asc' ? 'logs.sort_asc' : 'logs.sort_desc')}
            </Button>
          </div>
          {!touring && sessionList.error ? <div role="alert" className="rounded-lg border border-destructive/40 p-5 text-sm"><p>{t('common.load_fail')}</p><Button className="mt-3" variant="outline" onClick={() => void loadSessions()}>{t('common.retry')}</Button></div> :
          sessions.length === 0 ? (sessionsLoading ? <LoadingState /> : <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">{t(searchTerm ? 'logs.no_matching_sessions' : 'logs.no_sessions')}</p>) :
            <div aria-busy={sessionsLoading} className={sessionsLoading ? 'grid gap-4 opacity-60 xl:grid-cols-2' : 'grid gap-4 xl:grid-cols-2'}>{sessions.map((session) => {
              return <article key={session.code} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="font-semibold">{session.name}</h2><p className="mt-1 font-mono text-xs text-muted-foreground">{t('logs.session_code')} {session.code}</p></div>
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <span className="mr-1 text-xs text-muted-foreground">{session.active ? t('logs.session_active') : t('logs.session_ended')}</span>
                    {session.active && <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={endingSession === session.code} onClick={() => void endSession(session)}>{endingSession === session.code ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CircleStop className="mr-1 h-3.5 w-3.5" />}{t('logs.end_session')}</Button>}
                    <LogActionButtons
                      onDownload={(format) => void exportCross(session, format)}
                      onUpload={() => void uploadCross(session)}
                      onDelete={() => void deleteSession(session)}
                      downloadDisabled={!session.logCount}
                      uploading={uploadingCross === session.code}
                      deleting={deletingSession === session.code}
                    />
                  </div>
                </div>
                <dl className="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">{t('logs.col_created')}</dt><dd className="mt-1">{session.createdAt || '—'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{t('logs.session_status')}</dt><dd className="mt-1">{session.active ? t('logs.session_active') : t('logs.session_ended')}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">GM</dt><dd className="mt-1 break-all">{session.gms?.join('、') || '—'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{t('logs.players')}</dt><dd className="mt-1 break-all">{session.players?.join('、') || '—'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">{t('logs.joined_groups')}</dt><dd className="mt-1 break-all">{session.groups.map((id) => sessionGroupLabel(session, id)).join('、') || '—'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">{t('logs.log_stats')}</dt><dd className="mt-1">{t('logs.log_stats_value', { total: session.logCount, active: session.activeLogs, paused: session.pausedLogs, ended: session.endedLogs })}</dd></div>
                </dl>
              </article>;
            })}</div>}
          {(touring || !sessionList.error) && <PaginationBar total={sessionTotal} page={sessionPage} pageSize={PAGE_SIZE} onPageChange={setSessionPage} fixedSize disabled={sessionsLoading} />}
        </TabsContent>
      </Tabs>
  </div>;
};

export default LogsPage;
