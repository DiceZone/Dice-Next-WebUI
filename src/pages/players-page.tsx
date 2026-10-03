import { useTourActive, useTourState } from '@/components/onboarding/tour-data';
import { tourSamples } from '@/lib/tour-samples';
import { useWorkspaceView } from '@/hooks/use-workspace-view';
import { useDetailScroll } from '@/hooks/use-detail-scroll';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { Loader2, RefreshCw, Check, X, Pencil, ArrowLeft, ChevronRight, ChevronDown, Copy, Save, UserCog, Columns2, LayoutGrid } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { ChatTab } from '@/pages/groups-page';
import { PlatformIcon, platformLabel } from '@/components/platform-icon';
import { PageHeader } from '@/components/ui/page-header';

interface Player {
  platform: string;
  userId: string;
  nickname: string;
  trustLevel: number;
  cmdCount: number;
  favor: number;
  lastCmdAt: string;
  createdAt: string;
  virtualId?: boolean;
  bindings?: { adapterType: string; adapterAccount: string; endpointId: string }[];
}

interface DetailGroup { id: string; name: string }
interface DetailCard { id: number; name: string; attrs: Record<string, unknown>; bound: string[]; updatedAt: string }
interface DetailSetting { id: number; groupId: string; key: string; value: string }
interface DetailKV { key: string; value: string }
interface DetailLuaCard { scope: string; data: string }
interface PlayerDetail {
  groups: DetailGroup[]; cards: DetailCard[]; settings: DetailSetting[];
  luaVars: DetailKV[]; luaCards: DetailLuaCard[];
  lastMessageAt: number;
}

const fmtTime = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

const fmtUnixTime = (seconds: number): string => seconds > 0 ? new Date(seconds * 1000).toLocaleString() : '—';

// 数字样式的值按 number 传（人物卡属性多为整数），其余按 string 原样保存。
const typedValue = (s: string): number | string => (/^-?\d+$/.test(s.trim()) ? Number(s.trim()) : s);

