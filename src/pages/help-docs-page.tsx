import { useTourActive, useTourState } from '@/components/onboarding/tour-data';
import { tourSamples } from '@/lib/tour-samples';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { parseHelpImport, validHelpName } from '@/lib/help-document';
import { HelpCircle, Plus, Pencil, RotateCcw, Trash2, RefreshCw, Search, Download, Upload, FileText, Lock } from 'lucide-react';

interface HelpEntry { key: string; content: string; source: string; i18nKey?: string; editable: boolean; shadowed?: boolean; }
interface EditState { mode: 'new' | 'file' | 'builtin'; name: string; content: string; initial: string; i18nKey?: string; }
const PAGE_SIZE = 30;
const entryId = (entry: HelpEntry) => JSON.stringify([entry.source, entry.key]);
const canEdit = (entry: HelpEntry) => entry.editable && (entry.source.startsWith('file:') || (entry.source === 'builtin' && !!entry.i18nKey));

async function request(path: string, method = 'GET', body?: unknown, signal?: AbortSignal) {
  const res = await fetch('/api' + path, { method, signal, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok || json.code !== 0) throw new Error(json.message || `HTTP ${res.status}`);
  return json.data;
}
function download(name: string, content: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const HelpDocsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const dlg = useDialogs(t);
  const tour = useTourActive();
  const [entries, setEntries] = useTourState<HelpEntry[]>([], tourSamples.helpEntries);
  const [groups, setGroups] = useTourState<{ source: string; count: number }[]>([], [{ source: 'builtin', count: 3 }]);
  const [total, setTotal] = useTourState(0, 3);
  const [page, setPage] = useTourState(1, 1);
  const [source, setSource] = useTourState('', '');
  const [query, setQuery] = useTourState('', '');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useTourState('', '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const dirty = !!edit && (edit.content !== edit.initial || (edit.mode === 'new' && !!edit.name));
  const selected = entries.find((entry) => entryId(entry) === selectedId) ?? entries[0];
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const refresh = () => setRevision((value) => value + 1);
  const fail = (e: unknown) => toast({ title: e instanceof Error ? e.message : String(e), variant: 'destructive' });

  useEffect(() => {
    if (tour) return;
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [query, tour, setPage]);
  useEffect(() => {
    if (tour) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    const params = new URLSearchParams({ lang: i18n.language, q: search, source, page: String(page), size: String(PAGE_SIZE), management: '1' });
    const groupParams = new URLSearchParams({ lang: i18n.language, q: search, management: '1' });
    void Promise.all([request('/help?' + params, 'GET', undefined, controller.signal), request('/help/groups?' + groupParams, 'GET', undefined, controller.signal)])
      .then(([data, groupData]) => {
        if (controller.signal.aborted) return;
        setEntries(data.entries || []); setTotal(data.total || 0); setGroups(groupData.groups || []);
        const lastPage = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));
        if (page > lastPage) setPage(lastPage);
      }).catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [i18n.language, search, source, page, revision, tour, setEntries, setTotal, setGroups, setPage]);
  useUnsavedChanges(dirty || busy, async () => !busy && await dlg.confirm({
    title: t('ui_refresh.discard'), description: t('ui_refresh.help_discard_hint'),
    cancelText: t('ui_refresh.keep_editing'), confirmText: t('ui_refresh.discard_edits'), destructive: true,
  }));

  const sourceLabel = (value: string) => value === 'builtin' ? t('helpdoc.src_builtin')
    : value.startsWith('file:') ? `${t('helpdoc.src_file')} · ${value.slice(5)}`
    : value.startsWith('rule:') ? t('helpdoc.src_rule', { name: value.slice(5) })
    : value.startsWith('lua:') ? t('helpdoc.src_lua', { name: value.slice(4) })
    : value.startsWith('helpdoc:') ? t('helpdoc.src_helpdoc', { name: value.slice(8) })
    : t('helpdoc.src_plugin', { name: value.slice(7) });
  const closeEditor = async () => {
    if (busy) return;
    if (!dirty || await dlg.confirm({ title: t('ui_refresh.discard'), description: t('ui_refresh.help_discard_hint'), confirmText: t('ui_refresh.discard_edits'), cancelText: t('ui_refresh.keep_editing'), destructive: true })) setEdit(null);
  };
  const save = async () => {
    if (!edit || busy || tour) return;
    const name = edit.name.trim();
    if (edit.mode !== 'builtin' && !validHelpName(name)) { toast({ title: t('ui_refresh.help_invalid_name'), variant: 'destructive' }); return; }
    setBusy(true);
    try {
      if (edit.mode === 'new') {
        const data = await request('/help/files');
        if (data.files?.some((file: { name: string }) => file.name === name) && !await dlg.confirm({ title: t('ui_refresh.help_replace'), description: name, destructive: true })) return;
      }
      if (edit.mode === 'builtin') await request('/templates', 'PUT', { locale: i18n.language, key: edit.i18nKey, value: edit.content });
      else await request('/help/file', 'POST', { name, content: edit.content });
      if (edit.mode === 'new') { setQuery(''); setSearch(''); setSource('file:' + name); setPage(1); }
      setEdit(null); refresh(); toast({ title: t('common.save_success') });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const removeOrReset = async (entry: HelpEntry) => {
    const builtin = entry.source === 'builtin';
    if (busy || tour || !await dlg.confirm({ title: builtin ? t('helpdoc.reset') : t('helpdoc.delete_confirm', { name: entry.source.slice(5) }), description: builtin ? t('ui_refresh.help_reset_hint') : undefined, destructive: true })) return;
    setBusy(true);
    try {
      await request(builtin ? `/templates/${encodeURIComponent(i18n.language)}/${encodeURIComponent(entry.i18nKey!)}` : `/help/file/${encodeURIComponent(entry.source.slice(5))}`, 'DELETE');
      if (!builtin && source === entry.source) { setSource(''); setPage(1); }
      refresh(); toast({ title: t(builtin ? 'helpdoc.reset_done' : 'helpdoc.deleted') });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const exportDocs = async () => {
    if (busy || tour) return;
    setBusy(true);
    try {
      const data = await request('/help/files');
      if (!data.files?.length) { toast({ title: t('helpdoc.export_empty') }); return; }
      const bundle: Record<string, string> = Object.create(null);
      for (const file of data.files) { const doc = await request('/help/file?name=' + encodeURIComponent(file.name)); bundle[file.name] = doc.content; }
      download('helpdocs-export.json', JSON.stringify(bundle, null, 2), 'application/json');
      toast({ title: t('helpdoc.export_done', { n: data.files.length }) });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const importDocs = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || busy || tour) return;
    setBusy(true); let count = 0;
    try {
      let files;
      try { files = parseHelpImport(file.name, await file.text()); }
      catch { throw new Error(t('ui_refresh.help_invalid_import')); }
      const existing = await request('/help/files');
      const names = new Set((existing.files || []).map((item: { name: string }) => item.name));
      const conflicts = files.filter((item) => names.has(item.name));
      if (conflicts.length && !await dlg.confirm({ title: t('ui_refresh.help_replace'), description: conflicts.map((item) => item.name).join('\n'), destructive: true })) return;
      for (const item of files) { await request('/help/file', 'POST', item); count++; }
      setQuery(''); setSearch(''); setSource(''); setPage(1);
      toast({ title: t('helpdoc.import_done', { n: count }) });
    } catch (e) { fail(e); if (count) toast({ title: t('ui_refresh.help_partial_import', { count }) }); }
    finally { if (count) refresh(); setBusy(false); }
  };

  return <div className="space-y-6 min-w-0">
    <PageHeader icon={HelpCircle} title={t('helpdoc.title')} description={t('helpdoc.desc')} />
    <Card><CardContent data-tour="help-toolbar" className="flex flex-wrap items-center gap-2 p-4">
      <div className="relative min-w-[180px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label={t('helpdoc.search')} placeholder={t('helpdoc.search')} value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      <Button variant="outline" disabled={busy || loading || tour} onClick={refresh}><RefreshCw className="mr-2 h-4 w-4" />{t('common.refresh')}</Button>
      <Button variant="outline" disabled={busy || tour} onClick={exportDocs}><Download className="mr-2 h-4 w-4" />{t('helpdoc.export')}</Button>
      <Button variant="outline" disabled={busy || tour} onClick={() => importRef.current?.click()}><Upload className="mr-2 h-4 w-4" />{t('helpdoc.import')}</Button>
      <input ref={importRef} type="file" accept=".json,.md,.txt" className="hidden" onChange={importDocs} />
      <Button disabled={busy || tour} onClick={() => setEdit({ mode: 'new', name: '', content: '', initial: '' })}><Plus className="mr-2 h-4 w-4" />{t('helpdoc.new')}</Button>
    </CardContent></Card>
    {error && !tour && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}<Button variant="outline" onClick={refresh}>{t('ui_refresh.retry')}</Button></div>}
    <div data-tour="help-content" className="grid items-start gap-5 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,2fr)]" aria-busy={loading && !tour}>
      <Card className="min-w-0 overflow-hidden">
        <div className="space-y-3 border-b p-4"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{t('ui_refresh.help_library')}</h2><Badge variant="secondary">{total}</Badge></div>
          <Select value={source || '__all__'} onValueChange={(value) => { setSource(value === '__all__' ? '' : value); setPage(1); }}><SelectTrigger aria-label={t('ui_refresh.help_source')}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">{t('ui_refresh.help_all_sources')}</SelectItem>{source && !groups.some((group) => group.source === source) && <SelectItem value={source}>{sourceLabel(source)} · 0</SelectItem>}{groups.map((group) => <SelectItem key={group.source} value={group.source}>{sourceLabel(group.source)} · {group.count}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="max-h-[36vh] overflow-y-auto p-2 lg:max-h-[65vh]">
          {entries.map((entry) => <button key={entryId(entry)} type="button" aria-pressed={entry === selected} onClick={() => setSelectedId(entryId(entry))} className={`mb-1 flex w-full gap-3 rounded-lg border p-3 text-left transition-colors ${entry === selected ? 'border-primary/20 bg-primary/10' : 'border-transparent hover:bg-muted/70'}`}>
            <FileText className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{entry.key}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{sourceLabel(entry.source)}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{entry.content}</span></span>{!canEdit(entry) && <Lock className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />}
          </button>)}
          {!entries.length && <p className="p-6 text-center text-sm text-muted-foreground">{t(loading && !tour ? 'common.loading' : 'helpdoc.empty')}</p>}
        </div>
        {pageCount > 1 && <div className="border-t p-3"><PaginationBar total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={loading} fixedSize compact /></div>}
      </Card>
      <Card className="min-w-0 overflow-hidden">{selected ? <>
        <div className="space-y-4 border-b p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-xl font-semibold">{selected.key}</h2><p className="mt-2 break-words text-xs text-muted-foreground">{sourceLabel(selected.source)}</p></div><Badge variant={canEdit(selected) ? 'secondary' : 'outline'}>{t(canEdit(selected) ? 'ui_refresh.help_editable' : 'ui_refresh.help_readonly')}</Badge></div>
          <div className="flex flex-wrap gap-2">{canEdit(selected) && <Button disabled={busy || tour || loading || !!error} onClick={() => setEdit({ mode: selected.source === 'builtin' ? 'builtin' : 'file', name: selected.source.startsWith('file:') ? selected.source.slice(5) : selected.key, content: selected.content, initial: selected.content, i18nKey: selected.i18nKey })}><Pencil className="mr-2 h-4 w-4" />{t('helpdoc.edit')}</Button>}
            <Button variant="outline" onClick={() => download(selected.key.replace(/[\\/]/g, '_') + '.md', selected.content)}><Download className="mr-2 h-4 w-4" />{t('ui_refresh.help_download')}</Button>
            {canEdit(selected) && <Button variant="ghost" disabled={busy || tour || loading || !!error} onClick={() => removeOrReset(selected)}>{selected.source === 'builtin' ? <RotateCcw className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}{t(selected.source === 'builtin' ? 'helpdoc.reset' : 'common.delete')}</Button>}
          </div>
        </div>
        {!canEdit(selected) && <p className="border-b bg-muted/30 px-5 py-3 text-xs leading-relaxed text-muted-foreground">{t('helpdoc.readonly_hint')}</p>}
        {(selected.shadowed || !selected.content) && <p role="status" className="border-b bg-muted/30 px-5 py-3 text-sm text-muted-foreground">{t(selected.shadowed ? 'ui_audit.help_shadowed' : 'ui_audit.help_empty')}</p>}
        <pre className="max-h-[65vh] overflow-y-auto whitespace-pre-wrap break-words p-5 font-sans text-sm leading-7">{selected.content}</pre>
      </> : <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-muted-foreground"><FileText className="h-8 w-8" /><p className="text-sm">{t('helpdoc.empty')}</p></div>}</Card>
    </div>
    <Dialog open={!!edit} onOpenChange={(open) => { if (!open) void closeEditor(); }}>
      {edit && <DialogContent className="flex max-h-[90dvh] max-w-4xl flex-col overflow-hidden"><DialogHeader><DialogTitle>{t(edit.mode === 'new' ? 'helpdoc.new' : 'helpdoc.edit')}</DialogTitle><DialogDescription>{t(edit.mode === 'builtin' ? 'ui_refresh.help_builtin_hint' : 'ui_refresh.help_file_hint')}</DialogDescription></DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto"><label className="block space-y-2 text-sm"><span>{t('helpdoc.name')}</span><Input value={edit.name} disabled={edit.mode !== 'new' || busy} placeholder={t('helpdoc.name_ph')} onChange={(event) => setEdit({ ...edit, name: event.target.value })} /></label>
          <label className="block space-y-2 text-sm"><span>{t('ui_refresh.help_content')}</span><Textarea className="min-h-[35vh] font-mono text-sm leading-relaxed sm:min-h-[45vh]" spellCheck={false} value={edit.content} disabled={busy} onChange={(event) => setEdit({ ...edit, content: event.target.value })} /></label>
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t pt-4"><span className="mr-auto self-center text-xs text-muted-foreground">{dirty ? t('ui_refresh.unsaved') : ''}</span><Button variant="outline" disabled={busy} onClick={closeEditor}>{t('common.cancel')}</Button><Button disabled={busy} onClick={save}>{t(busy ? 'common.loading' : 'common.save')}</Button></DialogFooter>
      </DialogContent>}
    </Dialog>
    {dlg.node}
  </div>;
};
export default HelpDocsPage;
