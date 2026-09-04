import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpDown, CircleStop, Loader2, RefreshCw, Scroll, Search, ScrollText, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingState } from '@/components/ui/state';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { LogActionButtons } from '@/components/log-action-buttons';

interface GameLog {
  id: number;
  groupId: string;
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
}

interface Group { groupId: string; name?: string; groupName?: string; }
type SortKey = 'name' | 'group' | 'status' | 'count' | 'storage' | 'game' | 'creator' | 'createdAt' | 'lastAt';
type SortDirection = 'asc' | 'desc';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json();
  if (body.code !== 0) throw new Error(body.message || 'request failed');
  return body.data as T;
}

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
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'logs' | 'sessions'>('logs');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('lastAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadingCross, setUploadingCross] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [endingSession, setEndingSession] = useState<string | null>(null);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);

  const groupName = useCallback((id: string) => {
    const group = groups.find((item) => item.groupId === id);
    return group?.groupName || group?.name || `${t('logs.group')} ${id}`;
  }, [groups, t]);

  const groupLabel = useCallback((id: string) => `${groupName(id)} (${id})`, [groupName]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logRows, sessionRows, groupRows] = await Promise.all([
        getJson<GameLog[]>('/api/logs'),
        getJson<GameSession[]>('/api/game-sessions'),
        getJson<Group[]>('/api/groups').catch(() => []),
      ]);
      setLogs(logRows || []);
      setSessions(sessionRows || []);
      setGroups(groupRows || []);
    } catch {
      toast({ title: t('common.load_fail'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => { void load(); }, [load]);

  const status = (value: number) => value === 0 ? t('logs.status_active') : value === 1 ? t('logs.status_paused') : t('logs.status_ended');
  const cycleSort = (key: SortKey) => {
    if (key === sortKey) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection(key === 'count' || key === 'storage' ? 'desc' : 'asc'); }
  };

  const visibleLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = !normalized ? logs : logs.filter((log) => [
      log.name, log.groupId, groupName(log.groupId), log.gameCode, log.gameName, log.gmId,
    ].some((value) => (value || '').toLowerCase().includes(normalized)));
    const valueFor = (log: GameLog): string | number => {
      switch (sortKey) {
        case 'group': return groupLabel(log.groupId);
        case 'status': return log.status;
        case 'count': return log.count;
        case 'storage': return log.storageBytes || 0;
        case 'game': return `${log.gameName || ''} ${log.gameCode || ''}`;
        case 'creator': return log.gmId;
        case 'createdAt': return log.createdAt || '';
        case 'lastAt': return log.lastAt || log.createdAt || '';
        default: return log.name;
      }
    };
    return [...filtered].sort((left, right) => {
      const a = valueFor(left); const b = valueFor(right);
      const result = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'zh-Hans-CN');
      return sortDirection === 'asc' ? result : -result;
    });
  }, [groupLabel, groupName, logs, query, sortDirection, sortKey]);

  const visibleSessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sessions;
    return sessions.filter((session) => [
      session.name, session.code, ...session.groups.map(groupLabel), ...session.gms, ...session.players,
    ].some((value) => (value || '').toLowerCase().includes(normalized)));
  }, [groupLabel, query, sessions]);

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
      const groupNames = Object.fromEntries(session.groups.map((id) => [id, groupName(id)]));
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
      const groupNames = Object.fromEntries(session.groups.map((id) => [id, groupName(id)]));
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Scroll className="h-5 w-5" />{t('logs.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('logs.subtitle')}</p>
      </div>
      <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{t('common.refresh')}</Button>
    </div>

    <div data-tour="logs-search" className="relative max-w-xl">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('logs.search_ph')} className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" />
    </div>

    {loading ? <LoadingState /> :
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value === 'sessions' ? 'sessions' : 'logs')}
        className="space-y-4"
      >
        <TabsList data-tour="logs-tabs">
          <TabsTrigger value="logs"><ScrollText className="mr-2 h-4 w-4" />{t('logs.tab_logs')} ({visibleLogs.length})</TabsTrigger>
          <TabsTrigger value="sessions"><UsersRound className="mr-2 h-4 w-4" />{t('logs.tab_sessions')} ({visibleSessions.length})</TabsTrigger>
        </TabsList>

        <TabsContent data-tour="logs-content" value="logs" className="mt-0">
          {visibleLogs.length === 0 ? <div className="rounded-lg border border-dashed py-14 text-center text-muted-foreground">{t('logs.no_logs')}</div> :
            <div className="overflow-x-auto rounded-lg border">
              <table className="rt w-full sm:min-w-[1220px] text-sm">
                <thead className="bg-muted/50 text-muted-foreground"><tr className="border-b">
                  <th className="p-3 text-center"><SortHeader column="name">{t('logs.col_name')}</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="group">{t('logs.col_group')}</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="status">{t('logs.col_status')}</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="count">{t('logs.col_count')}</SortHeader></th>
                  <th className="p-3 text-center" title={t('logs.storage_hint')}><SortHeader column="storage">{t('logs.col_storage')}</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="game">{t('logs.col_game')}</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="creator">{t('logs.col_creator')}</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="createdAt">{t('logs.col_created')}</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="lastAt">{t('logs.col_last')}</SortHeader></th>
                  <th className="p-3 text-center">{t('logs.col_actions')}</th>
                </tr></thead>
                <tbody>{visibleLogs.map((log) => <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td data-label={t('logs.col_name')} className="p-3 text-center font-medium">#{log.id} · {log.name}</td>
                  <td data-label={t('logs.col_group')} className="p-3 text-center"><div>{groupName(log.groupId)}</div><div className="font-mono text-xs text-muted-foreground">{log.groupId}</div></td>
                  <td data-label={t('logs.col_status')} className="p-3 whitespace-nowrap text-center">{status(log.status)}</td>
                  <td data-label={t('logs.col_count')} className="p-3 text-center tabular-nums">{log.count}</td>
                  <td data-label={t('logs.col_storage')} className="p-3 whitespace-nowrap text-center tabular-nums"><div>{formatBytes(log.storageBytes)}</div>{log.imageBytes > 0 && <div className="text-xs text-muted-foreground">{t('logs.storage_images', { size: formatBytes(log.imageBytes) })}</div>}</td>
                  <td data-label={t('logs.col_game')} className="p-3 text-center">{log.gameCode ? <><div>{log.gameName || t('logs.unnamed_session')}</div><div className="font-mono text-xs text-muted-foreground">{log.gameCode}</div></> : <span className="text-muted-foreground">—</span>}</td>
                  <td data-label={t('logs.col_creator')} className="p-3 text-center font-mono text-xs">{log.gmId || '—'}</td>
                  <td data-label={t('logs.col_created')} className="p-3 whitespace-nowrap text-center text-xs">{log.createdAt || '—'}</td>
                  <td data-label={t('logs.col_last')} className="p-3 whitespace-nowrap text-center text-xs">{log.lastAt || '—'}</td>
                  <td data-label={t('common.actions')} className="p-3 text-center"><LogActions log={log} /></td>
                </tr>)}</tbody>
              </table>
            </div>}
        </TabsContent>

        <TabsContent value="sessions" className="mt-0 space-y-3">
          {visibleSessions.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">{t('logs.no_sessions')}</p> :
            <div className="grid gap-4 xl:grid-cols-2">{visibleSessions.map((session) => {
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
                  <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">{t('logs.joined_groups')}</dt><dd className="mt-1 break-all">{session.groups.map(groupLabel).join('、') || '—'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">{t('logs.log_stats')}</dt><dd className="mt-1">{t('logs.log_stats_value', { total: session.logCount, active: session.activeLogs, paused: session.pausedLogs, ended: session.endedLogs })}</dd></div>
                </dl>
              </article>;
            })}</div>}
        </TabsContent>
      </Tabs>}
  </div>;
};

export default LogsPage;