// ── C#96 玩家详情二级页面 ──────────────────────────────────────
const PlayerDetailView: React.FC<{
  player: Player; isMaster: boolean; onBack: () => void; embedded?: boolean; leaveGuard?: React.MutableRefObject<() => Promise<boolean>>;
}> = ({ player, isMaster, onBack, embedded, leaveGuard }) => {
  const { t } = useTranslation();
  const showingSamples = useTourActive();
  const toast = useToast();
  const dlg = useDialogs(t);
  const [detail, setDetail] = useState<PlayerDetail | null>(() => showingSamples ? {
    groups: tourSamples.groups.map((g) => ({ id: g.groupId, name: g.name })),
    cards: [{ id: -1, name: '调查员 · 示例', attrs: { 力量: 50, 敏捷: 60, HP: 12 }, bound: [], updatedAt: player.createdAt }],
    settings: [], luaVars: [], luaCards: [], lastMessageAt: Date.parse(player.lastCmdAt) / 1000,
  } : null);
  const [loading, setLoading] = useState(!showingSamples);
  const [drafts, setDrafts] = useState<Record<string, string>>({});   // 行内编辑草稿（键=行标识）
  const [saving, setSaving] = useState(false);
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});   // 卡片展开状态（默认收起）
  const [newAttr, setNewAttr] = useState<Record<string, { k: string; v: string }>>({});
  const [tab, setTab] = useState<'info' | 'cards' | 'settings' | 'plugins' | 'chat'>('info');

  const confirmLeave = async () => !saving && (!Object.keys(drafts).length || await dlg.confirm({ title: t('ui_refresh.discard'), description: t('workspace.discard_hint'), cancelText: t('ui_refresh.keep_editing'), confirmText: t('ui_refresh.discard_edits'), destructive: true }));
  useUnsavedChanges(Object.keys(drafts).length > 0 || saving, confirmLeave);
  useEffect(() => {
    if (leaveGuard) leaveGuard.current = confirmLeave;
    return () => { if (leaveGuard) leaveGuard.current = async () => true; };
  });

  const base = `/api/players/${encodeURIComponent(player.platform)}/${encodeURIComponent(player.userId)}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${base}/detail`);
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      setDetail(j.data); setDrafts({});
    } catch (e) { toast({ title: t('common.load_fail'), description: String(e), variant: 'destructive' }); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);
  useEffect(() => { if (!showingSamples) void load(); }, [load, showingSamples]);

  const post = async (path: string, body: unknown) => {
    const r = await fetch(`${base}/${path}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.code !== 0) throw new Error(j.message);
  };

  // C#96：不再逐格即时保存——所有值改动进 drafts，页面级「保存全部」统一提交。
  const dirtyCount = Object.keys(drafts).length;
  const saveAll = async () => {
    if (!detail || dirtyCount === 0) return;
    setSaving(true);
    let okCount = 0, failCount = 0;
    for (const [key, val] of Object.entries(drafts)) {
      try {
        if (key.startsWith('attr:')) {
          const m = key.match(/^attr:(.*?)\|(.*)$/s);   // 键形如 attr:<卡名>|<属性>
          if (m) await post('card-attr', { card: m[1], attr: m[2], value: typedValue(val) });
        } else if (key.startsWith('set:')) {
          await post('setting', { id: Number(key.slice(4)), value: val });
        } else if (key.startsWith('lua:')) {
          await post('luavar', { key: key.slice(4), value: val });
        } else if (key.startsWith('luacard:')) {
          await post('luacard', { scope: key.slice(8), data: val });
        }
        okCount++;
      } catch { failCount++; }
    }
    setSaving(false);
    toast(failCount === 0
      ? { title: t('players.saved_n', { n: okCount }) }
      : { title: t('players.save_partial', { ok: okCount, fail: failCount }), variant: 'destructive' });
    void load();
  };

  // 删除类操作（有确认弹窗）即时执行。
  const act = async (path: string, body: unknown) => {
    try { await post(path, body); void load(); }
    catch (e) { toast({ title: t('common.operation_fail'), description: String(e), variant: 'destructive' }); }
  };
  const delCard = async (name: string) => {
    if (!(await dlg.confirm({ title: t('players.del_card'), description: t('players.confirm_del_card', { name: name || t('players.default_card') }), destructive: true, confirmText: t('common.delete') }))) return;
    await act('card-del', { card: name });
  };

  // C#96：复制人物卡的 .st 全量录入指令（数字属性连写；表达式/字符串属性按 名=值）。
  const copySt = (c: DetailCard) => {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(c.attrs)) {
      if (k.startsWith('__')) continue;   // 元数据键不进指令
      if (typeof v === 'number') parts.push(`${k}${v}`);
      else if (typeof v === 'string' && v) parts.push(`${k}=${v}`);
    }
    const cmd = '.st ' + parts.join(' ');
    navigator.clipboard.writeText(cmd)
      .then(() => toast({ title: t('players.st_copied') }))
      .catch(() => toast({ title: cmd }));   // 剪贴板不可用时至少展示出来
  };

  // 值编辑单元：写 drafts，不即时保存。
  const draftInput = (rowKey: string, current: string, mono = true) => {
    const draft = drafts[rowKey] ?? current;
    const changed = draft !== current;
    return (
      <input value={draft}
        onChange={(e) => {
          const v = e.target.value;
          setDrafts((d) => {
            const n = { ...d };
            if (v === current) delete n[rowKey]; else n[rowKey] = v;
            return n;
          });
        }}
        className={`h-7 w-full min-w-0 rounded border px-2 text-xs ${mono ? 'font-mono' : ''} ${changed ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-input bg-background'}`} />
    );
  };

  const sectionTitle = (label: string, count: number) => (
    <h3 className="text-sm font-semibold mt-5 mb-2 flex items-center gap-2">
      {label}<span className="text-xs font-normal text-muted-foreground">({count})</span>
    </h3>
  );

  return (
    <div className="space-y-4">
      {dlg.node}
      {/* 页头：返回按钮独立一行，头像/信息组在下（同排会显得怪） */}
      {!embedded && <div>
        <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" />{t('common.back')}</Button>
      </div>}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {!player.virtualId && player.platform === 'onebot_v11' && !player.userId.startsWith('demo-') && (
            <img src={`https://q1.qlogo.cn/g?b=qq&nk=${player.userId}&s=640`} alt=""
              className="h-16 w-16 rounded-full object-cover bg-muted"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="break-words text-lg font-semibold">{player.nickname || player.userId}</span>
              {isMaster && <Badge variant="outline" className="border-red-300 text-red-600 dark:border-red-700 dark:text-red-400">{t('banlist.perm_master')}</Badge>}
            </div>
            <div className="flex min-w-0 items-start gap-1.5 break-all text-xs text-muted-foreground font-mono"><PlatformIcon platform={player.platform} className="h-3.5 w-3.5" />{player.userId}</div>
            {player.virtualId && <div className="text-xs text-amber-600 dark:text-amber-400">虚拟 QQ 号（尚未绑定真实 QQ）</div>}
            <div className="text-xs text-muted-foreground">{t('players.col_count')}: {player.cmdCount} · {t('players.col_favor')}: {player.favor}</div>
          </div>
        </div>
        {(player.bindings?.length ?? 0) > 0 && <div className="rounded border bg-muted/30 px-3 py-2 text-xs">
          <div className="mb-1 text-muted-foreground">已绑定身份来源</div>
          {player.bindings!.map((b, i) => <div key={`${b.adapterType}-${b.adapterAccount}-${b.endpointId}-${i}`} className="flex items-center gap-1.5 font-mono break-all"><PlatformIcon platform={b.adapterType} className="h-3.5 w-3.5" />{platformLabel(b.adapterType)} / {b.adapterAccount || '—'} / {b.endpointId}</div>)}
        </div>}
        <span className="flex-1" />
        <Button size="sm" onClick={saveAll} disabled={saving || dirtyCount === 0}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          {t('players.save_all')}{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="space-y-5">
      <TabsList variant="page" aria-label={t('players.title')}>
        {([
          ['info', t('players.tab_info')],
          ['cards', `${t('players.tab_cards')}(${detail?.cards.length ?? 0})`],
          ['settings', `${t('players.tab_settings')}(${detail?.settings.length ?? 0})`],
          ['plugins', `${t('players.tab_plugins')}(${(detail?.luaVars.length ?? 0) + (detail?.luaCards.length ?? 0)})`],
          ['chat', t('players.tab_chat')],
        ] as const).map(([key, label]) => (
          <TabsTrigger key={key} value={key}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={tab} className="mt-0">
      {loading || !detail ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="text-sm">
          {tab === 'info' && <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 rounded-lg border p-3 text-xs">
            <div><p className="text-muted-foreground">{t('players.col_count')}</p><p className="font-medium text-sm">{player.cmdCount}</p></div>
            <div><p className="text-muted-foreground">{t('players.col_favor')}</p><p className="font-medium text-sm">{player.favor}</p></div>
            <div><p className="text-muted-foreground">{t('players.col_last')}</p><p className="font-medium text-sm">{fmtTime(player.lastCmdAt)}</p></div>
            <div><p className="text-muted-foreground">{t('players.detail_last_message')}</p><p className="font-medium text-sm">{fmtUnixTime(detail.lastMessageAt)}</p></div>
            <div><p className="text-muted-foreground">{t('players.detail_created')}</p><p className="font-medium text-sm">{fmtTime(player.createdAt)}</p></div>
          </div>
          {/* 所在群 */}
          {sectionTitle(t('players.detail_groups'), detail.groups.length)}
          {detail.groups.length === 0 ? <p className="text-xs text-muted-foreground">{t('players.detail_none')}</p> : (
            <div className="flex flex-wrap gap-1.5">
              {detail.groups.map((g) => (
                <Badge key={g.id} variant="secondary" className="font-normal">
                  {g.name !== g.id ? <>{g.name}<span className="ml-1 font-mono text-[10px] opacity-70">{g.id}</span></> : <span className="font-mono">{g.id}</span>}
                </Badge>
              ))}
            </div>
          )}
          </>}

          {/* 人物卡（C#96：默认折叠，点卡头展开；卡头带「复制 .st」） */}
          {tab === 'cards' && <>
          {sectionTitle(t('players.detail_cards'), detail.cards.length)}
          {detail.cards.length === 0 ? <p className="text-xs text-muted-foreground">{t('players.detail_none')}</p> : detail.cards.map((c) => {
            const cardKey = 'card:' + c.name;
            const open = !!openCards[cardKey];
            const na = newAttr[cardKey] || { k: '', v: '' };
            const attrCount = Object.keys(c.attrs).filter((k) => !k.startsWith('__')).length;
            return (
              <div key={c.id} className="rounded-md border mb-2">
                <div className="flex items-center gap-2 p-2.5 flex-wrap">
                  <button className="flex items-center gap-1.5 font-medium hover:text-primary"
                    onClick={() => setOpenCards((m) => ({ ...m, [cardKey]: !open }))}>
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {c.name || t('players.default_card')}
                    <span className="text-xs font-normal text-muted-foreground">({attrCount})</span>
                  </button>
                  {c.bound.map((g) => (
                    <Badge key={g} variant="outline" className="text-[10px] font-mono">{t('players.bound_to')} {g}</Badge>
                  ))}
                  <span className="flex-1" />
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copySt(c)}>
                    <Copy className="mr-1 h-3 w-3" />{t('players.copy_st')}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => void delCard(c.name)}>{t('players.del_card')}</Button>
                </div>
                {open && (
                  <div className="border-t px-2.5 pb-2.5">
                    <div className="overflow-x-auto"><table className="rt rt-flat w-full text-xs">
                      <tbody>
                        {Object.entries(c.attrs).map(([k, v]) => (
                          <tr key={k} className="border-t first:border-0">
                            <td data-label={t('players.col_attr')} className="py-1 pr-2 w-36 break-all">{k}</td>
                            <td data-label={t('players.col_value')} className="py-1">
                              <div className="flex items-center gap-1">
                                {draftInput(`attr:${c.name}|${k}`, typeof v === 'string' ? v : JSON.stringify(v))}
                                <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                                  onClick={() => void act('card-attr', { card: c.name, attr: k })}>{t('common.delete')}</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t">
                          <td data-label={t('players.col_attr')} className="py-1 pr-2">
                            <input value={na.k} placeholder={t('players.col_attr')}
                              onChange={(e) => setNewAttr((m) => ({ ...m, [cardKey]: { ...na, k: e.target.value } }))}
                              className="h-7 w-full rounded border border-input bg-background px-2 text-xs" />
                          </td>
                          <td data-label={t('players.col_value')} className="py-1">
                            <div className="flex items-center gap-1">
                              <input value={na.v} placeholder={t('players.col_value')}
                                onChange={(e) => setNewAttr((m) => ({ ...m, [cardKey]: { ...na, v: e.target.value } }))}
                                className="h-7 flex-1 min-w-0 rounded border border-input bg-background px-2 text-xs font-mono" />
                              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" disabled={!na.k.trim()}
                                onClick={() => {
                                  void act('card-attr', { card: c.name, attr: na.k.trim(), value: typedValue(na.v) });
                                  setNewAttr((m) => ({ ...m, [cardKey]: { k: '', v: '' } }));
                                }}>{t('common.add')}</Button>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table></div>
                  </div>
                )}
              </div>
            );
          })}
          </>}

          {/* 设置键值（.nn/.set/上限/武器等） */}
          {tab === 'settings' && <>
          {sectionTitle(t('players.detail_settings'), detail.settings.length)}
          {detail.settings.length === 0 ? <p className="text-xs text-muted-foreground">{t('players.detail_none')}</p> : (
            <div className="overflow-x-auto"><table className="rt rt-flat w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr><th className="text-left py-1 w-28">{t('players.col_group')}</th><th className="text-left py-1 w-32">{t('players.col_key')}</th><th className="text-left py-1">{t('players.col_value')}</th></tr>
              </thead>
              <tbody>
                {detail.settings.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td data-label={t('players.col_group')} className="py-1 pr-2 font-mono">{s.groupId || t('players.scope_global')}</td>
                    <td data-label={t('players.col_key')} className="py-1 pr-2 break-all">{s.key}</td>
                    <td data-label={t('players.col_value')} className="py-1">
                      <div className="flex items-center gap-1">
                        {draftInput(`set:${s.id}`, s.value)}
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => void act('setting', { id: s.id })}>{t('common.delete')}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
          </>}

          {/* Lua 插件变量 */}
          {tab === 'plugins' && <>
          {sectionTitle(t('players.detail_luavars'), detail.luaVars.length)}
          {detail.luaVars.length === 0 ? <p className="text-xs text-muted-foreground">{t('players.detail_none')}</p> : (
            <div className="overflow-x-auto"><table className="rt rt-flat w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr><th className="text-left py-1 w-40">{t('players.col_key')}</th><th className="text-left py-1">{t('players.col_value')}</th></tr>
              </thead>
              <tbody>
                {detail.luaVars.map((v) => (
                  <tr key={v.key} className="border-t">
                    <td data-label={t('players.col_key')} className="py-1 pr-2 break-all">{v.key}</td>
                    <td data-label={t('players.col_value')} className="py-1">
                      <div className="flex items-center gap-1">
                        {draftInput(`lua:${v.key}`, v.value)}
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => void act('luavar', { key: v.key })}>{t('common.delete')}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}

          {/* Lua 卡片数据（背包等 JSON blob） */}
          {sectionTitle(t('players.detail_luacards'), detail.luaCards.length)}
          {detail.luaCards.length === 0 ? <p className="text-xs text-muted-foreground">{t('players.detail_none')}</p> : detail.luaCards.map((c) => {
            const rowKey = 'luacard:' + c.scope;
            const draft = drafts[rowKey] ?? c.data;
            const changed = draft !== c.data;
            return (
              <div key={c.scope} className="rounded-md border p-2.5 mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs">{t('players.col_group')}: {c.scope || t('players.scope_global')}</span>
                  <span className="flex-1" />
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                    onClick={() => void act('luacard', { scope: c.scope })}>{t('common.delete')}</Button>
                </div>
                <textarea value={draft} rows={3}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDrafts((d) => {
                      const n = { ...d };
                      if (v === c.data) delete n[rowKey]; else n[rowKey] = v;
                      return n;
                    });
                  }}
                  className={`w-full rounded border px-2 py-1 text-xs font-mono ${changed ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-input bg-background'}`} />
              </div>
            );
          })}
          </>}

          {tab === 'chat' && <ChatTab base={`/players/${encodeURIComponent(player.platform)}/${encodeURIComponent(player.userId)}`}
            platform={player.platform} t={t} toast={toast} privateChat
            channels={(player.bindings?.length ? player.bindings : [{ adapterType: player.platform, adapterAccount: '', endpointId: player.userId }]).map((b) => ({
              key: `${b.adapterType}:${b.adapterAccount}`, platform: b.adapterType, adapterAccount: b.adapterAccount,
              endpointId: b.endpointId,
              base: `/players/${encodeURIComponent(b.adapterType)}/${encodeURIComponent(player.userId)}`,
              label: b.adapterType === 'qq_official' ? `QQ 官方机器人 ${b.adapterAccount}` : `${b.adapterType === 'discord' ? 'Discord' : b.adapterType === 'kook' ? 'KOOK' : 'OneBot'}（适配器 ${b.adapterAccount || '默认'}）`,
            }))} />}
        </div>
      )}
      </TabsContent>
      </Tabs>
    </div>
  );
};

export const PlayersPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const dlg = useDialogs(t);
  const [rows, setRows] = useTourState<Player[]>([], tourSamples.players);
  const [masters, setMasters] = useTourState<{ platform: string; id: string }[]>([], tourSamples.masters);
  const [friendInfo, setFriendInfo] = useState<{ lists: Record<string, string[]>; deletePlatforms: string[]; officialRealFriends: string[] }>({ lists: {}, deletePlatforms: [], officialRealFriends: [] });
  const [loading, setLoading] = useTourState(true, false);
  const [editFav, setEditFav] = useTourState<string | null>(null, null);
  const [favVal, setFavVal] = useState(0);
  const [q, setQ] = useTourState('', '');
  const [platFilter, setPlatFilter] = useTourState('all', 'all');   // 平台筛选（KOOK 用户 id 可能与 QQ 号同形，分开看）
  const [sortCol, setSortCol] = useState<string>('trustLevel');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useTourState(1, 1);
  const PAGE_SIZE = 20;
  const { preference, view: responsiveView, setViewPreference } = useWorkspaceView('players');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEpoch, setDetailEpoch] = useState(0);
  const [selected, setSelected] = useState<Player | null>(null);   // C#96：详情二级页面
  const showingSamples = useTourActive();
  const view = showingSamples ? 'split' : responsiveView;
  const previousView = React.useRef(view);
  const leaveGuard = React.useRef<() => Promise<boolean>>(async () => true);
  const workspaceRef = React.useRef<HTMLDivElement>(null);
  const detailScroll = useDetailScroll(workspaceRef);
  const change = async (action: () => void) => { if (await leaveGuard.current()) action(); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/players');
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      setRows(j.data || []);
    } catch { toast({ title: t('common.load_fail'), variant: 'destructive' }); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void load();
    void (async () => {
      try { const r = await fetch('/api/masters'); const j = await r.json(); if (j.code === 0) setMasters(j.data?.items || []); } catch { /* ignore */ }
      try { const r = await fetch('/api/friends'); const j = await r.json(); if (j.code === 0) setFriendInfo(j.data || { lists: {}, deletePlatforms: [], officialRealFriends: [] }); } catch { /* ignore */ }
    })();
  }, [load]);

  const masterSet = useMemo(() => new Set(masters.map((m) => m.id)), [masters]);
  const canDeleteFriend = (p: Player) => {
    // QQ 官方 API 没有删好友能力。仅当该 OpenID 已绑定真实 QQ，且该 QQ
    // 已由 OneBot 的好友列表确认时，才允许用 OneBot 执行删除。
    if (p.platform === 'qq_official') return friendInfo.officialRealFriends.includes(p.userId);
    if (!friendInfo.deletePlatforms.includes(p.platform)) return false;
    return (friendInfo.lists[p.platform] || []).includes(p.userId);
  };

  // 信任等级切换。「骰主」(256) 是可选等级之一：选中=加入 dice.masters；
  // 从骰主切到其他等级=移出 masters 并写入所选信任值。
  const saveTrust = async (p: Player, lv: number) => {
    try {
      const isM = masterSet.has(p.userId);
      if (lv === 256) {
        if (!isM) {
          const r = await fetch('/api/masters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: p.platform, id: p.userId }) });
          const j = await r.json();
          if (j.code !== 0) throw new Error(j.message);
          setMasters(j.data?.items || []);
        }
      } else {
        if (isM) {
          const r = await fetch(`/api/masters/${encodeURIComponent(p.platform || '_')}/${encodeURIComponent(p.userId)}`, { method: 'DELETE' });
          const j = await r.json();
          if (j.code !== 0) throw new Error(j.message);
          setMasters(j.data || []);
        }
        const r = await fetch(`/api/players/${encodeURIComponent(p.platform)}/${encodeURIComponent(p.userId)}`,
          { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trustLevel: lv }) });
        const j = await r.json();
        if (j.code !== 0) throw new Error(j.message);
      }
      void load();
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const saveFavor = async (p: Player) => {
    try {
      const r = await fetch(`/api/players/${encodeURIComponent(p.platform)}/${encodeURIComponent(p.userId)}`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favor: favVal }) });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      setEditFav(null); void load();
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const del = async (p: Player) => {
    if (!(await dlg.confirm({ title: t('common.confirm_delete'), description: t('players.confirm_delete', { name: p.nickname || p.userId }), destructive: true, confirmText: t('common.delete') }))) return;
    try {
      const r = await fetch(`/api/players/${encodeURIComponent(p.platform)}/${encodeURIComponent(p.userId)}`, { method: 'DELETE' });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      void load();
    } catch (e) { toast({ title: t('common.operation_fail'), description: String(e), variant: 'destructive' }); }
  };

  // C#52: 删除好友（经适配器 delete_friend）
  const delFriend = async (p: Player) => {
    if (!(await dlg.confirm({ title: t('players.del_friend'), description: t('players.del_friend_confirm', { name: p.nickname || p.userId }), destructive: true, confirmText: t('players.del_friend') }))) return;
    try {
      const r = await fetch(`/api/players/${encodeURIComponent(p.platform)}/${encodeURIComponent(p.userId)}/delete-friend`, { method: 'POST' });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      toast({ title: t('players.del_friend_done') });
      const fr = await fetch('/api/friends'); const fj = await fr.json();
      if (fj.code === 0) setFriendInfo(fj.data || { lists: {}, deletePlatforms: [], officialRealFriends: [] });
    } catch (e) { toast({ title: t('common.operation_fail'), description: String(e), variant: 'destructive' }); }
  };

  const key = (p: Player) => p.platform + ':' + p.userId;
  const shown = rows.filter((p) =>
    (platFilter === 'all' || p.platform === platFilter)
    && (!q || p.userId.includes(q) || (p.nickname || '').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      // 排序时 Master 视为最高权限（C#92：默认权限从大到小时骰主排最前）。
      const eff = (p: Player) => (masterSet.has(p.userId) ? 256 : p.trustLevel);
      if (sortCol === 'trustLevel') return (eff(a) - eff(b)) * dir;
      if (sortCol === 'favor') return (a.favor - b.favor) * dir;
      if (sortCol === 'cmdCount') return (a.cmdCount - b.cmdCount) * dir;
      if (sortCol === 'lastCmdAt') return (new Date(a.lastCmdAt).getTime() - new Date(b.lastCmdAt).getTime()) * dir;
      if (sortCol === 'nickname') return (a.nickname || '').localeCompare(b.nickname || '') * dir;
      if (sortCol === 'userId') return a.userId.localeCompare(b.userId) * dir;
      return 0;
    });
  // 分页：每页 20 个，搜索/排序变化时回到第 1 页。
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const paged = shown.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [q, platFilter, sortCol, sortDir]);

  const active = paged.find((p) => selected && key(p) === key(selected)) ?? paged[0];
  useEffect(() => {
    if (previousView.current === 'split' && view === 'card' && active) {
      setSelected(active); setDetailOpen(true);
    }
    previousView.current = view;
  }, [view, active]);
  const platforms = [...new Set(rows.map((p) => p.platform))];

  return <div ref={workspaceRef} className="space-y-5">
    {dlg.node}
    <PageHeader icon={UserCog} title={t('players.title')} description={t('players.subtitle')} actions={<div className="flex flex-wrap items-center gap-2"><Select value={preference} onValueChange={setViewPreference}><SelectTrigger aria-label={t('workspace.view')} className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">{t('workspace.auto_view')}</SelectItem><SelectItem value="split"><span className="flex items-center gap-2"><Columns2 className="h-4 w-4" />{t('workspace.split')}</span></SelectItem><SelectItem value="card"><span className="flex items-center gap-2"><LayoutGrid className="h-4 w-4" />{t('groups.view_card')}</span></SelectItem></SelectContent></Select><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}</Button></div>} />
    <div data-tour="players-filters" className="flex flex-wrap gap-3">
      <Input className="min-w-0 flex-1 bg-card" aria-label={t('players.search')} placeholder={t('players.search')} value={q} onChange={(e) => { const value = e.target.value; void change(() => setQ(value)); }} />
      <Select value={platFilter} onValueChange={(v) => void change(() => setPlatFilter(v))}><SelectTrigger aria-label={t('players.all_platforms')} className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t('players.all_platforms')}</SelectItem>{platforms.map((p) => <SelectItem key={p} value={p}>{platformLabel(p)}</SelectItem>)}</SelectContent></Select>
      <Select value={sortCol} onValueChange={(v) => void change(() => setSortCol(v))}><SelectTrigger aria-label={t('workspace.sort')} className="w-40"><SelectValue /></SelectTrigger><SelectContent>{[['nickname','players.col_nickname'],['userId','players.col_id'],['trustLevel','players.col_trust'],['favor','players.col_favor'],['cmdCount','players.col_count'],['lastCmdAt','players.col_last']].map(([value,label]) => <SelectItem key={value} value={value}>{t(label)}</SelectItem>)}</SelectContent></Select>
      <Button variant="outline" onClick={() => void change(() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc'))}>{t(sortDir === 'asc' ? 'workspace.ascending' : 'workspace.descending')}</Button>
    </div>
    {loading && !rows.length ? <Loader2 className="mx-auto my-16 h-8 w-8 animate-spin" /> : !shown.length ? <Card className="p-16 text-center text-sm text-muted-foreground">{t('players.empty')}</Card> :
      <div data-tour="players-list" className={`grid items-start gap-4 ${view === 'split' ? 'lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]' : ''}`}>
        <div hidden={view === 'card' && detailOpen} className={view === 'split' ? 'min-w-0 rounded-lg border bg-card p-2' : 'min-w-0'}>
          <div className={view === 'split' ? 'max-h-[260px] space-y-1 overflow-y-auto lg:max-h-[65vh]' : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'}>
            {paged.map((p) => view === 'card' ? <Card key={key(p)} className="flex min-w-0 flex-col p-4 shadow-none">
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-primary/10 p-2 text-primary"><UserCog className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><button type="button" onClick={() => void change(() => detailScroll.open(() => { setSelected(p); setDetailOpen(true); setEditFav(null); }))} className="break-words text-left font-semibold hover:text-primary">{p.nickname || p.userId}</button><div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground"><PlatformIcon platform={p.platform} /><span className="break-all font-mono">{p.userId}</span></div></div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">{t('players.col_trust')}</dt><dd className="mt-1 font-medium">{masterSet.has(p.userId) ? t('banlist.perm_master') : p.trustLevel <= 4 ? t('banlist.perm_lv' + p.trustLevel) : t('banlist.perm_trust_n', { n: p.trustLevel })}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{t('players.col_favor')}</dt><dd className="mt-1 tabular-nums">{p.favor}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{t('players.col_count')}</dt><dd className="mt-1 tabular-nums">{p.cmdCount}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{t('players.col_last')}</dt><dd className="mt-1 break-words text-xs">{fmtTime(p.lastCmdAt)}</dd></div>
              </dl>
              <div className="mt-4 flex justify-end border-t pt-3"><Button variant="outline" size="sm" onClick={() => void change(() => detailScroll.open(() => { setSelected(p); setDetailOpen(true); setEditFav(null); }))}>{t('groups.manage')}<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
            </Card> : <button type="button" key={key(p)} aria-pressed={active && key(active) === key(p)} onClick={() => void change(() => { setSelected(p); setEditFav(null); })} className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active && key(active) === key(p) ? 'border-primary/20 bg-primary/[0.07]' : 'border-transparent hover:bg-muted/60'}`}>
              <span className="rounded-lg bg-primary/10 p-2 text-primary"><UserCog className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{p.nickname || p.userId}</span><span className="mt-1 flex items-center gap-1 break-all text-xs text-muted-foreground"><PlatformIcon platform={p.platform} />{p.userId}</span><span className="mt-2 block text-xs text-muted-foreground">{t('players.col_count')}: {p.cmdCount} · {t('players.col_favor')}: {p.favor}</span></span>
            </button>)}
          </div>
          <PaginationBar total={shown.length} page={curPage} pageSize={PAGE_SIZE} onPageChange={(value) => void change(() => setPage(value))} fixedSize compact={view === 'split'} />
        </div>
        <Card hidden={view === 'card' && !detailOpen} className="min-w-0 space-y-5 p-4 shadow-none sm:p-6">
          {view === 'card' && <Button variant="outline" size="sm" onClick={() => void change(() => detailScroll.close(() => { setDetailOpen(false); setDetailEpoch((value) => value + 1); setEditFav(null); }))}><ArrowLeft className="mr-1 h-4 w-4" />{t('common.back')}</Button>}
          {active && (() => { const p = active; return <>
            <div className="flex flex-wrap items-end gap-4 border-b pb-4">
              <div className="space-y-2"><p className="text-xs text-muted-foreground">{t('players.col_trust')}</p>{/* C#92：骰主(256)是可选等级——选中即写入 dice.masters，切走即移出。 */}
                    <Select value={masterSet.has(p.userId) ? '256' : String(p.trustLevel)} onValueChange={(v) => saveTrust(p, Number(v))}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">{t('banlist.perm_lv0')}</SelectItem>
                        <SelectItem value="1">{t('banlist.perm_lv1')}</SelectItem>
                        <SelectItem value="2">{t('banlist.perm_lv2')}</SelectItem>
                        <SelectItem value="3">{t('banlist.perm_lv3')}</SelectItem>
                        <SelectItem value="4">{t('banlist.perm_lv4')}</SelectItem>
                        {/* .trust 可设 5-255（如 V2 导入的信任5）→ 动态补一项，不空白 */}
                        {!masterSet.has(p.userId) && p.trustLevel > 4 && (
                          <SelectItem value={String(p.trustLevel)}>{t('banlist.perm_trust_n', { n: p.trustLevel })}</SelectItem>
                        )}
                        <SelectItem value="256" className="text-red-600 dark:text-red-400">{t('banlist.perm_master')}</SelectItem>
                      </SelectContent>
                    </Select></div>
              <div className="space-y-2"><p className="text-xs text-muted-foreground">{t('players.col_favor')}</p>{editFav === key(p) ? (
                      <span className="inline-flex items-center gap-1">
                        <input type="number" value={favVal} onChange={(e) => setFavVal(parseInt(e.target.value) || 0)}
                          className="h-7 w-16 rounded border border-input bg-background px-2 text-sm" />
                        <button onClick={() => saveFavor(p)} className="text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></button>
                        <button onClick={() => setEditFav(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-400">{p.favor}</span>
                        <button onClick={() => { setEditFav(key(p)); setFavVal(p.favor); }} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      </span>
                    )}</div>
              <div className="ml-auto flex flex-wrap gap-1">{canDeleteFriend(p) ? (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => delFriend(p)}>{t('players.del_friend')}</Button>
                      ) : (
                        <Button variant="ghost" size="sm" disabled
                          title={t('players.not_friend')}
                          className="h-7 text-xs text-muted-foreground/50 disabled:pointer-events-auto disabled:cursor-not-allowed hover:bg-transparent">
                          {t('players.del_friend')}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={() => del(p)}>{t('players.del_record')}</Button></div>
            </div>
            <PlayerDetailView key={key(p) + String(showingSamples) + detailEpoch} player={p} isMaster={masterSet.has(p.userId)} embedded leaveGuard={leaveGuard} onBack={() => setSelected(null)} />
          </>; })()}
        </Card>
      </div>}
  </div>;
};

export default PlayersPage;
