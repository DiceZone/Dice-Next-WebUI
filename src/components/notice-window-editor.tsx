import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ExternalLink, Loader2, Mail, Plus, Search, Trash2 } from 'lucide-react';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { FeatureHelp } from '@/components/ui/feature-help';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { EntityAvatar } from '@/components/entity-avatar';
import { platformLabel } from '@/components/platform-icon';
import { apiClient } from '@/lib/api-client';
import { channelKey, channelTitle, emptyNoticeSubscription, emptyNoticeWindow, eventIsSelected, noticeWindowError,
  parseWebhookDraft, toggleSelection, unifiedSenders, webhookPreset, webhookPreview, webhookVariables,
  type NoticeChannel, type NoticeMeta, type NoticeSubscription, type NoticeWindow, type WebhookProfile } from '@/lib/notice-rules';

function CheckOption({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className="flex min-w-0 cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm">
    <Checkbox className="mt-0.5" checked={checked} onCheckedChange={onChange} disabled={disabled} />
    <span className="min-w-0 break-words leading-5">{label}</span>
  </label>;
}

export function NoticeWindowEditor({ initial, meta, busy, onSave, onClose }: {
  initial: NoticeWindow; meta: NoticeMeta; busy: boolean; onSave: (value: NoticeWindow) => Promise<void>; onClose: () => void;
}) {
  const { t } = useTranslation(); const nm = (key: string) => t('notice_manager.' + key);
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [error, setError] = useState(''), [activePolicy, setActivePolicy] = useState(0);
  const [levelEditing, setLevelEditing] = useState<Record<number, boolean>>({});
  const [query, setQuery] = useState(''), [debouncedQuery, setDebouncedQuery] = useState(''), [page, setPage] = useState(1);
  const [targets, setTargets] = useState<{ items: NoticeChannel[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false), [targetError, setTargetError] = useState('');
  const [manualId, setManualId] = useState('');
  const [body, setBody] = useState(() => JSON.stringify(initial.channel.body_template || webhookPreset(initial.channel.profile || 'generic'), null, 2));
  const [headers, setHeaders] = useState(() => JSON.stringify(initial.channel.headers || {}, null, 2));
  const urlRef = useRef<HTMLInputElement>(null), bodyRef = useRef<HTMLTextAreaElement>(null);
  const ch = draft.channel;
  const kind = ch.kind === 'chat' ? ch.is_group ? 'group' : 'user' : ch.kind === 'smtp' ? 'email' : 'webhook';
  const platforms = useMemo(() => [...new Set(meta.accounts.map(account => account.platform))], [meta.accounts]);
  const accountName = (id: string) => { const a = meta.accounts.find(account => account.id === id); return a ? `${a.name || a.login_name || platformLabel(a.platform)} · ${a.login_id || a.id}` : id; };
  const available = meta.accounts.filter(account => account.platform === ch.platform);
  const patchChannel = (value: Partial<NoticeChannel>) => setDraft(current => ({ ...current, channel: { ...current.channel, ...value } }));
  const policyPatch = (index: number, value: Partial<NoticeSubscription>) => setDraft(current => ({ ...current, subscriptions: current.subscriptions.map((policy, i) => i === index ? { ...policy, ...value } : policy) }));
  const senderPatch = (value: Partial<NoticeChannel>) => setDraft(current => unifiedSenders(current, { ...current.channel, ...value }));
  const choose = (target: NoticeChannel) => {
    const senders = meta.accounts.filter(account => account.platform === target.platform);
    setDraft(current => unifiedSenders(current, { ...target, delivery: 'selected', adapter_ids: senders[0] ? [senders[0].id] : [] }));
    setError(''); setQuery('');
  };
  const changeKind = (value: string) => {
    const next = emptyNoticeWindow(meta.accounts, value);
    setDraft(current => unifiedSenders(current, next.channel)); setQuery(''); setPage(1); setError('');
    if (value === 'webhook') { setBody(JSON.stringify(webhookPreset('generic'), null, 2)); setHeaders('{}'); }
  };
  useEffect(() => { const timer = setTimeout(() => { setDebouncedQuery(query.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    if (ch.kind !== 'chat' || ch.chat_id) return;
    let active = true; setLoading(true); setTargetError('');
    void apiClient.get<{ items: NoticeChannel[]; total: number }>(`/system/notice/targets?kind=${kind}&q=${encodeURIComponent(debouncedQuery)}&page=${page}&pageSize=5`)
      .then(response => { if (active) setTargets(response.data); }).catch(() => { if (active) setTargetError(t('common.load_fail')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, ch.kind, ch.chat_id, debouncedQuery, page, t]);
  const smtpReady = ch.transport === 'legacy' ? meta.legacy_smtp_ready : meta.smtp_ready;
  const invalidHook = ch.kind === 'webhook' && noticeWindowError({ ...draft, subscriptions: [emptyNoticeSubscription()] }, meta) === 'invalid_webhook';
  const preview = useMemo(() => {
    try { return JSON.stringify(webhookPreview(JSON.parse(body), { message: '[测试通知] 这是一条测试通知。', title: '测试通知', time: '2026-10-25 04:00:00',
      level: 2, level_name: '重要', event: 'test', origin: 'onebot_v11:933145116', platform: 'onebot_v11', adapter_id: 'demo-adapter', account_id: '10001', group_id: '933145116', group_name: '测试群', user_id: '1707642', user_name: '希亚' }), null, 2); }
    catch { return ''; }
  }, [body]);
  const save = async () => {
    let value = draft;
    if (ch.kind === 'webhook') {
      const parsed = parseWebhookDraft(ch, body, headers);
      if (parsed.error) { setError(nm(parsed.error)); return; }
      value = { ...draft, channel: parsed.channel! };
    }
    const validation = noticeWindowError(value, meta);
    if (validation) { setError(nm(validation)); return; }
    setError(''); await onSave(value);
  };
  const insertVariable = (name: string) => {
    const area = bodyRef.current, tag = `{{${name}}}`, start = area?.selectionStart ?? body.length, end = area?.selectionEnd ?? start;
    setBody(body.slice(0, start) + tag + body.slice(end));
    requestAnimationFrame(() => { area?.focus(); area?.setSelectionRange(start + tag.length, start + tag.length); });
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent layout="editor" className="max-w-6xl gap-0 p-0" data-testid="notice-editor">
      <DialogHeader className="border-b px-5 py-5 pr-12 sm:px-7 sm:pr-14">
        <div className="flex items-center justify-between gap-4"><DialogTitle>{nm(initial.id ? 'edit' : 'add')}</DialogTitle>
          <Button onClick={() => void save()} disabled={busy} data-tour="notice-save">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('common.save')}</Button></div>
        <DialogDescription className="pr-2">{nm('destinations')}</DialogDescription>
      </DialogHeader>
      <DialogBody className="px-5 py-5 sm:px-7" data-testid="notice-editor-scroll">
        {error && <p role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <section className="min-w-0 space-y-5" aria-label={nm('destination')}>
            <div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold">1. {nm('destination')}</h3>
              <div className="flex items-center gap-2"><Label htmlFor="notice-window-enabled">{t('common.enabled')}</Label><Switch id="notice-window-enabled" checked={draft.enabled} onCheckedChange={enabled => setDraft(current => ({ ...current, enabled }))} /></div></div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2"><Label htmlFor="notice-kind">{nm('kind')}</Label><Select value={kind} onValueChange={changeKind}><SelectTrigger id="notice-kind"><SelectValue /></SelectTrigger><SelectContent>{['group', 'user', 'email', 'webhook'].map(k => <SelectItem key={k} value={k}>{nm(k)}</SelectItem>)}</SelectContent></Select></div>
              <div className="min-w-0 space-y-2"><Label htmlFor="notice-name">{nm('name')}</Label><Input id="notice-name" maxLength={80} value={draft.name} onChange={e => setDraft(current => ({ ...current, name: e.target.value }))} /></div>
            </div>
            {ch.kind === 'chat' && <>
              {ch.chat_id ? <div className="flex min-w-0 items-center gap-3 rounded-lg border p-4"><EntityAvatar kind={ch.is_group ? 'group' : 'user'} id={ch.chat_id} platform={ch.platform || ''} className="h-10 w-10" />
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{channelTitle(ch, nm(ch.is_group ? 'group' : 'user'))}</p><p className="truncate text-xs text-muted-foreground">{platformLabel(ch.platform || '')} · {ch.chat_id}</p></div>
                <Button size="sm" variant="outline" onClick={() => patchChannel({ chat_id: '', name: '', display_name: '' })}>{nm('change_target')}</Button>
              </div> : <div className="min-w-0 space-y-3 rounded-lg border p-4">
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder={nm('search')} aria-label={nm('search')} value={query} onChange={e => setQuery(e.target.value)} /></div>
                {targetError && <p role="alert" className="text-sm text-destructive">{targetError}</p>}
                {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : <div className="space-y-1">{targets.items.map(target => {
                  const exists = target.notice_window_id && target.notice_window_id !== initial.id;
                  return <button type="button" key={channelKey(target)} disabled={Boolean(exists)} className="flex w-full min-w-0 items-center gap-3 rounded-md p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" onClick={() => choose(target)} aria-label={`${nm('choose_target')} ${target.display_name || target.name || target.chat_id}`}>
                    <EntityAvatar kind={target.is_group ? 'group' : 'user'} id={target.chat_id || ''} platform={target.platform || ''} className="h-8 w-8" /><div className="min-w-0 flex-1"><p className="truncate text-sm">{channelTitle(target, nm(target.is_group ? 'group' : 'user'))}</p><p className="truncate text-xs text-muted-foreground">{platformLabel(target.platform || '')} · {target.chat_id}</p></div><span className="shrink-0 text-xs text-muted-foreground">{exists ? nm('configured') : <Plus className="h-4 w-4" />}</span>
                  </button>;
                })}</div>}
                <PaginationBar total={targets.total} page={page} pageSize={5} onPageChange={setPage} fixedSize compact />
                <details><summary className="cursor-pointer text-xs text-muted-foreground">{nm('manual')}</summary><div className="mt-3 grid min-w-0 gap-3">
                  <Select value={ch.platform} onValueChange={platform => senderPatch({ platform, adapter_ids: meta.accounts.filter(a => a.platform === platform).slice(0, 1).map(a => a.id) })}><SelectTrigger aria-label={nm('platform')}><SelectValue /></SelectTrigger><SelectContent>{[...new Set([...platforms, ch.platform || 'onebot_v11'])].map(p => <SelectItem key={p} value={p}>{platformLabel(p)}</SelectItem>)}</SelectContent></Select>
                  <div className="flex min-w-0 gap-2"><Input className="min-w-0" aria-label={nm('manual')} value={manualId} onChange={e => setManualId(e.target.value)} /><Button variant="outline" disabled={!manualId.trim()} onClick={() => { choose({ ...ch, chat_id: manualId.trim() }); setManualId(''); }}>{t('workspace.select')}</Button></div>
                </div></details>
              </div>}
              <section className="space-y-3 rounded-lg border p-4"><div className="flex items-center gap-2"><Label>{nm('sender')}</Label><FeatureHelp title={nm('sender')} description={nm('delivery_help')} /></div>
                {draft.mixed_delivery ? <><p className="text-xs text-amber-600">{nm('mixed_help')}</p><Select value="legacy" onValueChange={() => senderPatch({ delivery: 'selected', adapter_ids: [...new Set(draft.subscriptions.flatMap(p => p.sender?.adapter_ids || []))] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="legacy">{nm('mixed_senders')}</SelectItem><SelectItem value="selected">{nm('unify_senders')}</SelectItem></SelectContent></Select></>
                  : ch.delivery === 'auto' ? <Select value="auto" onValueChange={() => senderPatch({ delivery: 'selected', adapter_ids: available.slice(0, 1).map(a => a.id) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">{nm('old_auto')}</SelectItem><SelectItem value="selected">{nm('unify_senders')}</SelectItem></SelectContent></Select>
                    : <div className="grid min-w-0 gap-1 sm:grid-cols-2">{available.map(a => <CheckOption key={a.id} label={accountName(a.id)} checked={ch.adapter_ids?.includes(a.id) || false} onChange={() => senderPatch({ adapter_ids: toggleSelection(ch.adapter_ids || [], a.id) })} />)}{!available.length && <p className="col-span-full text-sm text-amber-600">{nm('no_sender')}</p>}</div>}
              </section>
            </>}
            {ch.kind === 'smtp' && <section className="space-y-4 rounded-lg border p-4" data-setting-anchor="notice-smtp">
              <div className="space-y-2"><div className="flex items-center gap-2"><Label htmlFor="notice-email">{nm('recipient')}</Label><FeatureHelp title={t('noticeset.push_smtp')} description={nm('shared_help')} /></div><Input id="notice-email" type="email" value={ch.to || ''} onChange={e => patchChannel({ to: e.target.value })} placeholder="name@example.com" /></div>
              <p className="text-xs text-muted-foreground">{nm('shared_help')}</p>
              {!smtpReady && <div role="alert" className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3"><p className="text-sm text-amber-700 dark:text-amber-400">{nm('smtp_missing')}</p><Button asChild variant="outline" size="sm"><a href="#/settings?focus=settings-identity-email" target="_blank" rel="noopener noreferrer">{nm('configure_smtp')}<ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button></div>}
              {smtpReady && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-4 w-4" />{meta.smtp_host} · {meta.smtp_from}</p>}
              {ch.transport === 'legacy' && <div className="space-y-2"><p className="text-xs text-muted-foreground">{nm('legacy_smtp')}</p><Button variant="outline" size="sm" onClick={() => patchChannel({ transport: 'shared' })}>{nm('shared')}</Button></div>}
            </section>}
            {ch.kind === 'webhook' && <section className="min-w-0 space-y-4 rounded-lg border p-4" data-setting-anchor="notice-webhook">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="notice-provider">{nm('provider')}</Label><Select value={ch.profile || 'generic'} onValueChange={value => {
                patchChannel({ profile: value as WebhookProfile, method: 'POST', headers: {}, body_template: undefined, sign_secret: undefined });
                setBody(JSON.stringify(webhookPreset(value as WebhookProfile), null, 2)); setHeaders('{}');
              }}><SelectTrigger id="notice-provider"><SelectValue /></SelectTrigger><SelectContent>{(['generic', 'wecom', 'dingtalk', 'feishu', 'custom'] as const).map(p => <SelectItem key={p} value={p}>{nm(p)}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="notice-method">{nm('method')}</Label><Select value={ch.method || 'POST'} onValueChange={method => patchChannel({ method: method as NoticeChannel['method'] })}><SelectTrigger id="notice-method"><SelectValue /></SelectTrigger><SelectContent>{['POST', 'PUT', 'PATCH'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div></div>
              <div className="space-y-2"><div className="flex items-center gap-2"><Label htmlFor="notice-webhook-url">Webhook URL</Label><FeatureHelp title={t('noticeset.push_webhook')} description={nm('advanced_help')} /></div><Input ref={urlRef} id="notice-webhook-url" type="url" autoComplete="off" value={ch.url || ''} onChange={e => patchChannel({ url: e.target.value })} placeholder="https://example.com/webhook" /></div>
              {invalidHook && <div role="alert" className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3"><p className="text-sm text-amber-700 dark:text-amber-400">{nm('invalid_webhook')}</p><Button variant="outline" size="sm" onClick={() => { urlRef.current?.focus(); urlRef.current?.scrollIntoView({ block: 'nearest' }); }}>{nm('configure_webhook')}</Button></div>}
              <details open={ch.profile === 'custom' || Boolean(initial.channel.body_template || initial.channel.sign_secret)} className="min-w-0">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium"><ChevronDown className="h-4 w-4" />{nm('advanced')}</summary>
                <div className="mt-4 min-w-0 space-y-4"><p className="text-xs text-muted-foreground">{nm('advanced_help')}</p>
                  {(ch.profile === 'dingtalk' || ch.profile === 'feishu') && <div className="space-y-2"><Label htmlFor="notice-sign-secret">{nm('secret')}</Label><Input id="notice-sign-secret" type="password" autoComplete="new-password" value={ch.sign_secret || ''} onChange={e => patchChannel({ sign_secret: e.target.value })} /><p className="text-xs text-muted-foreground">{nm('signing_help')}</p></div>}
                  <div className="space-y-2"><Label htmlFor="notice-body">{nm('body')}</Label><Textarea ref={bodyRef} id="notice-body" className="h-44 min-h-0 resize-none font-mono text-xs" spellCheck={false} value={body} onChange={e => setBody(e.target.value)} /></div>
                  <details><summary className="cursor-pointer text-xs text-muted-foreground">{nm('variables')}</summary><div className="mt-2 flex max-h-28 flex-wrap gap-1 overflow-y-auto p-1">{webhookVariables.map(variable => <Button key={variable} size="sm" variant="outline" className="h-7 font-mono text-xs" onClick={() => insertVariable(variable)}>{`{{${variable}}}`}</Button>)}</div></details>
                  <div className="space-y-2"><Label htmlFor="notice-headers">{nm('headers')}</Label><Textarea id="notice-headers" className="h-24 min-h-0 resize-none font-mono text-xs" spellCheck={false} value={headers} onChange={e => setHeaders(e.target.value)} /></div>
                </div>
              </details>
              <details><summary className="cursor-pointer text-xs text-muted-foreground">{nm('request_preview')}</summary><pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">{preview || nm('invalid_body')}</pre></details>
            </section>}
          </section>
          <section className="min-w-0 space-y-4" aria-label={nm('policies')}>
            <div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold">2. {nm('policies')}</h3><FeatureHelp title={nm('policies')} description={nm('historical') + '\n\n' + nm('legacy_help')} /></div>
            {draft.subscriptions.length > 1 && <p className="text-xs text-muted-foreground">{nm('historical')}</p>}
            {draft.subscriptions.map((policy, index) => <section key={index} className="min-w-0 rounded-lg border p-4" data-testid={`notice-policy-${index}`}>
              <div className="flex items-center justify-between gap-3"><button type="button" className="flex min-w-0 items-center gap-2 text-left text-sm font-medium" onClick={() => setActivePolicy(activePolicy === index ? -1 : index)} aria-expanded={activePolicy === index}><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${activePolicy === index ? '' : '-rotate-90'}`} /><span className="truncate">{policy.name || `${nm('policy')} ${index + 1}`}</span></button>
                <div className="flex shrink-0 items-center gap-2"><Switch aria-label={`${nm('policy')} ${index + 1} ${t('common.enabled')}`} checked={policy.enabled} onCheckedChange={enabled => policyPatch(index, { enabled })} />{draft.subscriptions.length > 1 && <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label={`${t('common.delete')} ${nm('policy')} ${index + 1}`} onClick={() => { setDraft(current => ({ ...current, subscriptions: current.subscriptions.filter((_, i) => i !== index) })); setActivePolicy(0); }}><Trash2 className="h-3.5 w-3.5" /></Button>}</div></div>
              {activePolicy === index && <div className="mt-4 min-w-0 space-y-4">
                {draft.mixed_delivery && <p className="text-xs text-amber-600">{nm('sender')}：{policy.sender?.delivery === 'selected' ? policy.sender.adapter_ids?.map(accountName).join('、') : nm('old_auto')}</p>}
                <div className="grid min-w-0 gap-4 sm:grid-cols-2"><div className="min-w-0 space-y-2"><Label htmlFor={`notice-source-${index}`}>{nm('source')}</Label><Select value={policy.source.mode} onValueChange={mode => policyPatch(index, { source: { ...policy.source, mode: mode as NoticeSubscription['source']['mode'] } })}><SelectTrigger id={`notice-source-${index}`}><SelectValue /></SelectTrigger><SelectContent>{(['all', 'platforms', 'accounts'] as const).map(mode => <SelectItem key={mode} value={mode}>{nm(mode)}</SelectItem>)}</SelectContent></Select></div>
                  <div className="min-w-0 space-y-2"><Label htmlFor={`notice-subscription-${index}`}>{nm('subscription')}</Label><Select value={policy.subscription === 'levels' && policy.level_mask === 15 && !levelEditing[index] ? 'all' : policy.subscription} onValueChange={mode => {
                    setLevelEditing(current => ({ ...current, [index]: mode === 'levels' }));
                    policyPatch(index, mode === 'all' ? { subscription: 'levels', level_mask: 15 } : { subscription: mode as NoticeSubscription['subscription'], events: mode === 'events' ? meta.catalog.filter(e => eventIsSelected({ ...policy, channels: [] }, e)).map(e => e.op) : policy.events });
                  }}><SelectTrigger id={`notice-subscription-${index}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{nm('all_events')}</SelectItem><SelectItem value="levels">{nm('levels')}</SelectItem><SelectItem value="events">{nm('events')}</SelectItem></SelectContent></Select></div></div>
                {policy.source.mode !== 'all' && <div className="grid gap-1 rounded-md border bg-muted/20 p-2 sm:grid-cols-2">{(policy.source.mode === 'platforms' ? platforms.map(p => ({ id: p, label: platformLabel(p) })) : meta.accounts.map(a => ({ id: a.id, label: accountName(a.id) }))).map(item => <CheckOption key={item.id} label={item.label} checked={(policy.source.mode === 'platforms' ? policy.source.platforms : policy.source.adapter_ids).includes(item.id)} onChange={() => policyPatch(index, { source: { ...policy.source, [policy.source.mode === 'platforms' ? 'platforms' : 'adapter_ids']: toggleSelection(policy.source.mode === 'platforms' ? policy.source.platforms : policy.source.adapter_ids, item.id) } })} />)}</div>}
                <CheckOption label={nm('system')} checked={policy.source.include_system} onChange={include_system => policyPatch(index, { source: { ...policy.source, include_system } })} />
                {policy.subscription === 'levels' ? (policy.level_mask !== 15 || levelEditing[index]) && <div className="grid grid-cols-2 gap-2 rounded-md border p-3">{[1, 2, 4, 8].map(area => <CheckOption key={area} label={t('noticeset.area_' + area)} checked={Boolean(policy.level_mask & area)} onChange={() => policyPatch(index, { level_mask: policy.level_mask ^ area })} />)}</div>
                  : <div className="space-y-4 rounded-md border p-3">{[1, 2, 4, 8].map(area => <div key={area} className="space-y-2"><p className="text-xs font-medium text-muted-foreground">{t('noticeset.area_' + area)}</p><div className="grid min-w-0 gap-1 sm:grid-cols-2">{meta.catalog.filter(event => event.area === area).map(event => <CheckOption key={event.op} label={t('noticeset.ev_' + event.op, { defaultValue: event.op })} checked={policy.events.includes(event.op)} onChange={() => policyPatch(index, { events: toggleSelection(policy.events, event.op) })} />)}</div></div>)}</div>}
                {(policy.subscription === 'events' ? !policy.events.length : !policy.level_mask) && <p className="text-xs text-amber-600">{nm('no_events')}</p>}
              </div>}
            </section>)}
            <Button variant="outline" size="sm" disabled={draft.subscriptions.length >= 128} onClick={() => { setActivePolicy(draft.subscriptions.length); setDraft(current => ({ ...current, subscriptions: [...current.subscriptions, emptyNoticeSubscription()] })); }}><Plus className="mr-2 h-4 w-4" />{nm('add_policy')}</Button>
          </section>
        </div>
      </DialogBody>
    </DialogContent>
  </Dialog>;
}
