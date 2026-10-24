import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Plus, Trash2, RefreshCw, Mail, Webhook, Send, Loader2, Pencil, LayoutGrid, List, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FeatureHelp } from '@/components/ui/feature-help';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { EntityAvatar } from '@/components/entity-avatar';
import { NoticeWindowEditor } from '@/components/notice-window-editor';
import { platformLabel } from '@/components/platform-icon';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { useServerListPage } from '@/hooks/use-server-list-page';
import { apiClient } from '@/lib/api-client';
import { useTourActive } from '@/components/onboarding/tour-data';
import { tourSamples } from '@/lib/tour-samples';
import { channelTitle, emptyNoticeWindow, noticePageCorrection, type NoticeWindow, type NoticeMeta, type NoticeSubscription } from '@/lib/notice-rules';

const initialMeta: NoticeMeta = { accounts: [], catalog: [], smtp_ready: false, smtp_host: '', smtp_from: '' };
type Audit = { ts: string; level: number; op: string; origin?: string; msg: string };

export function NoticeSettingsPage() {
  const { t } = useTranslation(); const toast = useToast(); const dialogs = useDialogs(t); const tourActive = useTourActive();
  const [params, setParams] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] || ''));
  const openedFromLink = useRef('');
  const [tab, setTab] = useState(params.get('tab') === 'audit' ? 'audit' : 'windows');
  const [view, setView] = useState(() => { try { return localStorage.getItem('dice-notice-view') || 'card'; } catch { return 'card'; } });
  const [page, setPage] = useState(1), [size, setSize] = useState(10), [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [meta, setMeta] = useState(initialMeta), [readOnly, setReadOnly] = useState(true), [metaLoaded, setMetaLoaded] = useState(false);
  const [draft, setDraft] = useState<NoticeWindow | null>(null), [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<Audit[]>([]), [auditPage, setAuditPage] = useState(1), [auditDetail, setAuditDetail] = useState<Audit | null>(null);
  const result = useServerListPage<NoticeWindow>(`/system/notice/windows?page=${page}&pageSize=${size}&q=${encodeURIComponent(query)}`);
  const nm = (key: string) => t('notice_manager.' + key);
  const error = useCallback((e: unknown) => toast({ title: String(e instanceof Error ? e.message : e), variant: 'destructive' }), [toast]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    const changed = () => setParams(new URLSearchParams(window.location.hash.split('?')[1] || ''));
    window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed);
  }, []);
  const loadMeta = useCallback(async () => {
    try {
      const [m, status] = await Promise.all([apiClient.get<NoticeMeta>('/system/notice/meta'), apiClient.get<{ role?: string }>('/auth/status')]);
      setMeta(m.data); setReadOnly(status.data.role === 'admin'); setMetaLoaded(true);
    } catch (e) { error(e); }
  }, [error]);
  useEffect(() => {
    void loadMeta(); const refresh = () => { if (document.visibilityState === 'visible') void loadMeta(); };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [loadMeta]);
  useEffect(() => {
    const key = params.toString();
    if (!metaLoaded || readOnly || openedFromLink.current === key) return;
    openedFromLink.current = key;
    const focus = params.get('focus');
    if (focus === 'notice-webhook' || focus === 'notice-smtp' || params.get('tab') === 'push') {
      setTab('windows'); setDraft(emptyNoticeWindow(meta.accounts, focus === 'notice-webhook' ? 'webhook' : 'email'));
    } else if (params.get('tab') === 'audit') setTab('audit');
  }, [params, metaLoaded, meta.accounts, readOnly]);
  useEffect(() => { const corrected = noticePageCorrection(page, result.data?.page, result.loading, result.error); if (corrected !== undefined) setPage(corrected); }, [result.data, result.loading, result.error, page]);
  const loadAudit = useCallback(async () => {
    try { const r = await apiClient.get<{ items: Audit[] }>('/system/audit'); setAudit(r.data.items); setAuditPage(1); } catch (e) { error(e); }
  }, [error]);
  useEffect(() => { if (tab === 'audit') void loadAudit(); }, [tab, loadAudit]);
  const accountName = (id: string) => { const a = meta.accounts.find(a => a.id === id); return a ? `${a.name || a.login_name || platformLabel(a.platform)} · ${a.login_id || a.id}` : id; };
  const recipient = (w: NoticeWindow) => channelTitle(w.channel, nm(w.channel.kind === 'chat' ? w.channel.is_group ? 'group' : 'user' : w.channel.kind === 'smtp' ? 'email' : 'webhook'));
  const title = (w: NoticeWindow) => w.name && w.name !== w.channel.chat_id ? w.name : recipient(w);
  const sourceText = (s: NoticeSubscription) => s.source.mode === 'all' ? nm('all') : (s.source.mode === 'accounts' ? s.source.adapter_ids.map(accountName) : s.source.platforms.map(platformLabel)).join('、');
  const senderText = (w: NoticeWindow) => w.mixed_delivery ? nm('mixed_senders') : w.channel.delivery === 'auto' ? nm('old_auto') : w.channel.adapter_ids?.map(accountName).join('、');
  const shown: NoticeWindow[] = tourActive ? tourSamples.noticeWindows.map((w, i) => {
    const sample = emptyNoticeWindow(); sample.subscriptions[0].level_mask = w.level_mask;
    return { ...sample, id: 'sample-' + i, channel: { kind: 'chat', platform: w.platform, chat_id: w.chat_id, is_group: w.is_group, name: w.name } };
  }) : result.error ? [] : result.data?.items || [];
  const areaName = (level: number) => t(`noticeset.area_${level >= 8 ? 8 : level >= 4 ? 4 : level >= 2 ? 2 : 1}`);
  const areaClass = (level: number) => level >= 8 ? 'bg-red-500/15 text-red-600' : level >= 4 ? 'bg-amber-500/15 text-amber-600' : level >= 2 ? 'bg-blue-500/15 text-blue-600' : 'bg-muted text-muted-foreground';
  const save = async (value: NoticeWindow) => {
    setBusy(true);
    try {
      if (value.id) await apiClient.put('/system/notice/windows/' + encodeURIComponent(value.id), value); else await apiClient.post('/system/notice/windows', value);
      setDraft(null); await result.load(); toast({ title: t('common.save_success') });
    } catch (e) { error(e); } finally { setBusy(false); }
  };
  const remove = async (w: NoticeWindow) => {
    if (!await dialogs.confirm({ title: nm('remove'), description: title(w), destructive: true })) return;
    setBusy(true); try { await apiClient.delete('/system/notice/windows/' + encodeURIComponent(w.id!)); await result.load(); } catch (e) { error(e); } finally { setBusy(false); }
  };
  const test = async (w: NoticeWindow) => {
    if (!await dialogs.confirm({ title: t('noticeset.push_test'), description: nm('test_help') })) return;
    setBusy(true); try { await apiClient.post('/system/notice/windows/' + encodeURIComponent(w.id!) + '/test'); toast({ title: t('noticeset.push_test_sent') }); } catch (e) { error(e); } finally { setBusy(false); }
  };
  const eventName = (a: Audit) => t('noticeset.ev_' + a.op, { defaultValue: a.op });
  return <div className="space-y-5">
    {dialogs.node}
    <PageHeader icon={Bell} title={t('noticeset.title')} description={nm('hint')} help={t('page_help.notices') + '\n\n' + nm('legacy_help') + '\n\n' + nm('delivery_help')}
      actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { void result.load(); void loadMeta(); }} disabled={result.loading}><RefreshCw className="mr-2 h-4 w-4" />{t('common.refresh')}</Button>
        <Button data-tour="notice-add" disabled={readOnly || busy} onClick={() => setDraft(emptyNoticeWindow(meta.accounts))}><Plus className="mr-2 h-4 w-4" />{nm('add')}</Button></div>} />
    {readOnly && <p className="text-sm text-muted-foreground">{nm('readonly')}</p>}
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList variant="page" data-tour="notice-tabs" aria-label={t('noticeset.title')}><TabsTrigger value="windows">{nm('rules')}</TabsTrigger><TabsTrigger value="audit">{t('noticeset.tab_audit')}</TabsTrigger></TabsList>
      <TabsContent value="windows" className="space-y-4" data-setting-anchor="notice-windows">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative min-w-0 flex-1 sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label={nm('search')} className="pl-9" placeholder={nm('search')} value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="flex gap-1"><FeatureHelp title={nm('rules')} description={nm('legacy_help')} />{(['card', 'list'] as const).map(v => <Button key={v} aria-label={nm(v === 'card' ? 'cards' : 'list')} aria-pressed={view === v} variant={view === v ? 'secondary' : 'ghost'} size="icon" onClick={() => { setView(v); try { localStorage.setItem('dice-notice-view', v); } catch { /* optional preference */ } }}>{v === 'card' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}</Button>)}</div></div>
        {result.error && <p role="alert" className="text-sm text-destructive">{t('common.load_fail')}</p>}
        {result.loading && !tourActive ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : <div className={view === 'card' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
          {shown.map(w => <Card key={w.id} className="min-w-0 shadow-none" data-testid="notice-window"><CardContent className={view === 'card' ? 'space-y-4 p-4' : 'grid items-center gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'}>
            <div className="flex min-w-0 items-start gap-3">{w.channel.kind === 'chat' ? <EntityAvatar kind={w.channel.is_group ? 'group' : 'user'} id={w.channel.chat_id || ''} platform={w.channel.platform || ''} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{w.channel.kind === 'smtp' ? <Mail className="h-5 w-5" /> : <Webhook className="h-5 w-5" />}</span>}
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{title(w)}</p><p className="mt-1 truncate text-xs text-muted-foreground">{w.channel.kind === 'chat' ? `${w.name && w.name !== recipient(w) && w.name !== w.channel.chat_id ? recipient(w) + ' · ' : ''}${platformLabel(w.channel.platform || '')} · ${w.channel.chat_id}` : nm(w.channel.kind === 'smtp' ? 'email' : w.channel.profile || 'generic') + (w.name ? ' · ' + recipient(w) : '')}</p></div><Badge variant={w.enabled ? 'secondary' : 'outline'} className="shrink-0">{nm(w.enabled ? 'active' : 'paused')}</Badge></div>
            <div className="min-w-0 space-y-2 text-xs text-muted-foreground"><p className="truncate">{nm('source')}：{w.subscriptions.length === 1 ? sourceText(w.subscriptions[0]) : t('notice_manager.policy_count', { count: w.subscriptions.length })}</p>{w.channel.kind === 'chat' && <p className="truncate">{nm('sender')}：{senderText(w)}</p>}</div>
            <div className={'flex flex-wrap items-center gap-2 ' + (view === 'card' ? 'border-t pt-3' : '')}><Button size="sm" variant="outline" disabled={readOnly || busy} onClick={() => setDraft(structuredClone(w))}><Pencil className="mr-1.5 h-3.5 w-3.5" />{t('common.edit')}</Button><Button size="sm" variant="ghost" disabled={readOnly || busy} onClick={() => void test(w)}><Send className="mr-1.5 h-3.5 w-3.5" />{t('noticeset.push_test')}</Button><Button size="icon" variant="ghost" className="ml-auto h-8 w-8 text-destructive" aria-label={t('common.delete')} disabled={readOnly || busy} onClick={() => void remove(w)}><Trash2 className="h-4 w-4" /></Button></div>
          </CardContent></Card>)}
          {!shown.length && !result.error && <p className="col-span-full py-14 text-center text-muted-foreground">{nm('empty')}</p>}
        </div>}
        <PaginationBar total={result.data?.total || 0} page={result.data?.page || page} pageSize={size} onPageChange={setPage} onPageSizeChange={s => { setSize(s); setPage(1); }} disabled={result.loading} />
      </TabsContent>
      <TabsContent value="audit"><Card data-setting-anchor="notice-audit"><CardContent className="min-w-0 p-0">
        <div className="flex items-center justify-between gap-3 border-b p-3"><p className="text-xs text-muted-foreground">{t('noticeset.audit_hint')}</p><Button variant="outline" size="sm" onClick={() => void loadAudit()}><RefreshCw className="mr-2 h-4 w-4" />{t('common.refresh')}</Button></div>
        <div className="overflow-x-auto"><table data-testid="notice-audit-table" className="w-full min-w-[960px] table-fixed text-sm"><colgroup><col className="w-44" /><col className="w-20" /><col className="w-40" /><col className="w-48" /><col /></colgroup><thead className="border-b text-xs text-muted-foreground"><tr>{['time', 'area', 'event', 'origin', 'msg'].map(key => <th key={key} className="h-10 whitespace-nowrap px-3 text-left font-medium">{t('noticeset.audit_' + key)}</th>)}</tr></thead>
          <tbody>{audit.slice((auditPage - 1) * 10, auditPage * 10).map((a, i) => <tr key={i} className="h-12 border-b last:border-0"><td className="h-12 overflow-hidden px-3 font-mono text-xs text-muted-foreground"><span className="block truncate">{a.ts}</span></td><td className="h-12 overflow-hidden px-3"><span className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-xs ${areaClass(a.level)}`}>{areaName(a.level)}</span></td><td className="h-12 overflow-hidden px-3 text-xs"><span className="block truncate">{eventName(a)}</span></td><td className="h-12 overflow-hidden px-3 text-xs text-muted-foreground"><span className="block truncate">{a.origin || '—'}</span></td><td className="h-12 overflow-hidden px-3 text-xs"><button type="button" aria-label={nm('view_detail')} className="block w-full truncate rounded py-2 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setAuditDetail(a)}>{a.msg}</button></td></tr>)}</tbody>
        </table></div><PaginationBar total={audit.length} page={auditPage} pageSize={10} onPageChange={setAuditPage} fixedSize />
      </CardContent></Card></TabsContent>
    </Tabs>
    {draft && <NoticeWindowEditor initial={draft} meta={meta} busy={busy} onSave={save} onClose={() => setDraft(null)} />}
    <Dialog open={auditDetail !== null} onOpenChange={open => { if (!open) setAuditDetail(null); }}><DialogContent layout="editor" className="max-w-3xl gap-0 p-0" data-testid="notice-audit-detail"><DialogHeader className="border-b px-6 py-5 pr-12"><DialogTitle>{nm('audit_detail')}</DialogTitle><DialogDescription>{auditDetail && eventName(auditDetail)}</DialogDescription></DialogHeader>
      {auditDetail && <DialogBody className="space-y-5 p-6"><dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">{[[t('noticeset.audit_time'), auditDetail.ts], [t('noticeset.audit_area'), areaName(auditDetail.level)], [t('noticeset.audit_event'), eventName(auditDetail)], [t('noticeset.audit_origin'), auditDetail.origin || '—']].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl><section className="space-y-2"><h3 className="text-sm font-medium">{nm('full_content')}</h3><pre className="select-text whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-4 font-sans text-sm leading-relaxed">{auditDetail.msg}</pre></section></DialogBody>}
    </DialogContent></Dialog>
  </div>;
}
export default NoticeSettingsPage;
