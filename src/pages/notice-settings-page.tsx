import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Bell, Plus, Trash2, RefreshCw, Search, Mail, Webhook, ScrollText, Send, Loader2 } from 'lucide-react';

interface CatalogItem { op: string; area: number; }
interface NoticeWindow { platform: string; chat_id: string; is_group: boolean; name?: string; level_mask: number; events: string[]; }
interface SmtpConf { enabled: boolean; host: string; port: number; ssl: boolean; user: string; pass: string; from: string; to: string; level_mask: number; }
interface WebhookConf { enabled: boolean; url: string; level_mask: number; }
interface AuditItem { ts: string; level: number; op: string; msg: string; origin?: string; }
interface GroupItem { platform: string; groupId: string; name: string; }
interface PlayerItem { platform: string; userId: string; nickname: string; }

async function jget(path: string) { const r = await fetch('/api' + path); const j = await r.json(); if (j.code !== 0) throw new Error(j.message); return j.data; }
async function jsend(method: string, path: string, body?: unknown) {
  const r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json(); if (j.code !== 0) throw new Error(j.message); return j.data;
}

const AREAS = [1, 2, 4, 8] as const;

export const NoticeSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [tab, setTab] = useState<'windows' | 'push' | 'audit'>('windows');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [wins, setWins] = useState<NoticeWindow[]>([]);
  const [smtp, setSmtp] = useState<SmtpConf>({ enabled: false, host: '', port: 465, ssl: true, user: '', pass: '', from: '', to: '', level_mask: 15 });
  const [webhook, setWebhook] = useState<WebhookConf>({ enabled: false, url: '', level_mask: 15 });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  // 选择器数据源
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [pick, setPick] = useState('');       // 搜索词
  const [picking, setPicking] = useState(false);
  // 审计
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const apply = (d: { windows?: NoticeWindow[]; smtp?: Partial<SmtpConf>; webhook?: Partial<WebhookConf>; catalog?: CatalogItem[] }) => {
    setWins((d.windows || []).map((w) => ({ ...w, events: w.events || [] })));
    if (d.smtp) setSmtp((p) => ({ ...p, ...d.smtp }));
    if (d.webhook) setWebhook((p) => ({ ...p, ...d.webhook }));
    if (d.catalog) setCatalog(d.catalog);
  };
  useEffect(() => { (async () => { try { apply(await jget('/system/notice')); } catch { /* ignore */ } })(); }, []);
  useEffect(() => {
    (async () => {
      try { const g = await jget('/groups'); setGroups((Array.isArray(g) ? g : []) as GroupItem[]); } catch { /* ignore */ }
      try { const p = await jget('/players'); setPlayers((Array.isArray(p) ? p : []) as PlayerItem[]); } catch { /* ignore */ }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try { apply(await jsend('PUT', '/system/notice', { windows: wins, smtp, webhook })); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  const sendTest = async () => {
    setTesting(true);
    try { await jsend('POST', '/system/notice/test'); toast({ title: t('noticeset.push_test_sent') }); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setTesting(false); }
  };
  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try { const d = await jget('/system/audit'); setAudit((d?.items || []) as AuditItem[]); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setAuditLoading(false); }
  }, [toast]);
  useEffect(() => { if (tab === 'audit') void loadAudit(); }, [tab, loadAudit]);

  // ── 事件目录按区域分组 ──
  const byArea = useMemo(() => {
    const m: Record<number, string[]> = { 1: [], 2: [], 4: [], 8: [] };
    for (const c of catalog) if (m[c.area]) m[c.area].push(c.op);
    return m;
  }, [catalog]);
  const evName = (op: string) => { const k = `noticeset.ev_${op}`; const v = t(k); return v === k ? op : v; };
  const areaName = (a: number) => t(`noticeset.area_${a}`);
  const areaOfLevel = (lv: number) => lv >= 8 ? 8 : lv >= 4 ? 4 : lv >= 2 ? 2 : 1;

  const patchWin = (i: number, p: Partial<NoticeWindow>) => setWins((ws) => ws.map((w, idx) => (idx === i ? { ...w, ...p } : w)));
  const toggleEvent = (i: number, op: string) => {
    const evs = wins[i].events.includes(op) ? wins[i].events.filter((e) => e !== op) : [...wins[i].events, op];
    patchWin(i, { events: evs });
  };
  const toggleArea = (i: number, area: number) => {
    const ops = byArea[area] || [];
    const allOn = ops.every((op) => wins[i].events.includes(op));
    const evs = allOn ? wins[i].events.filter((e) => !ops.includes(e)) : Array.from(new Set([...wins[i].events, ...ops]));
    patchWin(i, { events: evs });
  };

  // ── 目标选择器（群/玩家搜索）──
  const pickResults = useMemo(() => {
    const s = pick.trim().toLowerCase();
    const gs = groups.filter((g) => !s || g.groupId.toLowerCase().includes(s) || (g.name || '').toLowerCase().includes(s)).slice(0, 6);
    const ps = players.filter((p) => !s || p.userId.toLowerCase().includes(s) || (p.nickname || '').toLowerCase().includes(s)).slice(0, 6);
    return { gs, ps };
  }, [pick, groups, players]);
  const addWindow = (platform: string, chatId: string, isGroup: boolean, name: string) => {
    if (wins.some((w) => w.platform === platform && w.chat_id === chatId)) { toast({ title: t('noticeset.win_dup'), variant: 'destructive' }); return; }
    setWins((ws) => [...ws, { platform, chat_id: chatId, is_group: isGroup, name, level_mask: 15, events: catalog.map((c) => c.op) }]);
    setPicking(false); setPick('');
  };

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`;
  const areaBadgeCls = (a: number) => a === 8 ? 'bg-red-500/15 text-red-600 dark:text-red-400'
    : a === 4 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    : a === 2 ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-muted text-muted-foreground';

  return (
    <div className="space-y-6">
      <PageHeader icon={Bell} title={t('noticeset.title')} description={t('noticeset.desc')} />

      <div className="flex gap-2 border-b">
        <button className={tabCls(tab === 'windows')} onClick={() => setTab('windows')}>{t('noticeset.tab_windows')}</button>
        <button className={tabCls(tab === 'push')} onClick={() => setTab('push')}>{t('noticeset.tab_push')}</button>
        <button className={tabCls(tab === 'audit')} onClick={() => setTab('audit')}>{t('noticeset.tab_audit')}</button>
      </div>

      {/* ══ 通知窗口 ══ */}
      {tab === 'windows' && (
        <div className="space-y-4">
          {wins.length === 0 && <p className="text-sm text-muted-foreground">{t('noticeset.win_empty')}</p>}
          {wins.map((w, i) => (
            <Card key={w.platform + w.chat_id}>
              <CardContent className="py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{w.is_group ? t('noticeset.win_group') : t('noticeset.win_user')}</Badge>
                  <span className="text-sm font-medium">{w.name || w.chat_id}</span>
                  <span className="font-mono text-xs text-muted-foreground">{w.chat_id}</span>
                  <Button variant="ghost" size="sm" className="ml-auto h-7 w-7 p-0 text-destructive"
                    onClick={() => setWins((ws) => ws.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {AREAS.map((area) => (byArea[area] || []).length > 0 && (
                  <div key={area} className="rounded-md border p-2 space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                      <input type="checkbox" className="accent-primary"
                        checked={(byArea[area] || []).every((op) => w.events.includes(op))}
                        onChange={() => toggleArea(i, area)} />
                      <span className={`rounded px-1.5 py-0.5 ${areaBadgeCls(area)}`}>{areaName(area)}</span>
                    </label>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pl-5">
                      {(byArea[area] || []).map((op) => (
                        <label key={op} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                          <input type="checkbox" className="accent-primary" checked={w.events.includes(op)} onChange={() => toggleEvent(i, op)} />
                          {evName(op)}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          {/* 添加窗口：从群/人员列表搜索勾选 */}
          {picking ? (
            <Card>
              <CardContent className="py-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input autoFocus className="pl-8 h-9" value={pick} placeholder={t('noticeset.win_pick_ph')} onChange={(e) => setPick(e.target.value)} />
                </div>
                {pickResults.gs.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">{t('noticeset.win_group')}</p>
                    {pickResults.gs.map((g) => (
                      <button key={g.platform + g.groupId} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted text-left"
                        onClick={() => addWindow(g.platform, g.groupId, true, g.name)}>
                        <Badge variant="secondary" className="shrink-0">{t('noticeset.win_group')}</Badge>
                        <span>{g.name}</span><span className="font-mono text-xs text-muted-foreground">{g.groupId}</span>
                      </button>
                    ))}
                  </div>
                )}
                {pickResults.ps.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">{t('noticeset.win_user')}</p>
                    {pickResults.ps.map((p) => (
                      <button key={p.platform + p.userId} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted text-left"
                        onClick={() => addWindow(p.platform, p.userId, false, p.nickname)}>
                        <Badge variant="secondary" className="shrink-0">{t('noticeset.win_user')}</Badge>
                        <span>{p.nickname || p.userId}</span><span className="font-mono text-xs text-muted-foreground">{p.userId}</span>
                      </button>
                    ))}
                  </div>
                )}
                {pickResults.gs.length === 0 && pickResults.ps.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 text-center">{t('noticeset.win_pick_none')}</p>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setPicking(false); setPick(''); }}>{t('common.cancel')}</Button>
              </CardContent>
            </Card>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setPicking(true)}><Plus className="mr-1 h-4 w-4" />{t('noticeset.win_add')}</Button>
          )}

          <p className="text-[11px] text-muted-foreground">{t('noticeset.win_hint')}</p>
          <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('common.save')}</Button></div>
        </div>
      )}

      {/* ══ 第三方推送 ══ */}
      {tab === 'push' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" />{t('noticeset.push_smtp')}</CardTitle>
              <CardDescription>{t('noticeset.push_smtp_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{t('common.enabled')}</Label>
                <Switch checked={smtp.enabled} onCheckedChange={(v) => setSmtp((p) => ({ ...p, enabled: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">{t('noticeset.smtp_host')}</Label>
                  <Input className="h-8 text-sm" value={smtp.host} placeholder="smtp.example.com" onChange={(e) => setSmtp((p) => ({ ...p, host: e.target.value }))} /></div>
                <div className="flex items-end gap-3">
                  <div className="flex-1"><Label className="text-xs">{t('noticeset.smtp_port')}</Label>
                    <Input type="number" className="h-8 text-sm" value={smtp.port} onChange={(e) => setSmtp((p) => ({ ...p, port: Number(e.target.value) || 465 }))} /></div>
                  <label className="flex items-center gap-1.5 text-xs pb-2 cursor-pointer select-none">
                    <input type="checkbox" className="accent-primary" checked={smtp.ssl} onChange={(e) => setSmtp((p) => ({ ...p, ssl: e.target.checked }))} />
                    SSL
                  </label>
                </div>
                <div><Label className="text-xs">{t('noticeset.smtp_user')}</Label>
                  <Input className="h-8 text-sm" value={smtp.user} onChange={(e) => setSmtp((p) => ({ ...p, user: e.target.value }))} /></div>
                <div><Label className="text-xs">{t('noticeset.smtp_pass')}</Label>
                  <Input type="password" className="h-8 text-sm" value={smtp.pass} onChange={(e) => setSmtp((p) => ({ ...p, pass: e.target.value }))} /></div>
                <div><Label className="text-xs">{t('noticeset.smtp_from')}</Label>
                  <Input className="h-8 text-sm" value={smtp.from} placeholder="bot@example.com" onChange={(e) => setSmtp((p) => ({ ...p, from: e.target.value }))} /></div>
                <div><Label className="text-xs">{t('noticeset.smtp_to')}</Label>
                  <Input className="h-8 text-sm" value={smtp.to} placeholder="me@example.com" onChange={(e) => setSmtp((p) => ({ ...p, to: e.target.value }))} /></div>
              </div>
              <div className="flex flex-wrap gap-3">
                <span className="text-xs text-muted-foreground">{t('noticeset.push_areas')}</span>
                {AREAS.map((a) => (
                  <label key={a} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input type="checkbox" className="accent-primary" checked={!!(smtp.level_mask & a)}
                      onChange={() => setSmtp((p) => ({ ...p, level_mask: p.level_mask & a ? p.level_mask & ~a : p.level_mask | a }))} />
                    {areaName(a)}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Webhook className="h-4 w-4" />{t('noticeset.push_webhook')}</CardTitle>
              <CardDescription>{t('noticeset.push_webhook_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{t('common.enabled')}</Label>
                <Switch checked={webhook.enabled} onCheckedChange={(v) => setWebhook((p) => ({ ...p, enabled: v }))} />
              </div>
              <div><Label className="text-xs">{t('noticeset.webhook_url')}</Label>
                <Input className="h-8 text-sm font-mono" value={webhook.url} placeholder="https://example.com/hook" onChange={(e) => setWebhook((p) => ({ ...p, url: e.target.value }))} /></div>
              <div className="flex flex-wrap gap-3">
                <span className="text-xs text-muted-foreground">{t('noticeset.push_areas')}</span>
                {AREAS.map((a) => (
                  <label key={a} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input type="checkbox" className="accent-primary" checked={!!(webhook.level_mask & a)}
                      onChange={() => setWebhook((p) => ({ ...p, level_mask: p.level_mask & a ? p.level_mask & ~a : p.level_mask | a }))} />
                    {areaName(a)}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">{'POST {"ts","level","op","msg","origin"}'}</p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={sendTest} disabled={testing}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{t('noticeset.push_test')}
            </Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('common.save')}</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">{t('noticeset.push_hint')}</p>
        </div>
      )}

      {/* ══ 审计日志 ══ */}
      {tab === 'audit' && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-3 border-b">
              <p className="text-xs text-muted-foreground">{t('noticeset.audit_hint')}</p>
              <Button size="sm" variant="outline" onClick={loadAudit} disabled={auditLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${auditLoading ? 'animate-spin' : ''}`} />{t('common.refresh')}
              </Button>
            </div>
            {audit.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <ScrollText className="h-4 w-4" />{t('noticeset.audit_empty')}
              </p>
            ) : (
              <div className="overflow-x-auto"><table className="rt w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left whitespace-nowrap">{t('noticeset.audit_time')}</th>
                    <th className="p-2 text-left whitespace-nowrap">{t('noticeset.audit_area')}</th>
                    <th className="p-2 text-left whitespace-nowrap">{t('noticeset.audit_event')}</th>
                    <th className="p-2 text-left whitespace-nowrap">{t('noticeset.audit_origin')}</th>
                    <th className="p-2 text-left">{t('noticeset.audit_msg')}</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a, i) => (
                    <tr key={i} className="border-b last:border-0 align-top">
                      <td data-label={t('noticeset.audit_time')} className="p-2 font-mono text-xs text-muted-foreground whitespace-nowrap">{a.ts}</td>
                      <td data-label={t('noticeset.audit_area')} className="p-2"><span className={`rounded px-1.5 py-0.5 text-xs ${areaBadgeCls(areaOfLevel(a.level))}`}>{areaName(areaOfLevel(a.level))}</span></td>
                      <td data-label={t('noticeset.audit_event')} className="p-2 text-xs whitespace-nowrap">{a.op ? evName(a.op) : '—'}</td>
                      <td data-label={t('noticeset.audit_origin')} className="p-2 font-mono text-xs text-muted-foreground whitespace-nowrap">{a.origin || '—'}</td>
                      <td data-label={t('noticeset.audit_msg')} className="p-2 text-xs break-all">{a.msg}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NoticeSettingsPage;
