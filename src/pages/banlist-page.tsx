import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PlatformIcon } from '@/components/platform-icon';
import { ShieldCheck, Plus, Trash2, RefreshCw, Bot, Search, Users, Cloud } from 'lucide-react';

interface BanEntry {
  id: number; targetType: number; listType: number;
  targetId: string; reason: string; createdAt: string;
}
interface Player { platform: string; userId: string; nickname: string; trustLevel: number; }
interface Master { platform: string; id: string; }
interface GroupInfo { platform: string; groupId: string; name: string; }

async function jsend(method: string, path: string, body?: unknown) {
  const r = await fetch('/api' + path, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.message);
  return j.data;
}

const fmtTs = (iso?: string) => iso ? iso.replace('T', ' ').slice(0, 19) : '';

// ── 权限管理选项卡：用户信任等级 + 白名单群 ────────────────────────
const PermTab: React.FC<{ entries: BanEntry[]; reload: () => Promise<void>; del: (id: number) => Promise<void> }> = ({ entries, reload, del }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);   // C#94：默认每页 20
  const [whitelistOnly, setWhitelistOnly] = useState(false);
  const [masters, setMasters] = useState<Master[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [dlgUser, setDlgUser] = useState('');
  const [dlgLv, setDlgLv] = useState(1);
  const [dlgPlatform, setDlgPlatform] = useState('onebot_v11');
  // 白名单群添加表单（C#94：白名单只针对群——用户白名单=信任等级）
  const [wId, setWId] = useState('');
  const [wReason, setWReason] = useState('');

  const loadPlayers = useCallback(async () => {
    try {
      const d = await jsend('GET', '/players');
      setPlayers((Array.isArray(d) ? d : d?.players || []) as Player[]);
      const w = await jsend('GET', '/banlist/whitelist-only'); setWhitelistOnly(!!w.enabled);
      const m = await jsend('GET', '/masters'); setMasters(Array.isArray(m) ? m : ((m as any)?.items || []));
      setAllPlayers(Array.isArray(d) ? d : d?.players || []);
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  }, [toast]);
  useEffect(() => { void loadPlayers(); }, [loadPlayers]);

  // 信任等级切换。「骰主」(256) 是可选等级之一：选中=加入 dice.masters；
  // 从骰主切到其他等级=移出 masters 并写入所选信任值。
  const setTrust = async (p: Player, lv: number) => {
    try {
      const isM = masters.some((m) => m.id === p.userId);
      if (lv === 256) {
        if (!isM) { const m = await jsend('POST', '/masters', { platform: p.platform, id: p.userId }); setMasters(Array.isArray(m) ? m : ((m as any)?.items || [])); }
      } else {
        if (isM) { const m = await jsend('DELETE', `/masters/${p.platform || '_'}/${p.userId}`); setMasters(Array.isArray(m) ? m : []); }
        await jsend('PUT', `/players/${p.platform}/${p.userId}`, { trustLevel: lv });
      }
      void loadPlayers();
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); void loadPlayers(); }
  };
  const toggleWhitelistOnly = async (v: boolean) => {
    setWhitelistOnly(v);
    try { await jsend('PUT', '/banlist/whitelist-only', { enabled: v }); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); setWhitelistOnly(!v); }
  };
  const addWhite = async () => {
    if (!wId.trim()) { toast({ title: t('banlist.id_required'), variant: 'destructive' }); return; }
    try {
      await jsend('POST', '/banlist', { targetType: 1, listType: 1, targetId: wId.trim(), reason: wReason.trim() });
      setWId(''); setWReason(''); await reload();
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return players;
    return players.filter((p) => p.userId.toLowerCase().includes(s) || (p.nickname || '').toLowerCase().includes(s));
  }, [players, q]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);
  const whites = entries.filter((e) => e.listType === 1);
  const masterSet = useMemo(() => new Set(masters.map((m) => m.id)), [masters]);
  useEffect(() => {
    setPlayers(allPlayers.filter((p) => p.trustLevel > 0 || masterSet.has(p.userId)));
  }, [allPlayers, masterSet]);

  // C#94：添加弹窗先选平台，搜索范围随平台过滤。
  const searchResults = useMemo(() => {
    const s = dlgUser.trim().toLowerCase();
    if (!s) return [];
    return allPlayers.filter((p) => p.platform === dlgPlatform)
      .filter((p) => !players.some((x) => x.platform === p.platform && x.userId === p.userId))
      .filter((p) => p.userId.includes(s) || (p.nickname || '').toLowerCase().includes(s))
      .slice(0, 8);
  }, [dlgUser, dlgPlatform, allPlayers, players]);
  const doAddPerm = async () => {
    const uid = dlgUser.trim();
    if (!uid) { toast({ title: t('banlist.id_required'), variant: 'destructive' }); return; }
    try {
      if (dlgLv === 256) {   // 添加为骰主 → 写 dice.masters
        const m = await jsend('POST', '/masters', { platform: dlgPlatform, id: uid });
        setMasters(Array.isArray(m) ? m : []);
      } else {
        await jsend('PUT', `/players/${dlgPlatform}/${uid}`, { trustLevel: dlgLv });
      }
      setDlgUser(''); setDlgLv(1); setAddOpen(false);
      void loadPlayers();
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };

  return (
    <>
      {/* 添加权限用户弹窗 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('banlist.perm_add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('banlist.perm_add_platform')}</Label>
              <Select value={dlgPlatform} onValueChange={(v) => { setDlgPlatform(v); setDlgUser(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="onebot_v11"><span className="flex items-center gap-2"><PlatformIcon platform="onebot_v11" />QQ</span></SelectItem>
                  <SelectItem value="discord" disabled><span className="flex items-center gap-2"><PlatformIcon platform="discord" />Discord</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('banlist.perm_add_user')}</Label>
              <Input value={dlgUser} onChange={(e) => setDlgUser(e.target.value)} placeholder={t('banlist.perm_add_user_ph')} />
              {searchResults.length > 0 && (
                <div className="rounded-md border max-h-40 overflow-auto">
                  {searchResults.map((p) => (
                    <div key={p.platform + p.userId}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
                      onClick={() => setDlgUser(p.userId)}>
                      <span className="font-mono">{p.userId}</span>
                      {p.nickname && <span className="text-muted-foreground truncate">{p.nickname}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('banlist.perm_add_level')}</Label>
              <Select value={String(dlgLv)} onValueChange={(v) => setDlgLv(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('banlist.perm_lv1')}</SelectItem>
                  <SelectItem value="2">{t('banlist.perm_lv2')}</SelectItem>
                  <SelectItem value="3">{t('banlist.perm_lv3')}</SelectItem>
                  <SelectItem value="4">{t('banlist.perm_lv4')}</SelectItem>
                  <SelectItem value="256" className="text-red-600 dark:text-red-400">{t('banlist.perm_master')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={doAddPerm}>{t('common.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    <div className="space-y-4">
      {/* 用户信任等级 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />{t('banlist.perm_users')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('banlist.perm_users_desc')}</p>
          <div className="flex items-center gap-2">
            {/* C#94：添加按钮在搜索框左边 */}
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-3 w-3" />{t('banlist.perm_add')}
            </Button>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8 h-9" value={q} placeholder={t('banlist.perm_search_ph')}
                onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('banlist.perm_empty')}</p>
          ) : (
            <>
              <div className="overflow-x-auto"><table className="rt w-full text-sm">
                <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left w-12"></th>
                    <th className="p-2 text-left">{t('banlist.perm_col_user')}</th>
                    {/* C#97：身份列已删（与信任等级下拉重复） */}
                    <th className="p-2 text-left">{t('banlist.perm_col_trust')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => (
                    <tr key={p.platform + p.userId} className="border-b last:border-0">
                      <td data-label={t('groups.col_avatar')} className="p-2">
                        <img src={`https://q1.qlogo.cn/g?b=qq&nk=${p.userId}&s=100`} alt=""
                          className="h-8 w-8 rounded-full object-cover"
                          onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
                      </td>
                      <td data-label={t('banlist.perm_col_user')} className="p-2">
                        <span className="inline-flex items-center gap-1.5 font-mono"><PlatformIcon platform={p.platform} className="h-3.5 w-3.5" />{p.userId}</span>
                        {p.nickname && <span className="ml-2 text-muted-foreground">{p.nickname}</span>}
                      </td>
                      <td data-label={t('banlist.perm_col_trust')} className="p-2">
                        <Select value={masterSet.has(p.userId) ? '256' : String(p.trustLevel)} onValueChange={(v) => void setTrust(p, Number(v))}>
                          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">{t('banlist.perm_lv0')}</SelectItem>
                            <SelectItem value="1">{t('banlist.perm_lv1')}</SelectItem>
                            <SelectItem value="2">{t('banlist.perm_lv2')}</SelectItem>
                            <SelectItem value="3">{t('banlist.perm_lv3')}</SelectItem>
                            <SelectItem value="4">{t('banlist.perm_lv4')}</SelectItem>
                            {!masterSet.has(p.userId) && p.trustLevel > 4 && (
                              <SelectItem value={String(p.trustLevel)}>{t('banlist.perm_trust_n', { n: p.trustLevel })}</SelectItem>
                            )}
                            <SelectItem value="256" className="text-red-600 dark:text-red-400">{t('banlist.perm_master')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              <PaginationBar total={filtered.length} page={curPage} pageSize={pageSize}
                onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
            </>
          )}
        </CardContent>
      </Card>

      {/* C#94：白名单群（用户白名单=信任等级，只有群需要单独设置） */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{t('banlist.perm_white_group')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('banlist.perm_white_group_desc')}</p>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm font-medium">{t('banlist.whitelist_only')}</Label>
              <p className="text-xs text-muted-foreground">{t('banlist.whitelist_only_desc')}</p>
            </div>
            <Switch checked={whitelistOnly} onCheckedChange={toggleWhitelistOnly} />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('banlist.group_id')}</Label>
              <Input className="w-40 h-9" value={wId} onChange={(e) => setWId(e.target.value)} placeholder={t('banlist.id_ph')} />
            </div>
            <div className="space-y-1 flex-1 min-w-[160px]">
              <Label className="text-xs">{t('banlist.reason')}</Label>
              <Input className="h-9" value={wReason} onChange={(e) => setWReason(e.target.value)} placeholder={t('banlist.reason_ph')} />
            </div>
            <Button size="sm" onClick={addWhite}><Plus className="mr-1 h-4 w-4" />{t('common.add')}</Button>
          </div>
          {whites.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('banlist.empty')}</p>
          ) : (
            <div className="overflow-x-auto"><table className="rt w-full text-sm">
              <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-left w-12"></th>
                  <th className="p-2 text-left">{t('banlist.id')}</th>
                  <th className="p-2 text-left">{t('banlist.reason')}</th>
                  <th className="p-2 text-left">{t('banlist.time')}</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {whites.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td data-label={t('groups.col_avatar')} className="p-2">
                      {e.targetType === 1 ? (
                        <img src={`https://p.qlogo.cn/gh/${e.targetId}/${e.targetId}/100`} alt=""
                          className="h-8 w-8 rounded-full object-cover"
                          onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">{t('banlist.user')}</Badge>
                      )}
                    </td>
                    <td data-label={t('banlist.id')} className="p-2 font-mono">{e.targetId}</td>
                    <td data-label={t('banlist.reason')} className="p-2 text-muted-foreground">{e.reason || '—'}</td>
                    <td data-label={t('banlist.time')} className="p-2 text-xs text-muted-foreground">{fmtTs(e.createdAt)}</td>
                    <td data-label={t('common.actions')} className="p-2 text-right">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => del(e.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
};

// ── C#95 黑名单选项卡：与信任等级列表一致的「按钮+弹窗+表格」模式 ──────
const BlackTab: React.FC<{ entries: BanEntry[]; reload: () => Promise<void>; del: (id: number) => Promise<void> }> = ({ entries, reload, del }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [addOpen, setAddOpen] = useState(false);
  const [dlgPlatform, setDlgPlatform] = useState('onebot_v11');
  const [dlgType, setDlgType] = useState(0);   // 0=用户 1=群
  const [dlgId, setDlgId] = useState('');
  const [dlgReason, setDlgReason] = useState('');
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [allGroups, setAllGroups] = useState<GroupInfo[]>([]);

  useEffect(() => {
    void (async () => {
      try { const d = await jsend('GET', '/players'); setAllPlayers(Array.isArray(d) ? d : []); } catch { /* ignore */ }
      try { const g = await jsend('GET', '/groups'); setAllGroups(Array.isArray(g) ? g : []); } catch { /* ignore */ }
    })();
  }, []);

  const blacks = entries.filter((e) => e.listType === 0);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return blacks;
    return blacks.filter((e) => e.targetId.toLowerCase().includes(s) || (e.reason || '').toLowerCase().includes(s));
  }, [blacks, q]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);

  // 搜索候选：按平台 + 类型（用户搜玩家库 / 群搜群列表）。
  const searchResults = useMemo(() => {
    const s = dlgId.trim().toLowerCase();
    if (!s) return [] as { id: string; label: string }[];
    if (dlgType === 0)
      return allPlayers.filter((p) => p.platform === dlgPlatform)
        .filter((p) => p.userId.includes(s) || (p.nickname || '').toLowerCase().includes(s))
        .slice(0, 8).map((p) => ({ id: p.userId, label: p.nickname || '' }));
    return allGroups.filter((g) => g.platform === dlgPlatform)
      .filter((g) => g.groupId.includes(s) || (g.name || '').toLowerCase().includes(s))
      .slice(0, 8).map((g) => ({ id: g.groupId, label: g.name || '' }));
  }, [dlgId, dlgType, dlgPlatform, allPlayers, allGroups]);

  const nameOf = (e: BanEntry) => {
    if (e.targetType === 1) return allGroups.find((g) => g.groupId === e.targetId)?.name || '';
    return allPlayers.find((p) => p.userId === e.targetId)?.nickname || '';
  };

  const doAdd = async () => {
    const id = dlgId.trim();
    if (!id) { toast({ title: t('banlist.id_required'), variant: 'destructive' }); return; }
    try {
      await jsend('POST', '/banlist', { targetType: dlgType, listType: 0, targetId: id, reason: dlgReason.trim() });
      setDlgId(''); setDlgReason(''); setAddOpen(false);
      await reload();
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };

  return (
    <>
      {/* 添加黑名单弹窗 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('banlist.add_black')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('banlist.perm_add_platform')}</Label>
              <Select value={dlgPlatform} onValueChange={(v) => { setDlgPlatform(v); setDlgId(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="onebot_v11"><span className="flex items-center gap-2"><PlatformIcon platform="onebot_v11" />QQ</span></SelectItem>
                  <SelectItem value="discord" disabled><span className="flex items-center gap-2"><PlatformIcon platform="discord" />Discord</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('banlist.target')}</Label>
              <Select value={String(dlgType)} onValueChange={(v) => { setDlgType(Number(v)); setDlgId(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('banlist.user')}</SelectItem>
                  <SelectItem value="1">{t('banlist.group')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{dlgType === 1 ? t('banlist.group_id') : t('banlist.perm_add_user')}</Label>
              <Input value={dlgId} onChange={(e) => setDlgId(e.target.value)} placeholder={t('banlist.perm_add_user_ph')} />
              {searchResults.length > 0 && (
                <div className="rounded-md border max-h-40 overflow-auto">
                  {searchResults.map((r) => (
                    <div key={r.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
                      onClick={() => setDlgId(r.id)}>
                      <span className="font-mono">{r.id}</span>
                      {r.label && <span className="text-muted-foreground truncate">{r.label}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('banlist.reason')}</Label>
              <Input value={dlgReason} onChange={(e) => setDlgReason(e.target.value)} placeholder={t('banlist.reason_ph')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={doAdd}>{t('common.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-3 w-3" />{t('banlist.add_black')}
            </Button>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8 h-9" value={q} placeholder={t('banlist.black_search_ph')}
                onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('banlist.empty')}</p>
          ) : (
            <>
              <div className="overflow-x-auto"><table className="rt w-full text-sm">
                <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left w-12"></th>
                    <th className="p-2 text-left">{t('banlist.perm_col_user')}</th>
                    <th className="p-2 text-left">{t('banlist.target')}</th>
                    <th className="p-2 text-left">{t('banlist.reason')}</th>
                    <th className="p-2 text-left">{t('banlist.time')}</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td data-label={t('groups.col_avatar')} className="p-2">
                        <img
                          src={e.targetType === 1
                            ? `https://p.qlogo.cn/gh/${e.targetId}/${e.targetId}/100`
                            : `https://q1.qlogo.cn/g?b=qq&nk=${e.targetId}&s=100`}
                          alt="" className="h-8 w-8 rounded-full object-cover"
                          onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
                      </td>
                      <td data-label={t('banlist.perm_col_user')} className="p-2">
                        <span className="font-mono">{e.targetId}</span>
                        {nameOf(e) && <span className="ml-2 text-muted-foreground">{nameOf(e)}</span>}
                      </td>
                      <td data-label={t('banlist.target')} className="p-2">
                        <Badge variant="outline" className="text-[10px]">
                          {e.targetType === 1 ? t('banlist.group') : t('banlist.user')}
                        </Badge>
                      </td>
                      <td data-label={t('banlist.reason')} className="p-2 text-muted-foreground">
                        {(e.reason || '').startsWith('[云黑#') && (
                          <Badge variant="secondary" className="mr-1.5 text-[10px]">{t('banlist.cloudban_badge')}</Badge>
                        )}
                        {e.reason || '—'}
                      </td>
                      <td data-label={t('banlist.time')} className="p-2 text-xs text-muted-foreground">{fmtTs(e.createdAt)}</td>
                      <td data-label={t('common.actions')} className="p-2 text-right">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => del(e.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              <PaginationBar total={filtered.length} page={curPage} pageSize={pageSize}
                onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
};

// ── 云黑名单：云端共享黑名单同步配置 ─────────────────────────────
interface CloudBanConf {
  enabled: boolean; url: string; token_set: boolean; token_tail: string;
  share: boolean; min_danger: number; sync_interval: number; cursor: number;
  last_sync_at: string; last_sync_added: number; last_sync_removed: number; last_error: string;
}

const CloudBanTab: React.FC<{ reload: () => Promise<void> }> = ({ reload }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [c, setC] = useState<CloudBanConf>({
    enabled: false, url: '', token_set: false, token_tail: '', share: false,
    min_danger: 2, sync_interval: 21600, cursor: 0,
    last_sync_at: '', last_sync_added: 0, last_sync_removed: 0, last_error: '',
  });
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await jsend('GET', '/system/cloudban') as Partial<CloudBanConf>;
      setC((prev) => ({ ...prev, ...d }));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await jsend('PUT', '/system/cloudban', {
        enabled: c.enabled, url: c.url.trim(), token,   // token 留空 = 不修改
        share: c.share, min_danger: c.min_danger, sync_interval: c.sync_interval,
      });
      setToken(''); await load();
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const d = await jsend('POST', '/system/cloudban/sync');
      toast({ title: t('banlist.cloudban_sync_done'), description: t('banlist.cloudban_sync_result', { added: d?.added ?? 0, removed: d?.removed ?? 0 }) });
      await load(); await reload();
    } catch (e) { toast({ title: t('banlist.cloudban_sync_fail'), description: (e as Error).message, variant: 'destructive' }); }
    finally { setSyncing(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Cloud className="h-4 w-4" />{t('banlist.cloudban_title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {t('banlist.cloudban_desc')}
        </p>
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t('banlist.cloudban_enable')}</Label>
          <Switch checked={c.enabled} onCheckedChange={(v) => setC({ ...c, enabled: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('banlist.cloudban_url')}</Label>
          <Input className="h-8 font-mono text-xs" value={c.url}
            onChange={(e) => setC({ ...c, url: e.target.value })} placeholder="https://cloudban.dice.zone" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Access Token</Label>
          <Input className="h-8 text-sm" type="password" value={token} onChange={(e) => setToken(e.target.value)}
            placeholder={c.token_set ? t('banlist.cloudban_token_set_ph', { tail: c.token_tail }) : t('banlist.cloudban_token_unset_ph')} />
          <p className="text-[11px] text-muted-foreground">{t('banlist.cloudban_token_hint')}</p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm">{t('banlist.cloudban_share')}</Label>
            <p className="text-xs text-muted-foreground">{t('banlist.cloudban_share_desc')}</p>
          </div>
          <Switch checked={c.share} onCheckedChange={(v) => setC({ ...c, share: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('banlist.cloudban_min_danger')}</Label>
          <Select value={String(c.min_danger)} onValueChange={(v) => setC({ ...c, min_danger: Number(v) })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{t('banlist.cloudban_danger1')}</SelectItem>
              <SelectItem value="2">{t('banlist.cloudban_danger2')}</SelectItem>
              <SelectItem value="3">{t('banlist.cloudban_danger3')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('banlist.cloudban_interval')}</Label>
          <Select value={String(c.sync_interval)} onValueChange={(v) => setC({ ...c, sync_interval: Number(v) })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3600">{t('banlist.cloudban_iv_1h')}</SelectItem>
              <SelectItem value="21600">{t('banlist.cloudban_iv_6h')}</SelectItem>
              <SelectItem value="43200">{t('banlist.cloudban_iv_12h')}</SelectItem>
              <SelectItem value="86400">{t('banlist.cloudban_iv_24h')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{t('banlist.cloudban_last')}</span>
          {c.last_sync_at ? (
            <>
              <span className="text-muted-foreground">{fmtTs(c.last_sync_at)}</span>
              <Badge variant="outline" className="text-[10px]">{t('banlist.cloudban_added', { n: c.last_sync_added ?? 0 })}</Badge>
              <Badge variant="outline" className="text-[10px]">{t('banlist.cloudban_removed', { n: c.last_sync_removed ?? 0 })}</Badge>
            </>
          ) : (
            <Badge variant="outline">{t('banlist.cloudban_never')}</Badge>
          )}
          {c.last_error && <span className="text-destructive truncate max-w-[280px]" title={c.last_error}>{c.last_error}</span>}
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={syncNow} disabled={syncing}>
            <RefreshCw className={`mr-1 h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />{syncing ? t('banlist.cloudban_syncing') : t('banlist.cloudban_sync_now')}
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>{t('common.save')}</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const BanlistPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [entries, setEntries] = useState<BanEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'perm' | 'dicebots' | 'black' | 'cloud'>('perm');
  // C#45: 骰娘名单手动添加
  const [botId, setBotId] = useState('');
  const [botKind, setBotKind] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await jsend('GET', '/banlist'); setEntries(d.entries || []); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const addBot = async () => {
    if (!botId.trim()) { toast({ title: t('banlist.id_required'), variant: 'destructive' }); return; }
    try {
      await jsend('POST', '/banlist', { targetType: 0, listType: 2, targetId: botId.trim(), reason: botKind.trim() || 'manual' });
      setBotId(''); setBotKind(''); await load();
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };
  const del = async (rowId: number) => {
    try { await jsend('DELETE', `/banlist/${rowId}`); await load(); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="space-y-6">
      <PageHeader icon={ShieldCheck} title={t('banlist.title')} description={t('banlist.desc')}
        actions={
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
          </Button>
        } />

      {/* 选项卡：权限管理 / 骰娘识别 / 黑名单 */}
      <div className="flex gap-2 border-b">
        <button className={tabCls(tab === 'perm')} onClick={() => setTab('perm')}>{t('banlist.tab_perm')}</button>
        <button className={tabCls(tab === 'dicebots')} onClick={() => setTab('dicebots')}>{t('banlist.tab_dicebots')}</button>
        <button className={tabCls(tab === 'black')} onClick={() => setTab('black')}>{t('banlist.tab_black')}</button>
        <button className={tabCls(tab === 'cloud')} onClick={() => setTab('cloud')}>{t('banlist.tab_cloud')}</button>
      </div>

      {tab === 'perm' && <PermTab entries={entries} reload={load} del={del} />}

      {tab === 'dicebots' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4" />{t('banlist.dicebot_title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{t('banlist.dicebot_desc')}</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t('banlist.id')}</Label>
                  <Input className="w-40" value={botId} onChange={(e) => setBotId(e.target.value)} placeholder={t('banlist.id_ph')} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('banlist.dicebot_kind')}</Label>
                  <Input className="w-40" value={botKind} onChange={(e) => setBotKind(e.target.value)} placeholder="SealDice / Dice! / …" />
                </div>
                <Button size="sm" onClick={addBot}><Plus className="mr-1 h-4 w-4" />{t('common.add')}</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              {entries.filter((e) => e.listType === 2).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('banlist.dicebot_empty')}</p>
              ) : (
                <div className="overflow-x-auto"><table className="rt w-full text-sm">
                  <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left w-12"></th>
                      <th className="p-2 text-left">{t('banlist.id')}</th>
                      <th className="p-2 text-left">{t('banlist.dicebot_kind')}</th>
                      <th className="p-2 text-left">{t('banlist.dicebot_seen')}</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.filter((e) => e.listType === 2).map((e) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td data-label={t('groups.col_avatar')} className="p-2">
                          <img src={`https://q1.qlogo.cn/g?b=qq&nk=${e.targetId}&s=100`} alt=""
                            className="h-8 w-8 rounded-full object-cover"
                            onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
                        </td>
                        <td data-label={t('banlist.id')} className="p-2 font-mono">{e.targetId}</td>
                        <td data-label={t('banlist.dicebot_kind')} className="p-2"><Badge variant="secondary">{e.reason || '?'}</Badge></td>
                        <td data-label={t('banlist.dicebot_seen')} className="p-2 text-xs text-muted-foreground">{fmtTs(e.createdAt)}</td>
                        <td data-label={t('common.actions')} className="p-2 text-right">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => del(e.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'black' && <BlackTab entries={entries} reload={load} del={del} />}

      {tab === 'cloud' && <CloudBanTab reload={load} />}
    </div>
  );
};
