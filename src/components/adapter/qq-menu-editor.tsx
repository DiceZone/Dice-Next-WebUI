import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, ExternalLink, ListTree, Plus, RefreshCw, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { HelpLabel } from '@/components/ui/help-label';
import { useDialogs } from '@/hooks/use-dialogs';
import { useToast } from '@/hooks/use-toast';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { qqOfficialAction } from '@/lib/qq-official-actions';
import { createRequestGate } from '@/lib/request-gate';
import { changeMenuType, fingerprint, menuBody, moveItem, newMenuItem, readMenu, qqTextWidth, validateMenu, type MenuDraft, type MenuItemDraft } from '@/lib/qq-official-editor';
import { EditorError, EditorIssues, EditorPreview, EditorSelect, ItemActions, errorMessage } from './qq-editor-shared';

function MenuRow({ item, index, count, child = false, disabled, onChange, onMove, onRemove, confirm }: {
  item: MenuItemDraft; index: number; count: number; child?: boolean; disabled: boolean;
  onChange: (item: MenuItemDraft) => void; onMove: (delta: -1 | 1) => void; onRemove: () => void;
  confirm: ReturnType<typeof useDialogs>['confirm'];
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(!item.name || index === 0);
  const types = child ? ['send_message', 'link'] : ['send_message', 'link', 'menu', 'switch'];
  const typeLabel = (type: string) => t(`qq_editor.${type === 'menu' ? 'submenu' : type}`);
  const patch = (changes: Partial<MenuItemDraft>) => onChange({ ...item, ...changes });
  const children = (next: MenuItemDraft[]) => patch({ children: next });
  return <section className="min-w-0 rounded-lg border bg-card">
    <div className="flex items-center gap-2 px-3 py-2">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <span className="truncate">{t('qq_editor.item', { index: index + 1 })}{item.name ? ` · ${item.name}` : ''}</span>
      </button>
      <ItemActions index={index} count={count} disabled={disabled} onMove={onMove} onRemove={onRemove} />
    </div>
    {expanded && <div className="space-y-4 border-t p-3 sm:p-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor={`${item.key}-name`}>{t('qq_editor.name')} <span className="text-xs text-muted-foreground">{qqTextWidth(item.name)}/{child ? 14 : 10}</span></Label>
          <Input id={`${item.key}-name`} value={item.name} disabled={disabled} onChange={(event) => patch({ name: event.target.value })} /></div>
        <EditorSelect label={t('qq_editor.type')} value={item.type} disabled={disabled}
          options={[...types.map((value) => ({ value, label: typeLabel(value) })), ...(!types.includes(item.type) ? [{ value: item.type || 'unknown', label: t('qq_editor.unknown') }] : [])]}
          onChange={async (type) => {
            if (item.children.length && type !== 'menu' && !await confirm({ title: t('qq_editor.type_confirm'), destructive: true })) return;
            onChange(changeMenuType(item, type));
          }} />
      </div>
      {item.type === 'send_message' && <div className="space-y-1.5"><Label htmlFor={`${item.key}-message`}>{t('qq_editor.message')}</Label>
        <Textarea id={`${item.key}-message`} value={item.message} disabled={disabled} onChange={(event) => patch({ message: event.target.value })} placeholder=".help" rows={2} /></div>}
      {item.type === 'link' && <div className="space-y-1.5"><Label htmlFor={`${item.key}-link`}>{t('qq_editor.link')}</Label>
        <Input id={`${item.key}-link`} value={item.link} disabled={disabled} onChange={(event) => patch({ link: event.target.value })} placeholder="https://" /></div>}
      {item.type === 'switch' && <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><HelpLabel title={t('qq_editor.switch_id')} htmlFor={`${item.key}-switch`} description={t('qq_editor.switch_help')} />
          <Input id={`${item.key}-switch`} value={item.switchId} disabled={disabled} onChange={(event) => patch({ switchId: event.target.value })} placeholder="search" /></div>
        <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"><Label htmlFor={`${item.key}-default`}>{t('qq_editor.default_on')}</Label>
          <Switch id={`${item.key}-default`} checked={item.switchDefault} disabled={disabled} onCheckedChange={(value) => patch({ switchDefault: value })} /></div>
      </div>}
      {item.type === 'menu' && <div className="space-y-2 rounded-lg bg-muted/30 p-2 sm:p-3">
        {item.children.map((entry, position) => <MenuRow key={entry.key} item={entry} index={position} count={item.children.length} child disabled={disabled} confirm={confirm}
          onChange={(next) => children(item.children.map((value, i) => i === position ? next : value))}
          onMove={(delta) => children(moveItem(item.children, position, delta))}
          onRemove={async () => { if (await confirm({ title: t('qq_editor.remove_confirm'), destructive: true })) children(item.children.filter((_, i) => i !== position)); }} />)}
        <Button variant="outline" size="sm" disabled={disabled || item.children.length >= 5} onClick={() => children([...item.children, newMenuItem()])}><Plus className="mr-2 h-4 w-4" />{t('qq_editor.add_child')} ({item.children.length}/5)</Button>
      </div>}
    </div>}
  </section>;
}
export function QQMenuEditor({ adapterId, accountName, connected, onBusy }: { adapterId: string; accountName: string; connected: boolean; onBusy: (value: boolean) => void }) {
  const { t } = useTranslation(), toast = useToast(), dlg = useDialogs(t);
  const [draft, setDraft] = useState<MenuDraft | null>(null), [baseline, setBaseline] = useState<MenuDraft | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const gate = useRef(createRequestGate());
  const operation = useRef(false);
  const dirty = !!draft && !!baseline && fingerprint(menuBody(draft)) !== fingerprint(menuBody(baseline));
  const issues = draft ? validateMenu(draft) : [];
  useEffect(() => { onBusy(busy); }, [busy, onBusy]);
  useUnsavedChanges(dirty || busy, async () => !operation.current && (!dirty || await dlg.confirm({ title: t('qq_editor.discard_title'), description: t('qq_editor.discard_desc'), confirmText: t('qq_editor.discard_action'), cancelText: t('qq_editor.keep_editing') })));
  const load = async () => {
    if (operation.current || !connected) return;
    if (dirty && !await dlg.confirm({ title: t('qq_editor.discard_title'), description: t('qq_editor.discard_desc'), confirmText: t('qq_editor.discard_action'), cancelText: t('qq_editor.keep_editing') })) return;
    if (operation.current) return;
    operation.current = true; const current = gate.current.start(); setBusy(true); setError('');
    try { const next = readMenu(await qqOfficialAction(adapterId, 'qq_get_menu')); if (current()) { setDraft(next); setBaseline(next); } }
    catch (failure) { if (current()) setError(errorMessage(failure, t)); }
    finally { if (current()) { operation.current = false; setBusy(false); } }
  };
  useEffect(() => () => { operation.current = false; gate.current.invalidate(); }, []);
  useEffect(() => { if (connected && !draft && !busy) void load(); }, [adapterId, connected]); // Never replace an existing draft on reconnect.
  const publish = async () => {
    if (!draft || !baseline || operation.current || !connected || issues.length) return;
    if (!await dlg.confirm({ title: t('qq_editor.publish_confirm'), description: t('qq_editor.publish_desc', { account: accountName }), destructive: draft.items.length === 0, confirmText: t('qq_editor.publish') })) return;
    if (operation.current) return;
    operation.current = true; const current = gate.current.start(); setBusy(true); setError('');
    try {
      const latest = readMenu(await qqOfficialAction(adapterId, 'qq_get_menu'));
      if (!current()) return;
      if (fingerprint(menuBody(latest)) !== fingerprint(menuBody(baseline)) || (baseline.version !== undefined && latest.version !== baseline.version)) throw new Error('conflict');
      const result = await qqOfficialAction(adapterId, 'qq_set_menu', { body: menuBody(draft) });
      if (!current()) return;
      const response = result as { version?: number };
      const saved = { ...draft, version: typeof response?.version === 'number' ? response.version : undefined };
      setDraft(saved); setBaseline(saved); toast({ title: t('qq_editor.published') });
    } catch (failure) { if (current()) setError(`${errorMessage(failure, t)}\n${t('qq_editor.uncertain')}`); }
    finally { if (current()) { operation.current = false; setBusy(false); } }
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2"><HelpLabel title={t('qq_editor.menu')} description={t('qq_editor.menu_help')} labelClassName="text-base font-semibold" />
        {draft?.version !== undefined && <Badge variant="outline">{t('qq_editor.version', { version: draft.version })}</Badge>}{dirty && <Badge variant="warning">{t('qq_editor.dirty')}</Badge>}</div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={busy || !connected}><RefreshCw className="mr-2 h-4 w-4" />{t('qq_editor.load')}</Button>
        <Button onClick={() => void publish()} disabled={busy || !connected || !draft || !dirty || issues.length > 0}><Save className="mr-2 h-4 w-4" />{t('qq_editor.publish')}</Button></div>
    </div>
    <EditorError error={error} />
    {busy && !draft && <div className="h-32 animate-pulse rounded-xl bg-muted" />}
    {draft && <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-3">
        {!draft.items.length && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><ListTree className="mx-auto mb-2 h-7 w-7" />{t('qq_editor.empty_menu')}</div>}
        {draft.items.map((item, index) => <MenuRow key={item.key} item={item} index={index} count={draft.items.length} disabled={busy} confirm={dlg.confirm}
          onChange={(next) => setDraft({ ...draft, items: draft.items.map((value, position) => position === index ? next : value) })}
          onMove={(delta) => setDraft({ ...draft, items: moveItem(draft.items, index, delta) })}
          onRemove={async () => { if (await dlg.confirm({ title: t('qq_editor.remove_confirm'), destructive: true })) setDraft({ ...draft, items: draft.items.filter((_, position) => position !== index) }); }} />)}
        <Button variant="outline" disabled={busy || draft.items.length >= 10} onClick={() => setDraft({ ...draft, items: [...draft.items, newMenuItem()] })}><Plus className="mr-2 h-4 w-4" />{t('qq_editor.add_item')} ({draft.items.length}/10)</Button>
        <EditorIssues issues={issues} />
      </div>
      <EditorPreview payload={menuBody(draft)}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {draft.items.map((item) => <div key={item.key} className="min-w-0 rounded-lg border bg-background p-3 text-sm">
            <div className="flex items-center justify-between gap-2 font-medium"><span className="truncate">{item.name || '—'}</span>{item.type === 'link' && <ExternalLink className="h-4 w-4 shrink-0" />}{item.type === 'switch' && <Switch checked={item.switchDefault} disabled aria-label={item.name || t('qq_editor.switch')} />}</div>
            {item.type === 'menu' ? <div className="mt-2 space-y-1 border-l pl-3">{item.children.map((child) => <p key={child.key} className="truncate text-muted-foreground">{child.name || '—'}</p>)}</div>
              : <p className="mt-1 truncate text-xs text-muted-foreground">{item.type === 'link' ? item.link : item.type === 'switch' ? `${item.switchId}=${item.switchDefault ? 1 : 0}` : item.message}</p>}
          </div>)}
        </div>
      </EditorPreview>
    </div>}
    {dlg.node}
  </div>;
}
