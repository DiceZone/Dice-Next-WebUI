import React from 'react';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useTranslation } from 'react-i18next';
import { FeatureHelp } from '@/components/ui/feature-help';
import { Plus, Trash2, Loader2, Code2, List, Check, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDialogs } from '@/hooks/use-dialogs';
import { useToast } from '@/hooks/use-toast';
import { addDeckGroup, DECK_METADATA, editableEntries, parseDeckDocument, replaceDeckEntries } from '@/lib/deck-document';

export function DeckEditor({ filename, title, initialContent, initialGroup, onClose, onSaved }: {
  filename: string; title: string; initialContent: string; initialGroup?: string;
  onClose: () => void; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const dlg = useDialogs(t);
  const [content, setContent] = React.useState(initialContent);
  const [mode, setMode] = React.useState('visual');
  const [group, setGroup] = React.useState(initialGroup ?? '');
  const [page, setPage] = React.useState(1);
  const [saving, setSaving] = React.useState(false);
  const dirty = content !== initialContent;
  const parsed = React.useMemo(() => {
    try { return { document: parseDeckDocument(content), error: '' }; }
    catch (error) { return { document: null, error: (error as Error).message }; }
  }, [content]);
  const keys = Object.keys(parsed.document ?? {});
  const activeGroup = keys.includes(group) ? group : keys.find((key) => !DECK_METADATA.has(key)) ?? keys[0];
  const value = activeGroup === undefined ? undefined : parsed.document?.[activeGroup];
  const entries = editableEntries(value) ? value : null;
  const totalPages = Math.max(1, Math.ceil((entries?.length ?? 0) / 30));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * 30;

  useUnsavedChanges(dirty || saving, async () => !saving && await dlg.confirm({
    title: t('ui_refresh.discard'), description: t('ui_refresh.discard_hint'),
    cancelText: t('ui_refresh.keep_editing'), confirmText: t('ui_refresh.discard_edits'), destructive: true,
  }));

  const close = async () => {
    if (saving) return;
    if (dirty && !(await dlg.confirm({ title: t('ui_refresh.discard'), description: t('ui_refresh.discard_hint'), cancelText: t('ui_refresh.keep_editing'), confirmText: t('ui_refresh.discard_edits'), destructive: true }))) return;
    onClose();
  };
  const addGroup = async () => {
    const name = await dlg.prompt({ title: t('ui_refresh.add_group'), placeholder: t('ui_refresh.group_name') });
    if (name === null) return;
    try { setContent(addDeckGroup(content, name)); setGroup(name.trim()); setPage(1); }
    catch { toast({ title: t('ui_refresh.invalid_name'), variant: 'destructive' }); }
  };
  const update = (next: string[]) => {
    if (activeGroup !== undefined) setContent(replaceDeckEntries(content, activeGroup, next));
  };
  const save = async () => {
    if (!parsed.document || saving) return;
    setSaving(true);
    try {
      const response = await fetch('/api/decks/file', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename, content }) });
      const result = await response.json();
      if (!response.ok || result.code !== 0) throw new Error(result.message || t('common.save_fail'));
      // PUT writes the file but the backend's incremental load leaves removed
      // groups alive. Explicitly rescan both bundled and user decks after edits.
      try {
        const reload = await fetch('/api/decks/reload', { method: 'POST' });
        const result = await reload.json();
        if (!reload.ok || result.code !== 0) throw new Error('reload');
        toast({ title: t('decks.saved') });
      } catch { toast({ title: t('ui_refresh.reload_failed'), variant: 'destructive' }); }
      onSaved();
    } catch (error) { toast({ title: t('common.save_fail'), description: (error as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return <>
    <Dialog open onOpenChange={(open) => { if (!open) void close(); }}>
      <DialogContent className="flex max-h-[90dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader className="shrink-0 border-b px-5 py-5 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-1.5 pr-8">{t('decks.edit_title', { title })}
            <FeatureHelp title={t('decks.edit_title', { title })} description={<p>{t('ui_refresh.edit_hint')}</p>} />
          </DialogTitle>
          <DialogDescription className="break-all">{filename}</DialogDescription>
        </DialogHeader>
        <div aria-busy={saving} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Tabs value={mode} onValueChange={setMode} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b bg-muted/20 px-5 py-3">
            <TabsList><TabsTrigger value="visual" disabled={saving}><List className="mr-2 h-4 w-4" />{t('ui_refresh.visual')}</TabsTrigger><TabsTrigger value="source" disabled={saving}><Code2 className="mr-2 h-4 w-4" />{t('ui_refresh.source')}</TabsTrigger></TabsList>
          </div>
          {parsed.error && <div role="alert" className="flex gap-2 border-b bg-destructive/5 px-5 py-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" /><span>{t('ui_refresh.invalid_json')}：{parsed.error === 'invalid_deck' ? t('ui_refresh.invalid_deck') : parsed.error}</span></div>}
          <TabsContent value={mode} className="mt-0 flex min-h-0 flex-1 flex-col">
          {mode === 'source' ? <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{parsed.error ? '' : t('ui_refresh.valid')}</span><Button variant="outline" size="sm" disabled={saving || !parsed.document} onClick={() => setContent(JSON.stringify(parsed.document, null, 2))}>{t('ui_refresh.format')}</Button></div>
            <Textarea disabled={saving} aria-label={t('ui_refresh.source')} value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} className="min-h-[20dvh] flex-1 resize-none bg-muted/20 font-mono text-xs leading-relaxed" />
          </div> : <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-5 py-3">
              <Select value={activeGroup} onValueChange={(name) => { setGroup(name); setPage(1); }} disabled={saving || !parsed.document || keys.length === 0}>
                <SelectTrigger className="min-w-0 flex-1" aria-label={t('ui_refresh.group_name')}><SelectValue placeholder={t('ui_refresh.choose_group')} /></SelectTrigger>
                <SelectContent>{keys.filter(Boolean).map((key) => <SelectItem key={key} value={key}>{key}{DECK_METADATA.has(key) ? ` · ${t('ui_refresh.metadata')}` : ''}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => void addGroup()} disabled={saving || !parsed.document}><Plus className="mr-1.5 h-4 w-4" />{t('ui_refresh.add_group')}</Button>
            </div>
            <div className="min-h-0 overflow-y-auto bg-muted/15 p-5">
              {entries ? <div className="space-y-3">
                {entries.slice(offset, offset + 30).map((entry, index) => <div key={offset + index} className="flex items-start gap-2 rounded-lg border bg-card p-3 shadow-sm">
                  <span className="w-6 shrink-0 pt-2 text-right font-mono text-xs text-muted-foreground">{offset + index + 1}</span>
                  <Textarea disabled={saving} aria-label={t('ui_refresh.entry_label', { number: offset + index + 1 })} rows={2} className="min-h-16 resize-y border-transparent bg-transparent shadow-none focus-visible:border-input" value={entry}
                    onChange={(event) => update(entries.map((item, i) => i === offset + index ? event.target.value : item))} />
                  <Button disabled={saving} size="icon" variant="ghost" aria-label={t('ui_refresh.remove_entry', { number: offset + index + 1 })} className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => update(entries.filter((_, i) => i !== offset + index))}><Trash2 className="h-4 w-4" /></Button>
                </div>)}
                {!entries.length && <p className="py-6 text-center text-sm text-muted-foreground">{t('ui_refresh.empty_group')}</p>}
                <Button disabled={saving} variant="outline" className="w-full border-dashed" onClick={() => { update([...entries, '']); setPage(Math.ceil((entries.length + 1) / 30)); }}><Plus className="mr-2 h-4 w-4" />{t('ui_refresh.add_entry')}</Button>
                {totalPages > 1 && <div className="flex items-center justify-center gap-3"><Button size="sm" variant="ghost" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>{t('ui_refresh.previous')}</Button><span className="text-xs">{t('ui_refresh.page', { page: currentPage, total: totalPages })}</span><Button size="sm" variant="ghost" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>{t('ui_refresh.next')}</Button></div>}
              </div> : <p className="py-8 text-center text-sm text-muted-foreground">{t(parsed.document && keys.length ? 'ui_refresh.source_only' : 'ui_refresh.choose_group')}</p>}
            </div>
          </div>}
          </TabsContent>
          </Tabs>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-background px-5 py-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" />{dirty ? t('ui_refresh.unsaved') : t('ui_refresh.valid')}</span>
          <div className="flex gap-2"><Button variant="outline" onClick={() => void close()} disabled={saving}>{t('common.cancel')}</Button><Button onClick={() => void save()} disabled={saving || !dirty || !parsed.document}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('common.save')}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
    {dlg.node}
  </>;
}
