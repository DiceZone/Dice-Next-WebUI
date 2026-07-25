import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Loader2, RefreshCw, Search, ScrollText, Upload, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface GameLog {
  id: number;
  groupId: string;
  gmId: string;
  name: string;
  status: number;
  createdAt: string;
  lastAt: string;
  count: number;
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
type SortKey = 'name' | 'group' | 'status' | 'count' | 'game' | 'creator' | 'createdAt' | 'lastAt';
type SortDirection = 'asc' | 'desc';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json();
  if (body.code !== 0) throw new Error(body.message || 'request failed');
  return body.data as T;
}

export const LogsPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('lastAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadingCross, setUploadingCross] = useState<string | null>(null);

  const groupName = useCallback((id: string) => {
    const group = groups.find((item) => item.groupId === id);
    return group?.groupName || group?.name || `群 ${id}`;
  }, [groups]);

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
    else { setSortKey(key); setSortDirection(key === 'count' ? 'desc' : 'asc'); }
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
      toast({ title: '跨团日志导出失败', variant: 'destructive' });
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

  const LogActions: React.FC<{ log: GameLog }> = ({ log }) => (
    <div className="flex flex-wrap justify-center gap-1 whitespace-nowrap">
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => exportLog(log.id, 'txt')}><Download className="mr-1 h-3.5 w-3.5" />TXT</Button>
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => exportLog(log.id, 'csv')}><Download className="mr-1 h-3.5 w-3.5" />Excel</Button>
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => exportLog(log.id, 'html')}><Download className="mr-1 h-3.5 w-3.5" />导出网页</Button>
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={uploading === log.id} onClick={() => void uploadLog(log)}>
        {uploading === log.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}上传
      </Button>
    </div>
  );

  const SortHeader: React.FC<{ column: SortKey; children: React.ReactNode }> = ({ column, children }) => (
    <button type="button" onClick={() => cycleSort(column)} className="inline-flex items-center justify-center gap-1 whitespace-nowrap font-medium hover:text-foreground">
      {children}
      {sortKey !== column ? <ArrowUpDown className="h-3.5 w-3.5" /> : sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
    </button>
  );

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">日志管理</h1>
        <p className="text-sm text-muted-foreground">集中查看所有日志，或按团务管理跨群跑团记录。</p>
      </div>
      <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{t('common.refresh')}</Button>
    </div>

    <div className="relative max-w-xl">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索群名、群号、日志名、团名、团号或创建人" className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" />
    </div>

    {loading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> :
      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs"><ScrollText className="mr-2 h-4 w-4" />日志管理 ({visibleLogs.length})</TabsTrigger>
          <TabsTrigger value="sessions"><UsersRound className="mr-2 h-4 w-4" />团务管理 ({visibleSessions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-0">
          {visibleLogs.length === 0 ? <div className="rounded-lg border border-dashed py-14 text-center text-muted-foreground">{t('logs.no_logs')}</div> :
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-muted/50 text-muted-foreground"><tr className="border-b">
                  <th className="p-3 text-center"><SortHeader column="name">日志名</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="group">所属群号</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="status">状态</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="count">已记录条数</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="game">所属团</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="creator">创建人</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="createdAt">创建时间</SortHeader></th>
                  <th className="p-3 text-center"><SortHeader column="lastAt">最后记录时间</SortHeader></th>
                  <th className="p-3 text-center">操作</th>
                </tr></thead>
                <tbody>{visibleLogs.map((log) => <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 text-center font-medium">#{log.id} · {log.name}</td>
                  <td className="p-3 text-center"><div>{groupName(log.groupId)}</div><div className="font-mono text-xs text-muted-foreground">{log.groupId}</div></td>
                  <td className="p-3 whitespace-nowrap text-center">{status(log.status)}</td>
                  <td className="p-3 text-center tabular-nums">{log.count}</td>
                  <td className="p-3 text-center">{log.gameCode ? <><div>{log.gameName || '未命名团务'}</div><div className="font-mono text-xs text-muted-foreground">{log.gameCode}</div></> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3 text-center font-mono text-xs">{log.gmId || '—'}</td>
                  <td className="p-3 whitespace-nowrap text-center text-xs">{log.createdAt || '—'}</td>
                  <td className="p-3 whitespace-nowrap text-center text-xs">{log.lastAt || '—'}</td>
                  <td className="p-3 text-center"><LogActions log={log} /></td>
                </tr>)}</tbody>
              </table>
            </div>}
        </TabsContent>

        <TabsContent value="sessions" className="mt-0 space-y-3">
          {visibleSessions.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">暂无跨群团务日志。开团后可在其他群使用团号接入。</p> :
            <div className="grid gap-4 xl:grid-cols-2">{visibleSessions.map((session) => {
              return <article key={session.code} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{session.name}</h2><p className="mt-1 font-mono text-xs text-muted-foreground">团号 {session.code}</p></div><div className="flex flex-wrap items-center justify-end gap-1"><span className="mr-1 text-xs text-muted-foreground">{session.active ? '进行中' : '已结团'}</span><Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => void exportCross(session, 'txt')} disabled={!session.logCount}><Download className="mr-1 h-3.5 w-3.5" />TXT</Button><Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => void exportCross(session, 'csv')} disabled={!session.logCount}><Download className="mr-1 h-3.5 w-3.5" />Excel</Button><Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => void exportCross(session, 'html')} disabled={!session.logCount}><Download className="mr-1 h-3.5 w-3.5" />导出网页</Button><Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={!session.logCount || uploadingCross === session.code} onClick={() => void uploadCross(session)}>{uploadingCross === session.code ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}上传</Button></div></div>
                <dl className="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">创建时间</dt><dd className="mt-1">{session.createdAt || '—'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">团务状态</dt><dd className="mt-1">{session.active ? '进行中' : '已结团'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">GM</dt><dd className="mt-1 break-all">{session.gms?.join('、') || '—'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">玩家</dt><dd className="mt-1 break-all">{session.players?.join('、') || '—'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">接入群</dt><dd className="mt-1 break-all">{session.groups.map(groupLabel).join('、') || '—'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">日志统计</dt><dd className="mt-1">共 {session.logCount} 条 · 进行中 {session.activeLogs} 条 · 暂停 {session.pausedLogs} 条 · 已结束 {session.endedLogs} 条</dd></div>
                </dl>
              </article>;
            })}</div>}
        </TabsContent>
      </Tabs>}
  </div>;
};

export default LogsPage;
