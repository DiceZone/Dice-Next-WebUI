import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Link2, MoreHorizontal, Pencil, Plus, RefreshCw, Save, Shield, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { HelpLabel } from '@/components/ui/help-label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDialogs } from '@/hooks/use-dialogs';
import { useToast } from '@/hooks/use-toast';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { qqOfficialAction } from '@/lib/qq-official-actions';
import { createRequestGate } from '@/lib/request-gate';
import { QQ_SCOPES, fingerprint, moveItem, newPanel, newPanelItem, panelBody, parseTargets, platformData, qqTextWidth, readPanel, readPanelList, targetBody, validatePanel, type PanelDraft, type QQScope } from '@/lib/qq-official-editor';
import { CollapsibleEditorItem, EditorError, EditorIssues, EditorPreview, EditorSelect, ItemActions, errorMessage } from './qq-editor-shared';

export function QQPanelEditor({ adapterId, accountName, connected, onBusy }: { adapterId: string; accountName: string; connected: boolean; onBusy: (value: boolean) => void }) {
  const { t } = useTranslation(), toast = useToast(), dlg = useDialogs(t);
  const [scope, setScope] = useState<QQScope>('c2c'), [records, setRecords] = useState<PanelDraft[]>([]), [nextCursor, setNextCursor] = useState('');
  const [draft, setDraft] = useState<PanelDraft | null>(null), [baseline, setBaseline] = useState<PanelDraft | null>(null), [createTargets, setCreateTargets] = useState('');
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [targetPanel, setTargetPanel] = useState<PanelDraft | null>(null), [targetText, setTargetText] = useState(''), [targetOp, setTargetOp] = useState<'add' | 'del'>('add');
  const gate = useRef(createRequestGate()), operation = useRef(false), cursors = useRef(new Set<string>());
  const dirty = !!draft && (!baseline || fingerprint(panelBody(draft)) !== fingerprint(panelBody(baseline)));
  const issues = draft ? validatePanel(draft) : [];
  const pendingTargets = parseTargets(targetText);
  useEffect(() => { onBusy(!!busy); }, [busy, onBusy]);
  useEffect(() => () => { operation.current = false; gate.current.invalidate(); }, []);
  const discard = () => dlg.confirm({ title: t('qq_editor.discard_title'), description: t('qq_editor.discard_desc'), confirmText: t('qq_editor.discard_action'), cancelText: t('qq_editor.keep_editing') });
  useUnsavedChanges(dirty || !!targetText.trim() || !!busy, async () => !operation.current && (!dirty && !targetText.trim() || await discard()));

  const work = async (kind: string, fn: (current: () => boolean) => Promise<void>) => {
    if (operation.current || !connected) return;
    operation.current = true; const current = gate.current.capture(); setBusy(kind); setError('');
    try { await fn(current); }
    catch (failure) { if (current()) setError(errorMessage(failure, t) + (['save', 'delete', 'targets'].includes(kind) ? `\n${t('qq_editor.uncertain')}` : '')); }
    finally { if (current()) { operation.current = false; setBusy(''); } }
  };
  const loadList = (append = false) => work('list', async (current) => {
    const cursor = append ? nextCursor : '';
    const page = readPanelList(await qqOfficialAction(adapterId, 'qq_list_panels', { scope, limit: 20, ...(cursor ? { cursor } : {}) }));
    if (!current()) return;
    if (page.records.some((record) => record.scope !== scope) || (page.next && (page.next === cursor || (append && cursors.current.has(page.next))))) throw new Error('invalid_response');
    if (!append) cursors.current.clear();
    if (cursor) cursors.current.add(cursor);
    setRecords((previous) => [...new Map([...(append ? previous : []), ...page.records].map((record) => [record.id, record])).values()]); setNextCursor(page.next);
  });
  useEffect(() => { if (connected) void loadList(); }, [adapterId, scope, connected]);
  const replaceRecord = (saved: PanelDraft) => setRecords((previous) => [saved, ...previous.filter((record) => record.id !== saved.id)]);
  const openEditor = async (record?: PanelDraft) => {
    if (dirty && !await discard()) return;
    if (!record) { setDraft(newPanel(scope)); setBaseline(null); setCreateTargets(''); setError(''); return; }
    await work('detail', async (current) => {
      const detail = readPanel(await qqOfficialAction(adapterId, 'qq_get_panel', { panelId: record.id }));
      if (!current()) return;
      if (detail.id !== record.id || detail.scope !== scope) throw new Error('invalid_response');
      setDraft(detail); setBaseline(detail); setCreateTargets(''); replaceRecord(detail);
    });
  };
  const publish = async () => {
    if (!draft || issues.length || operation.current || !connected) return;
    if (!await dlg.confirm({ title: t('qq_editor.save_panel_title'), description: t('qq_editor.save_panel_desc', { account: accountName }), confirmText: t('qq_editor.publish') })) return;
    await work('save', async (current) => {
      if (draft.id) {
        const latest = readPanel(await qqOfficialAction(adapterId, 'qq_get_panel', { panelId: draft.id }));
        if (!current()) return;
        if (!baseline || latest.id !== draft.id || latest.scope !== draft.scope || latest.targetType !== draft.targetType
          || fingerprint(panelBody(latest, false)) !== fingerprint(panelBody(baseline, false)) || (baseline.version !== undefined && latest.version !== baseline.version)) throw new Error('conflict');
      }
      const result = platformData(await qqOfficialAction(adapterId, draft.id ? 'qq_update_panel' : 'qq_create_panel', { ...(draft.id ? { panelId: draft.id } : {}), body: panelBody(draft) }));
      if (!current()) return;
      const id = draft.id || (typeof result.panel_id === 'string' ? result.panel_id : '');
      if (!id) throw new Error('invalid_response'); // Never silently retry an ambiguous creation.
      const saved = { ...draft, id, version: typeof result.version === 'number' ? result.version : undefined };
      setDraft(saved); setBaseline(saved); replaceRecord(saved); toast({ title: t('qq_editor.published') });
    });
  };
  const deletePanel = async (record: PanelDraft) => {
    if (!await dlg.confirm({ title: t('qq_editor.delete_panel_title'), description: t('qq_editor.delete_panel_desc', { id: record.id }), destructive: true, confirmText: t('common.delete') })) return;
    await work('delete', async (current) => {
      await qqOfficialAction(adapterId, 'qq_delete_panel', { panelId: record.id }); if (!current()) return;
      setRecords((previous) => previous.filter((item) => item.id !== record.id));
      if (draft?.id === record.id) { setDraft(null); setBaseline(null); }
      toast({ title: t('qq_editor.deleted') });
    });
  };
  const openTargets = (record: PanelDraft) => work('detail', async (current) => {
    const detail = readPanel(await qqOfficialAction(adapterId, 'qq_get_panel', { panelId: record.id }));
    if (!current()) return;
    if (detail.id !== record.id || detail.targetType !== 'specific' || !['c2c', 'group'].includes(detail.scope)) throw new Error('invalid_targets');
    setTargetPanel(detail); setTargetText(''); setTargetOp('add'); replaceRecord(detail);
  });
  const updateTargets = async () => {
    if (!targetPanel || operation.current) return;
    let params;
    try { params = targetBody(targetPanel, targetOp, pendingTargets); } catch (failure) { setError(errorMessage(failure, t)); return; }
    if (!await dlg.confirm({ title: t('qq_editor.targets_confirm', { operation: t(`qq_editor.${targetOp === 'add' ? 'add_targets' : 'del_targets'}`), count: pendingTargets.length }), description: `${accountName} · ${targetPanel.id}`, destructive: targetOp === 'del' })) return;
    await work('targets', async (current) => {
      await qqOfficialAction(adapterId, 'qq_panel_target', params); if (!current()) return;
      setTargetText(''); toast({ title: t('qq_editor.targets_saved') });
      // Association change succeeded. A failed follow-up read is not a failed
      // write; keep the modal and show a readable error rather than resubmit.
      const detail = readPanel(await qqOfficialAction(adapterId, 'qq_get_panel', { panelId: targetPanel.id }));
      if (!current()) return;
      if (detail.id !== targetPanel.id) throw new Error('invalid_response');
      setTargetPanel(detail); replaceRecord(detail);
      if (draft?.id === detail.id && !dirty) { setDraft(detail); setBaseline(detail); }
    });
  };
  const closeTargets = async () => {
    if (operation.current || (targetText.trim() && !await discard())) return;
    setTargetPanel(null); setTargetText(''); setError('');
  };
  const patch = (changes: Partial<PanelDraft>) => { if (draft) setDraft({ ...draft, ...changes }); };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-2"><HelpLabel title={t('qq_editor.panels')} description={t('qq_editor.panel_help')} labelClassName="text-base font-semibold" />
        <EditorSelect label={t('qq_editor.scope')} value={scope} disabled={!!busy} options={QQ_SCOPES.map((value) => ({ value, label: t(`qq_editor.${value}`) }))}
          onChange={async (value) => {
            if (dirty && !await discard()) return;
            setDraft(null); setBaseline(null); setRecords([]); setNextCursor(''); setScope(value as QQScope);
          }} /></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!!busy || !connected} onClick={() => void loadList()}><RefreshCw className="mr-2 h-4 w-4" />{t('qq_editor.load')}</Button>
        <Button disabled={!!busy || !connected} onClick={() => void openEditor()}><Plus className="mr-2 h-4 w-4" />{t('qq_editor.create_panel')}</Button></div>
    </div>
    <EditorError error={targetPanel ? '' : error} />
    <div className="grid min-w-0 gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-2">
        {records.map((record) => <section key={record.id} className={`min-w-0 rounded-lg border p-3 ${draft?.id === record.id ? 'border-primary/50 bg-primary/5' : 'bg-card'}`}>
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{record.remark || record.items[0]?.name || record.id}</p><p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{record.id}</p></div>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={!!busy} aria-label={t('common.more')}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end"><DropdownMenuItem disabled={!!busy || dirty || record.targetType !== 'specific' || !['c2c', 'group'].includes(record.scope)} onClick={() => void openTargets(record)}><Link2 className="mr-2 h-4 w-4" />{t('qq_editor.manage_targets')}</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" disabled={!!busy} onClick={() => void deletePanel(record)}><Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}</DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu></div>
          <div className="mt-3 flex items-center justify-between gap-2"><Badge variant="outline">{t(`qq_editor.${record.targetType}`)} · {record.items.length}/20</Badge>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void openEditor(record)}><Pencil className="mr-1 h-3.5 w-3.5" />{t('common.edit')}</Button></div>
        </section>)}
        {!records.length && <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">{busy === 'list' ? t('common.loading') : t('qq_editor.no_panels')}</div>}
        {nextCursor && <Button className="w-full" variant="outline" disabled={!!busy} onClick={() => void loadList(true)}>{t('qq_editor.more')}</Button>}
      </aside>
      {draft ? <div className="min-w-0 space-y-4 rounded-xl border p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{t(`qq_editor.${draft.id ? 'edit_panel' : 'create_panel'}`)}</h3>{dirty && <Badge variant="warning">{t('qq_editor.dirty')}</Badge>}{draft.version !== undefined && <Badge variant="outline">{t('qq_editor.version', { version: draft.version })}</Badge>}</div>
          <div className="flex flex-wrap gap-2"><Button size="sm" disabled={!!busy || !connected || !dirty || issues.length > 0} onClick={() => void publish()}><Save className="mr-2 h-4 w-4" />{t('qq_editor.publish')}</Button>
          <Button variant="ghost" size="sm" disabled={!!busy} onClick={async () => { if (!dirty || await discard()) { setDraft(null); setBaseline(null); } }}>{t('qq_editor.close_editor')}</Button></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>{t('qq_editor.scope')}</Label><div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{t(`qq_editor.${draft.scope}`)}</div></div>
          <EditorSelect label={t('qq_editor.range')} value={draft.targetType} disabled={!!busy || !!draft.id || !['c2c', 'group'].includes(draft.scope)}
            options={['all', 'specific'].map((value) => ({ value, label: t(`qq_editor.${value}`) }))} onChange={(value) => patch({ targetType: value as 'all' | 'specific' })} /></div>
        <div className="space-y-1.5"><HelpLabel title={t('qq_editor.remark')} htmlFor="qq-panel-remark" description={t('qq_editor.remark_help')} /><Input id="qq-panel-remark" value={draft.remark} disabled={!!busy} onChange={(event) => patch({ remark: event.target.value })} /></div>
        {!draft.id && draft.targetType === 'specific' && <div className="space-y-1.5"><HelpLabel title={t('qq_editor.targets')} htmlFor="qq-create-targets" description={t('qq_editor.targets_help')} />
          <Textarea id="qq-create-targets" rows={3} value={createTargets} disabled={!!busy} onChange={(event) => { setCreateTargets(event.target.value); patch({ targets: parseTargets(event.target.value) }); }} /></div>}
        {draft.id && draft.targetType === 'specific' && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3"><span className="text-sm">{t('qq_editor.associated', { count: draft.targets.length })}</span>
          <Button variant="outline" size="sm" disabled={!!busy || dirty} onClick={() => void openTargets(draft)}><Link2 className="mr-2 h-4 w-4" />{t('qq_editor.manage_targets')}</Button></div>}
        <div className="space-y-3">
          {draft.items.map((item, index) => <CollapsibleEditorItem key={item.key} defaultOpen={index === 0 || !item.name}
            title={`${t('qq_editor.item', { index: index + 1 })}${item.name ? ` · ${item.name}` : ''}`} actions={<ItemActions index={index} count={draft.items.length} disabled={!!busy}
              onMove={(delta) => patch({ items: moveItem(draft.items, index, delta) })}
              onRemove={async () => { if (await dlg.confirm({ title: t('qq_editor.remove_confirm'), destructive: true })) patch({ items: draft.items.filter((_, position) => position !== index) }); }} />}>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor={`${item.key}-name`}>{t(`qq_editor.${item.type === 'command' ? 'command_name' : 'name'}`)} <span className="text-xs text-muted-foreground">{qqTextWidth(item.name)}/14</span></Label>
              <Input id={`${item.key}-name`} value={item.name} disabled={!!busy} onChange={(event) => patch({ items: draft.items.map((value, position) => position === index ? { ...value, name: event.target.value } : value) })} placeholder={item.type === 'command' ? '.help' : ''} /></div>
              <EditorSelect label={t('qq_editor.type')} value={item.type} disabled={!!busy} options={[...['command', 'link'].map((value) => ({ value, label: t(`qq_editor.${value}`) })), ...(!['command', 'link'].includes(item.type) ? [{ value: item.type || 'unknown', label: t('qq_editor.unknown') }] : [])]}
                onChange={(type) => patch({ items: draft.items.map((value, position) => position === index ? { ...value, type } : value) })} /></div>
            <div className="space-y-1.5"><Label htmlFor={`${item.key}-desc`}>{t('qq_editor.desc')} <span className="text-xs text-muted-foreground">{qqTextWidth(item.desc)}/30</span></Label>
              <Input id={`${item.key}-desc`} value={item.desc} disabled={!!busy} onChange={(event) => patch({ items: draft.items.map((value, position) => position === index ? { ...value, desc: event.target.value } : value) })} /></div>
            {item.type === 'link' && <div className="space-y-1.5"><Label htmlFor={`${item.key}-link`}>{t('qq_editor.link')}</Label><Input id={`${item.key}-link`} value={item.link} disabled={!!busy} placeholder="https://"
              onChange={(event) => patch({ items: draft.items.map((value, position) => position === index ? { ...value, link: event.target.value } : value) })} /></div>}
            <div className="flex items-center justify-between gap-2"><Label htmlFor={`${item.key}-admin`}>{t('qq_editor.only_admin')}</Label><Switch id={`${item.key}-admin`} checked={item.onlyAdmin} disabled={!!busy}
              onCheckedChange={(onlyAdmin) => patch({ items: draft.items.map((value, position) => position === index ? { ...value, onlyAdmin } : value) })} /></div>
          </CollapsibleEditorItem>)}
          <Button variant="outline" disabled={!!busy || draft.items.length >= 20} onClick={() => patch({ items: [...draft.items, newPanelItem()] })}><Plus className="mr-2 h-4 w-4" />{t('qq_editor.add_item')} ({draft.items.length}/20)</Button>
        </div>
        <EditorIssues issues={issues} />
        <EditorPreview payload={panelBody(draft)}>
          {!draft.items.length && <p className="text-sm text-muted-foreground">{t('qq_editor.empty_panel')}</p>}
          <div className="grid gap-2 sm:grid-cols-2">{draft.items.map((item) => <div key={item.key} className="min-w-0 space-y-1 rounded-lg border bg-background p-3">
            <div className="flex items-center gap-2 text-sm font-medium"><span className="min-w-0 flex-1 truncate">{item.name || '—'}</span>{item.onlyAdmin && <Shield className="h-3.5 w-3.5 shrink-0" aria-label={t('qq_editor.only_admin')} />}{item.type === 'link' && <ExternalLink className="h-3.5 w-3.5 shrink-0" />}</div>
            <p className="break-words text-xs text-muted-foreground">{item.desc}</p></div>)}</div>
        </EditorPreview>
      </div> : <div className="flex min-h-52 items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t('qq_editor.create_panel')} / {t('qq_editor.edit_panel')}</div>}
    </div>
    <Dialog open={!!targetPanel} onOpenChange={(open) => { if (!open) void closeTargets(); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{t('qq_editor.manage_targets')}</DialogTitle><DialogDescription>{accountName} · {targetPanel?.id}</DialogDescription></DialogHeader>
        <EditorError error={error} />
        <div className="space-y-2"><Label>{t('qq_editor.associated', { count: targetPanel?.targets.length ?? 0 })}</Label><Textarea readOnly rows={4} value={targetPanel?.targets.join('\n') ?? ''} aria-label={t('qq_editor.targets')} className="font-mono text-xs" /></div>
        <EditorSelect label={t('qq_editor.target_op')} value={targetOp} disabled={!!busy} options={['add', 'del'].map((value) => ({ value, label: t(`qq_editor.${value === 'add' ? 'add_targets' : 'del_targets'}`) }))} onChange={(value) => setTargetOp(value as 'add' | 'del')} />
        <div className="space-y-1.5"><HelpLabel title={t('qq_editor.targets')} htmlFor="qq-target-input" description={t('qq_editor.targets_help')} /><Textarea id="qq-target-input" rows={4} value={targetText} disabled={!!busy} onChange={(event) => setTargetText(event.target.value)} /></div>
        <p className={`text-xs ${pendingTargets.length > 20 ? 'text-destructive' : 'text-muted-foreground'}`}>{pendingTargets.length}/20</p>
        <DialogFooter className="gap-2"><Button variant="outline" disabled={!!busy} onClick={() => void closeTargets()}>{t('common.close')}</Button><Button disabled={!!busy || pendingTargets.length < 1 || pendingTargets.length > 20} variant={targetOp === 'del' ? 'destructive' : 'default'} onClick={() => void updateTargets()}>{t(`qq_editor.${targetOp === 'add' ? 'add_targets' : 'del_targets'}`)}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    {dlg.node}
  </div>;
}
