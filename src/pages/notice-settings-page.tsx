import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Plus, Trash2, RefreshCw, Mail, Webhook, Send, Loader2, Pencil, LayoutGrid, List, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FeatureHelp } from '@/components/ui/feature-help';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { EntityAvatar } from '@/components/entity-avatar';
import { platformLabel } from '@/components/platform-icon';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { useServerListPage } from '@/hooks/use-server-list-page';
import { apiClient } from '@/lib/api-client';
import { useTourActive } from '@/components/onboarding/tour-data';
import { tourSamples } from '@/lib/tour-samples';
import { channelTitle, channelKey, emptyNoticeRule, eventIsSelected, setEvent, toggleSelection, noticePageCorrection,
  type NoticeRule, type NoticeChannel, type NoticeMeta } from '@/lib/notice-rules';

const initialMeta: NoticeMeta = { accounts: [], catalog: [], smtp_ready: false, smtp_host: '', smtp_from: '' };
type Audit = { ts: string; level: number; op: string; origin?: string; msg: string };
export const NoticeSettingsPage: React.FC = () => {
  const { t } = useTranslation(); const toast = useToast(); const dialogs = useDialogs(t);
  const tourActive = useTourActive();
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab') || 'windows');
  const [view, setView] = useState(() => { try { return localStorage.getItem('dice-notice-view') || 'card'; } catch { return 'card'; } });
  const [page, setPage] = useState(1), [size, setSize] = useState(10), [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [meta, setMeta] = useState(initialMeta), [readOnly, setReadOnly] = useState(true);
  const [draft, setDraft] = useState<NoticeRule | null>(null), [busy, setBusy] = useState(false);
  const [targetKind, setTargetKind] = useState('group'), [pick, setPick] = useState(''), [pickQuery, setPickQuery] = useState(''), [pickPage, setPickPage] = useState(1);
  const [manualId, setManualId] = useState(''), [manualPlatform, setManualPlatform] = useState('');
  const [email, setEmail] = useState(''), [hook, setHook] = useState('');
  const [audit, setAudit] = useState<Audit[]>([]), [auditPage, setAuditPage] = useState(1);
  const result = useServerListPage<NoticeRule>(`/system/notice/rules?page=${page}&pageSize=${size}&q=${encodeURIComponent(query)}`);
  const [targets, setTargets] = useState<{ items: NoticeChannel[]; total: number }>({ items: [], total: 0 });
  const [targetLoading, setTargetLoading] = useState(false);
  const nm = (key: string) => t('notice_manager.' + key);
  const error = useCallback((e: unknown) => toast({ title: String(e instanceof Error ? e.message : e), variant: 'destructive' }), [toast]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { const timer = setTimeout(() => { setPickQuery(pick.trim()); setPickPage(1); }, 250); return () => clearTimeout(timer); }, [pick]);
  const loadMeta = useCallback(async () => { try {
    const [m,status]=await Promise.all([apiClient.get<NoticeMeta>('/system/notice/meta'),apiClient.get<{role?:string}>('/auth/status')]);
    setMeta(m.data);setReadOnly(status.data.role==='admin');setManualPlatform(current=>current || m.data.accounts[0]?.platform || 'onebot_v11');
  } catch(e) { error(e); } },[error]);
  useEffect(() => { void loadMeta(); }, [loadMeta]);
  useEffect(() => {
    if (!draft || !['group', 'user'].includes(targetKind)) return;
    const abort = new AbortController(); setTargetLoading(true);
    void apiClient.get<{ items: NoticeChannel[]; total: number }>(`/system/notice/targets?kind=${targetKind}&q=${encodeURIComponent(pickQuery)}&page=${pickPage}&pageSize=5`)
      .then(r => { if (!abort.signal.aborted) setTargets(r.data); }).catch(e => { if (!abort.signal.aborted) error(e); })
      .finally(() => { if (!abort.signal.aborted) setTargetLoading(false); });
    return () => abort.abort();
  }, [Boolean(draft), targetKind, pickQuery, pickPage, error]);
  useEffect(() => { const corrected=noticePageCorrection(page,result.data?.page,result.loading,result.error);if(corrected!==undefined)setPage(corrected); }, [result.data, result.loading, result.error, page]);
  const loadAudit = useCallback(async () => { try { const r = await apiClient.get<{ items: Audit[] }>('/system/audit'); setAudit(r.data.items); setAuditPage(1); } catch (e) { error(e); } }, [error]);
  useEffect(() => { if (tab === 'audit') void loadAudit(); }, [tab, loadAudit]);
  const platforms = useMemo(() => [...new Set(meta.accounts.map(a => a.platform))], [meta.accounts]);
  const accountName = (id: string) => { const a = meta.accounts.find(a => a.id === id); return a ? `${a.name || a.login_name} · ${a.login_id || a.id}` : id; };
  const title = (r: NoticeRule) => r.name && r.name !== r.channels[0]?.chat_id ? r.name : channelTitle(r.channels[0], nm(r.channels[0]?.is_group ? 'group' : 'user'));
  const sourceText = (r: NoticeRule) => r.source.mode === 'all' ? nm('all') : (r.source.mode === 'accounts' ? r.source.adapter_ids.map(accountName) : r.source.platforms.map(platformLabel)).join('、');
  const shown = tourActive ? tourSamples.noticeWindows.map((w,i) => ({ ...emptyNoticeRule(), id:'sample-'+i, channels:[{kind:'chat' as const,platform:w.platform,chat_id:w.chat_id,is_group:w.is_group,name:w.name}],level_mask:w.level_mask })) : result.error ? [] : result.data?.items || [];
  const areaName = (level: number) => t(`noticeset.area_${level >= 8 ? 8 : level >= 4 ? 4 : level >= 2 ? 2 : 1}`);
  const areaBadgeCls = (level: number) => level >= 8 ? 'bg-red-500/15 text-red-600' : level >= 4 ? 'bg-amber-500/15 text-amber-600' : level >= 2 ? 'bg-blue-500/15 text-blue-600' : 'bg-muted text-muted-foreground';
  const patch = (value: Partial<NoticeRule>) => setDraft(d => d ? { ...d, ...value } : d);
  const patchChannel = (index: number, value: Partial<NoticeChannel>) => setDraft(d => d ? { ...d, channels: d.channels.map((ch, i) => i === index ? { ...ch, ...value } : ch) } : d);
  const addChannel = (channel: NoticeChannel) => setDraft(d => !d || d.channels.some(ch => channelKey(ch) === channelKey(channel)) ? d : { ...d, channels: [...d.channels, channel] });
  const save = async () => {
    if (!draft) return;
    if (!draft.channels.length) { error(nm('need_channel')); return; }
    if (draft.source.mode !== 'all' && !(draft.source.mode === 'accounts' ? draft.source.adapter_ids : draft.source.platforms).length) { error(nm('need_source')); return; }
    setBusy(true);
    try { if (draft.id) await apiClient.put('/system/notice/rules/' + encodeURIComponent(draft.id), draft); else await apiClient.post('/system/notice/rules', draft);
      setDraft(null); await result.load(); toast({ title: t('common.save_success') });
    } catch (e) { error(e); } finally { setBusy(false); }
  };
  const remove = async (r: NoticeRule) => {
    if (!await dialogs.confirm({ title: nm('remove'), description: title(r), destructive: true })) return;
    setBusy(true); try { await apiClient.delete('/system/notice/rules/' + encodeURIComponent(r.id!)); await result.load(); } catch (e) { error(e); } finally { setBusy(false); }
  };
  const test = async (r: NoticeRule) => {
    if (!await dialogs.confirm({ title: t('noticeset.push_test'), description: nm('test_help') })) return;
    setBusy(true); try { await apiClient.post('/system/notice/test', { id: r.id }); toast({ title: t('noticeset.push_test_sent') }); } catch (e) { error(e); } finally { setBusy(false); }
  };
  const icon = (ch: NoticeChannel, small = false) => ch.kind === 'chat'
    ? <EntityAvatar kind={ch.is_group ? 'group' : 'user'} id={ch.chat_id || ''} platform={ch.platform || ''} className={small ? 'h-8 w-8' : undefined} />
    : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{ch.kind === 'smtp' ? <Mail className="h-5 w-5" /> : <Webhook className="h-5 w-5" />}</span>;
  const recipient = (ch: NoticeChannel) => channelTitle(ch, nm(ch.is_group ? 'group' : ch.kind === 'chat' ? 'user' : ch.kind === 'smtp' ? 'email' : 'webhook'));
  return <div className="space-y-5">
    {dialogs.node}
    <PageHeader icon={Bell} title={t('noticeset.title')} description={nm('hint')} help={t('page_help.notices') + '\n\n' + nm('legacy_help') + '\n\n' + nm('delivery_help')}
      actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { void result.load();void loadMeta(); }} disabled={result.loading}><RefreshCw className="mr-2 h-4 w-4" />{t('common.refresh')}</Button>
        <Button data-tour="notice-add" disabled={readOnly || busy} onClick={() => { setDraft(emptyNoticeRule()); setPick(''); }}><Plus className="mr-2 h-4 w-4" />{nm('add')}</Button></div>} />
    {readOnly && <p className="text-sm text-muted-foreground">{nm('readonly')}</p>}
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList variant="page" data-tour="notice-tabs" aria-label={t('noticeset.title')}>
        <TabsTrigger value="windows">{nm('rules')}</TabsTrigger><TabsTrigger value="push">{t('noticeset.tab_push')}</TabsTrigger><TabsTrigger value="audit">{t('noticeset.tab_audit')}</TabsTrigger>
      </TabsList>
      <TabsContent value="windows" className="space-y-4" data-setting-anchor="notice-windows">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative min-w-0 flex-1 sm:max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input aria-label={nm('search')} className="pl-9" placeholder={nm('search')} value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="flex gap-1"><FeatureHelp title={nm('rules')} description={nm('legacy_help')} />{(['card','list'] as const).map(v => <Button key={v} aria-label={nm(v === 'card' ? 'cards' : 'list')} aria-pressed={view === v} variant={view === v ? 'secondary' : 'ghost'} size="icon" onClick={() => { setView(v); try { localStorage.setItem('dice-notice-view',v); } catch { /* optional preference */ } }}>{v === 'card' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}</Button>)}</div>
        </div>
        {result.error && <p role="alert" className="text-sm text-destructive">{t('common.load_fail')}</p>}
        {result.loading && !tourActive ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : <div className={view === 'card' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
          {shown.map(r => <Card key={r.id} className="min-w-0 shadow-none"><CardContent className={view === 'card' ? 'space-y-4 p-4' : 'grid items-center gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'}>
            <div className="flex items-start gap-3">{icon(r.channels[0])}<div className="min-w-0 flex-1"><p className="break-words font-medium">{title(r)}</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">{r.channels[0].kind === 'chat' ? `${r.name && r.name!==r.channels[0].chat_id && r.name!==recipient(r.channels[0]) ? recipient(r.channels[0])+' · ' : ''}${platformLabel(r.channels[0].platform || '')} · ${r.channels[0].chat_id}` : nm(r.channels[0].kind === 'smtp' ? 'email' : 'webhook')}</p>
            </div><Badge variant={r.enabled ? 'secondary' : 'outline'} className="shrink-0">{nm(r.enabled ? 'active' : 'paused')}</Badge></div>
            <div className="space-y-2 text-xs"><p className="break-words text-muted-foreground">{nm('source')}：{sourceText(r)}</p>
              {r.channels.slice(1,3).map((ch,i) => <div key={i} className="flex min-w-0 items-center gap-2">{icon(ch,true)}<span className="min-w-0 truncate">{recipient(ch)}{ch.kind === 'chat' && <span className="ml-2 font-mono text-muted-foreground">{ch.chat_id}</span>}</span></div>)}
              {r.channels.length>3 && <span className="text-muted-foreground">{nm('channels')} · +{r.channels.length-3}</span>}
            </div><div className={'flex flex-wrap items-center gap-2 ' + (view === 'card' ? 'border-t pt-3' : '')}>
              <Button size="sm" variant="outline" disabled={readOnly || busy} onClick={() => { setDraft(structuredClone(r)); setPick(''); }}><Pencil className="mr-1.5 h-3.5 w-3.5" />{t('common.edit')}</Button>
              <Button size="sm" variant="ghost" disabled={readOnly || busy} onClick={() => void test(r)}><Send className="mr-1.5 h-3.5 w-3.5" />{t('noticeset.push_test')}</Button>
              <Button size="icon" variant="ghost" className="ml-auto h-8 w-8 text-destructive" aria-label={t('common.delete')} disabled={readOnly || busy} onClick={() => void remove(r)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent></Card>)}
          {!shown.length && !result.error && <p className="col-span-full py-14 text-center text-muted-foreground">{nm('empty')}</p>}
        </div>}
        <PaginationBar total={result.data?.total || 0} page={result.data?.page || page} pageSize={size} onPageChange={setPage} onPageSizeChange={s => { setSize(s); setPage(1); }} disabled={result.loading} />
      </TabsContent>
      <TabsContent value="push" className="space-y-4"><Card data-setting-anchor="notice-smtp"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4" />{nm('shared')}<FeatureHelp title={t('noticeset.push_smtp')} description={nm('shared_help')} /></CardTitle></CardHeader>
        <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">{nm('shared_help')}</p><p className="text-sm">{meta.smtp_ready ? `${meta.smtp_host} · ${meta.smtp_from}` : nm('smtp_missing')}</p>
          <Button asChild variant="outline"><a href="#/settings?focus=settings-identity-email">{nm('permissions')}</a></Button></CardContent></Card>
        <Card data-setting-anchor="notice-webhook"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Webhook className="h-4 w-4" />{t('noticeset.push_webhook')}<FeatureHelp title={t('noticeset.push_webhook')} description={nm('destinations')} /></CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{nm('destinations')}</p></CardContent></Card></TabsContent>
      <TabsContent value="audit"><Card className="rt-section" data-setting-anchor="notice-audit"><CardContent className="rt-section-content p-0">
        <div className="rt-section-header flex items-center justify-between gap-3 border-b p-3"><p className="text-xs text-muted-foreground">{t('noticeset.audit_hint')}</p><Button variant="outline" size="sm" onClick={() => void loadAudit()}><RefreshCw className="mr-2 h-4 w-4" />{t('common.refresh')}</Button></div>
        <div className="rt-frame overflow-x-auto"><table className="rt rt-record rt-with-status w-full text-sm"><thead className="border-b text-xs text-muted-foreground"><tr>
          {['time','area','event','origin','msg'].map(key=><th key={key} className="p-2 text-left">{t('noticeset.audit_'+key)}</th>)}
        </tr></thead><tbody>{audit.slice((auditPage-1)*10,auditPage*10).map((a,i)=><tr key={i} className="border-b last:border-0 align-top">
          <td data-label={t('noticeset.audit_time')} className="p-2 font-mono text-xs text-muted-foreground whitespace-nowrap">{a.ts}</td>
          <td data-label={t('noticeset.audit_area')} className="rt-status p-2 whitespace-nowrap"><span className={`inline-flex shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-xs ${areaBadgeCls(a.level)}`}>{areaName(a.level)}</span></td>
          <td data-label={t('noticeset.audit_event')} className="rt-title p-2 text-xs whitespace-nowrap">{t('noticeset.ev_'+a.op,{defaultValue:a.op})}</td>
          <td data-label={t('noticeset.audit_origin')} className="p-2 font-mono text-xs text-muted-foreground whitespace-nowrap">{a.origin || '—'}</td>
          <td data-label={t('noticeset.audit_msg')} className="rt-body p-2 text-xs break-all">{a.msg}</td>
        </tr>)}</tbody></table></div>
        <PaginationBar total={audit.length} page={auditPage} pageSize={10} onPageChange={setAuditPage} fixedSize /></CardContent></Card></TabsContent>
    </Tabs>
    <Dialog open={draft !== null} onOpenChange={open => { if (!open && !busy) setDraft(null); }}><DialogContent className="max-w-3xl">
      <DialogHeader><div className="flex flex-wrap items-center justify-between gap-3 pr-7"><DialogTitle>{nm(draft?.id ? 'edit' : 'add')}</DialogTitle>
        <Button data-tour="notice-save" onClick={() => void save()} disabled={busy || readOnly}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('common.save')}</Button></div>
        <DialogDescription>{nm('destinations')}</DialogDescription></DialogHeader>
      {draft && <DialogBody className="space-y-6">
        <div className="flex items-end gap-4"><div className="min-w-0 flex-1 space-y-2"><Label htmlFor="notice-name">{nm('name')}</Label><Input id="notice-name" maxLength={80} value={draft.name} onChange={e => patch({ name:e.target.value })} /></div><div className="space-y-2"><Label>{t('common.enabled')}</Label><Switch className="block" checked={draft.enabled} onCheckedChange={enabled => patch({enabled})} /></div></div>
        <section className="space-y-3"><Label>{nm('source')}</Label>
          <Select value={draft.source.mode} onValueChange={mode => patch({source:{...draft.source,mode:mode as NoticeRule['source']['mode']}})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['all','platforms','accounts'] as const).map(mode => <SelectItem key={mode} value={mode}>{nm(mode)}</SelectItem>)}</SelectContent></Select>
          {draft.source.mode !== 'all' && <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">{(draft.source.mode === 'platforms' ? platforms.map(p => ({id:p,label:platformLabel(p)})) : meta.accounts.map(a=>({id:a.id,label:accountName(a.id)}))).map(a => <label key={a.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={(draft.source.mode === 'platforms' ? draft.source.platforms : draft.source.adapter_ids).includes(a.id)} onChange={() => patch({source:{...draft.source,[draft.source.mode === 'platforms' ? 'platforms':'adapter_ids']:toggleSelection(draft.source.mode === 'platforms' ? draft.source.platforms:draft.source.adapter_ids,a.id)}})} />{a.label}</label>)}</div>}
          <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="accent-primary" checked={draft.source.include_system} onChange={e => patch({source:{...draft.source,include_system:e.target.checked}})} />{nm('system')}</label>
        </section>
        <section className="space-y-3"><div className="flex items-center gap-2"><Label>{nm('subscription')}</Label><FeatureHelp title={nm('subscription')} description={nm('legacy_help')} /></div>
          <Select value={draft.subscription} onValueChange={value => patch({subscription:value as NoticeRule['subscription'], events:value==='events' ? meta.catalog.filter(e=>eventIsSelected(draft,e)).map(e=>e.op):draft.events})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="levels">{nm('levels')}</SelectItem><SelectItem value="events">{nm('events')}</SelectItem></SelectContent></Select>
          {draft.subscription === 'levels' ? <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">{[1,2,4,8].map(area => <label key={area} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={Boolean(draft.level_mask & area)} onChange={()=>patch({level_mask:draft.level_mask ^ area})} />{t('noticeset.area_'+area)}</label>)}</div>
            : <div className="space-y-3 rounded-lg border p-3">{[1,2,4,8].map(area => <div key={area} className="space-y-2"><p className="text-xs font-medium text-muted-foreground">{t('noticeset.area_'+area)}</p><div className="grid gap-2 sm:grid-cols-2">{meta.catalog.filter(e=>e.area===area).map(e => <label key={e.op} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={eventIsSelected(draft,e)} onChange={()=>setDraft(setEvent(draft,e.op,meta.catalog))} />{t('noticeset.ev_'+e.op,{defaultValue:e.op})}</label>)}</div></div>)}</div>}
          {(draft.subscription === 'events' ? !draft.events.length : draft.level_mask === 0) && <p className="text-xs text-amber-600">{nm('no_events')}</p>}
        </section>
        <section className="space-y-3"><div className="flex items-center gap-2"><Label>{nm('channels')}</Label><FeatureHelp title={nm('channels')} description={nm('delivery_help')} /></div>
          {draft.channels.map((ch,index) => <div key={channelKey(ch)+index} className="space-y-3 rounded-lg border p-3"><div className="flex items-center gap-3">{icon(ch,true)}<div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{recipient(ch)}</p>{ch.kind === 'chat' && <p className="break-all font-mono text-xs text-muted-foreground">{platformLabel(ch.platform || '')} · {ch.chat_id}</p>}</div><Button variant="ghost" size="icon" aria-label={t('common.delete')} onClick={()=>patch({channels:draft.channels.filter((_,i)=>i!==index)})}><Trash2 className="h-4 w-4" /></Button></div>
            {ch.kind === 'chat' && <><Select value={ch.delivery || 'auto'} onValueChange={delivery=>patchChannel(index,{delivery:delivery as 'auto'|'selected',adapter_ids:ch.adapter_ids || []})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">{nm('auto')}</SelectItem><SelectItem value="selected">{nm('selected')}</SelectItem></SelectContent></Select>
              {ch.delivery === 'selected' && <div className="grid gap-2 sm:grid-cols-2">{meta.accounts.filter(a=>a.platform===ch.platform).map(a=><label key={a.id} className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-primary" checked={ch.adapter_ids?.includes(a.id) || false} onChange={()=>patchChannel(index,{adapter_ids:toggleSelection(ch.adapter_ids || [],a.id)})} />{accountName(a.id)}</label>)}</div>}</>}
            {ch.kind === 'smtp' && <><Input aria-label={nm('recipient')} value={ch.to || ''} onChange={e=>patchChannel(index,{to:e.target.value})} />
              {ch.transport === 'legacy' ? <div className="space-y-2"><p className="text-xs text-muted-foreground">{nm('legacy_smtp')}</p><Button size="sm" variant="outline" onClick={()=>patchChannel(index,{transport:'shared'})}>{nm('shared')}</Button></div> : <p className="text-xs text-muted-foreground">{meta.smtp_ready ? nm('shared')+' · '+meta.smtp_host : nm('smtp_missing')}</p>}</>}
            {ch.kind === 'webhook' && <Input aria-label="Webhook URL" value={ch.url || ''} onChange={e=>patchChannel(index,{url:e.target.value})} />}
          </div>)}
          <div className="space-y-3 rounded-lg border border-dashed p-3"><Select value={targetKind} onValueChange={value=>{setTargetKind(value);setPickPage(1);}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['group','user','email','webhook'].map(kind=><SelectItem key={kind} value={kind}>{nm(kind)}</SelectItem>)}</SelectContent></Select>
            {['group','user'].includes(targetKind) ? <><Input placeholder={nm('search')} value={pick} onChange={e=>setPick(e.target.value)} />
              {targetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <div className="space-y-1">{targets.items.map(ch=><button type="button" key={channelKey(ch)} className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted" onClick={()=>addChannel(ch)}>{icon(ch,true)}<span className="min-w-0 flex-1 truncate text-sm">{recipient(ch)}<span className="ml-2 font-mono text-xs text-muted-foreground">{ch.chat_id}</span></span><Plus className="h-4 w-4" /></button>)}</div>}
              <PaginationBar total={targets.total} page={pickPage} pageSize={5} onPageChange={setPickPage} fixedSize compact />
              <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">{nm('manual')}</summary><div className="mt-3 flex flex-wrap gap-2"><Select value={manualPlatform} onValueChange={setManualPlatform}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{[...new Set([...platforms,manualPlatform].filter(Boolean))].map(p=><SelectItem key={p} value={p}>{platformLabel(p)}</SelectItem>)}</SelectContent></Select><Input className="min-w-0 flex-1" aria-label={nm('manual')} value={manualId} onChange={e=>setManualId(e.target.value)} /><Button variant="outline" disabled={!manualId.trim()} onClick={()=>{addChannel({kind:'chat',platform:manualPlatform,chat_id:manualId.trim(),is_group:targetKind==='group',delivery:'auto',adapter_ids:[]});setManualId('');}}><Plus className="h-4 w-4" /></Button></div></details>
            </> : targetKind === 'email' ? <><p className="text-xs text-muted-foreground">{nm('shared_help')}</p><div className="flex gap-2"><Input className="min-w-0 flex-1" aria-label={nm('recipient')} placeholder="name@example.com" value={email} onChange={e=>setEmail(e.target.value)} /><Button variant="outline" aria-label={t('common.add')} disabled={!email.trim()} onClick={()=>{addChannel({kind:'smtp',to:email.trim(),transport:'shared'});setEmail('');}}><Plus className="h-4 w-4" /></Button></div></>
              : <div className="flex gap-2"><Input className="min-w-0 flex-1" aria-label="Webhook URL" placeholder="https://example.com/hook" value={hook} onChange={e=>setHook(e.target.value)} /><Button variant="outline" aria-label={t('common.add')} disabled={!hook.trim()} onClick={()=>{addChannel({kind:'webhook',url:hook.trim()});setHook('');}}><Plus className="h-4 w-4" /></Button></div>}
          </div>
        </section>
      </DialogBody>}
    </DialogContent></Dialog>
  </div>;
};
export default NoticeSettingsPage;
