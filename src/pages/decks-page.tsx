import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Trash2, RefreshCw, Loader2, FileJson, Pencil, FolderKanban, Search, Download, Layers3, ArrowUpRight, X, BookOpen } from 'lucide-react';
import { useTourActive, useTourState } from '@/components/onboarding/tour-data';
import { tourSamples } from '@/lib/tour-samples';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeckEditor } from '@/components/deck-editor';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { DECK_METADATA, deckFileKey, isReadonlyDeck, parseDeckDocument, type DeckFileIdentity } from '@/lib/deck-document';

interface DeckFile extends DeckFileIdentity { id: number; title: string; author?: string | null; version?: string | null; date?: string | null; description?: string | null; entries: string[]; hidden_entries?: string[] }
interface FileContent extends DeckFileIdentity { content: string }

async function deckRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/decks${path}`, options);
  const result = await response.json();
  if (!response.ok || result.code !== 0) throw new Error(result.message || `HTTP ${response.status}`);
  return result.data as T;
}

const sampleContent = JSON.stringify({ 森林奇遇: ['一只白鹿停在林间，似乎在等你跟上。', '古老的树洞中藏着一封未寄出的信。'], 酒馆传闻: ['北方的钟楼昨夜响了十三次。'], 旅途天气: ['晴朗，微风。'] });

export const DecksPage: React.FC = () => {
  const { t } = useTranslation();
  const touring = useTourActive();
  const toast = useToast();
  const dlg = useDialogs(t);
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useTourState<DeckFile[]>([], tourSamples.decks);
  const [loading, setLoading] = useTourState(true, false);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useTourState('library', 'library');
  const [search, setSearch] = useTourState('', '');
  const [selected, setSelected] = useTourState('', deckFileKey(tourSamples.decks[0]));
  const [group, setGroup] = useTourState('', '森林奇遇');
  const [content, setContent] = useTourState<FileContent | null>(null, { filename: tourSamples.decks[0].filename, content: sampleContent });
  const [readError, setReadError] = useTourState('', '');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<DeckFile | null>(null);
  const [pending, setPending] = useState<FileContent | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [entryPage, setEntryPage] = useState(1);
  const query = search.trim().toLocaleLowerCase();
  const matching = files.filter((file) => [file.title, file.filename, file.author, ...file.entries, ...(file.hidden_entries ?? [])].some((value) => value?.toLocaleLowerCase().includes(query)));
  const current = matching.find((file) => deckFileKey(file) === selected) ?? matching[0];
  const filename = current?.filename;
  const source = current?.source ?? (current?.readonly ? 'builtin' : undefined);
  const currentKey = current ? deckFileKey(current) : undefined;
  const currentContent = content && deckFileKey(content) === currentKey ? content.content : undefined;
  const readOnly = !!current && (isReadonlyDeck(current) || (!!content && deckFileKey(content) === currentKey && isReadonlyDeck(content)));
  const document = React.useMemo(() => {
    try { return currentContent === undefined ? null : parseDeckDocument(currentContent); }
    catch { return null; }
  }, [currentContent]);
  const groups = document ? Object.keys(document).filter((key) => !DECK_METADATA.has(key) && Array.isArray(document[key])) : current?.entries ?? [];
  const activeGroup = groups.includes(group) ? group : groups[0];
  const entries = activeGroup && Array.isArray(document?.[activeGroup]) ? document[activeGroup] as unknown[] : [];
  const pages = Math.max(1, Math.ceil(entries.length / 30));
  const page = Math.min(entryPage, pages);
  const stats = [
    { icon: FileJson, label: 'ui_refresh.files', count: files.length },
    { icon: Layers3, label: 'ui_refresh.groups', count: files.reduce((sum, file) => sum + file.entries.length, 0) },
    { icon: BookOpen, label: 'ui_refresh.hidden', count: files.reduce((sum, file) => sum + (file.hidden_entries?.filter((key) => !DECK_METADATA.has(key)).length ?? 0), 0) },
  ];

  const notifyError = useCallback((error: unknown, title: string) => toast({ title, description: error instanceof Error ? error.message : undefined, variant: 'destructive' }), [toast]);
  const fetchDecks = useCallback(async () => {
    setLoadError(false);
    try { setFiles((await deckRequest<DeckFile[]>('')).filter((file) => file.filename)); }
    catch (error) { setLoadError(true); notifyError(error, t('common.load_fail')); }
    finally { setLoading(false); }
  }, [notifyError, t, setFiles, setLoading]);
  useEffect(() => { if (!touring) void fetchDecks(); }, [fetchDecks, touring]);
  useEffect(() => {
    if (!filename || touring) return;
    const controller = new AbortController();
    setContent(null); setReadError(''); setEntryPage(1);
    void deckRequest<{ content: string; readonly?: boolean }>(`/file?name=${encodeURIComponent(filename)}${source ? `&source=${source}` : ''}`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setContent({ filename, source, content: data.content, readonly: data.readonly }); })
      .catch((error) => { if (!controller.signal.aborted) setReadError(error instanceof Error ? error.message : String(error)); });
    return () => controller.abort();
  }, [filename, source, revision, setContent, setReadError, touring]);

  const reload = async () => {
    setLoading(true);
    try { const data = await deckRequest<{ total_decks: number }>('/reload', { method: 'POST' }); toast({ title: t('decks.reloaded', { n: data.total_decks }) }); setRevision((n) => n + 1); }
    catch (error) { notifyError(error, t('common.load_fail')); }
    await fetchDecks();
  };
  const prepareImport = async (fileList: FileList | null) => {
    setPending(null);
    if (!fileList?.length) return;
    const file = fileList[0];
    if (fileList.length !== 1 || !file.name.endsWith('.json')) { toast({ title: t('ui_refresh.json_only'), variant: 'destructive' }); return; }
    try {
      const value = await file.text();
      parseDeckDocument(value, true);
      setPending({ filename: file.name, content: value }); setTab('transfer');
    } catch (error) { toast({ title: t('ui_refresh.invalid_json'), description: (error as Error).message === 'invalid_deck' ? t('ui_refresh.invalid_deck') : (error as Error).message, variant: 'destructive' }); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  };
  const importFile = async () => {
    if (!pending || busy) return;
    if (files.some((file) => !isReadonlyDeck(file) && file.filename === pending.filename) && !(await dlg.confirm({ title: t('ui_refresh.overwrite'), description: t('ui_refresh.overwrite_hint', { name: pending.filename }), destructive: true }))) return;
    setBusy(true);
    try {
      await deckRequest('/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending) });
      try {
        await deckRequest('/reload', { method: 'POST' });
        toast({ title: t('decks.uploaded', { name: pending.filename }) });
      } catch { toast({ title: t('ui_refresh.reload_failed'), variant: 'destructive' }); }
      setSelected(deckFileKey(pending)); setSearch(''); setPending(null); setRevision((n) => n + 1); setTab('library'); await fetchDecks();
    } catch (error) { notifyError(error, t('common.upload_fail')); }
    finally { setBusy(false); }
  };
  const download = () => {
    if (!current || currentContent === undefined) return;
    const url = URL.createObjectURL(new Blob([currentContent], { type: 'application/json;charset=utf-8' }));
    const link = window.document.createElement('a'); link.href = url; link.download = current.filename;
    window.document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const remove = async () => {
    if (!current || readOnly || busy || !(await dlg.confirm({ title: t('common.confirm_delete'), description: t('decks.confirm_delete', { title: current.title, filename: current.filename, count: current.entries.length }), destructive: true, confirmText: t('common.delete') }))) return;
    setBusy(true);
    try { await deckRequest(`/file/${encodeURIComponent(current.filename)}`, { method: 'DELETE' }); toast({ title: t('decks.deleted') }); await fetchDecks(); }
    catch (error) { notifyError(error, t('common.delete_fail')); }
    finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-7xl space-y-6 pb-6">
    <PageHeader icon={FolderKanban} title={t('decks.title')} description={t('ui_refresh.library_hint')} actions={<div data-tour="decks-actions" className="flex gap-2">
      <Button variant="outline" onClick={() => void reload()} disabled={loading || busy}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}</Button>
      <Button onClick={() => setTab('transfer')}><Upload className="mr-2 h-4 w-4" />{t('decks.upload')}</Button>
    </div>} />
    <div className="grid grid-cols-3 gap-3">
      {stats.map(({ icon: Icon, label, count }) => <Card key={label} className="flex items-center gap-3 p-3 shadow-none sm:p-4"><span className="hidden rounded-lg bg-primary/5 p-2.5 text-primary sm:block"><Icon className="h-5 w-5" /></span><div><p className="text-xs text-muted-foreground">{t(label)}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{count}</p></div></Card>)}
    </div>
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList variant="page" aria-label={t('decks.title')}><TabsTrigger value="library"><FolderKanban className="h-4 w-4" />{t('ui_refresh.library')}</TabsTrigger><TabsTrigger value="transfer"><Upload className="h-4 w-4" />{t('ui_refresh.transfer')}</TabsTrigger></TabsList>
      <TabsContent value="library" className="space-y-4" data-tour="decks-list">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label={t('ui_refresh.search')} placeholder={t('ui_refresh.search')} value={search} onChange={(event) => { setSearch(event.target.value); setEntryPage(1); }} className="bg-card pl-10 pr-10" />{search && <Button variant="ghost" size="icon" className="absolute right-0 top-0" aria-label={t('ui_refresh.clear')} onClick={() => setSearch('')}><X className="h-4 w-4" /></Button>}</div>
        {loading ? <div className="flex justify-center py-24" role="status"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : loadError ? <Card className="space-y-3 p-10 text-center"><p>{t('common.load_fail')}</p><Button variant="outline" onClick={() => void fetchDecks()}>{t('ui_refresh.retry')}</Button></Card> : !matching.length ? <Card className="flex flex-col items-center gap-3 px-6 py-20 text-center"><FileJson className="h-10 w-10 text-muted-foreground/40" /><h2 className="font-medium">{t(files.length ? 'ui_refresh.no_match' : 'decks.no_decks')}</h2><p className="text-sm text-muted-foreground">{t('decks.no_decks_hint')}</p><Button variant="outline" onClick={() => files.length ? setSearch('') : setTab('transfer')}>{t(files.length ? 'ui_refresh.clear' : 'ui_refresh.choose_file')}</Button></Card> : <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="overflow-hidden shadow-none">
            <div className="flex justify-between border-b px-4 py-3 text-xs font-medium text-muted-foreground"><span>{t('ui_refresh.all')}</span><span>{matching.length}</span></div>
            <div className="max-h-[260px] overflow-y-auto p-2 lg:max-h-[65vh]" aria-label={t('ui_refresh.files')}>
              {matching.map((file) => <button key={deckFileKey(file)} type="button" aria-pressed={currentKey === deckFileKey(file)} onClick={() => { setSelected(deckFileKey(file)); setGroup(''); setEntryPage(1); }} className={`mb-1 flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${currentKey === deckFileKey(file) ? 'border-primary/20 bg-primary/[0.07]' : 'border-transparent hover:bg-muted/60'}`}>
                <FileJson className={`mt-0.5 h-4 w-4 shrink-0 ${currentKey === deckFileKey(file) ? 'text-primary' : 'text-muted-foreground'}`} /><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{file.title}</p>{isReadonlyDeck(file) && <Badge variant="secondary" className="mt-1">{t('decks.builtin_readonly')}</Badge>}<p className="mt-1 truncate text-xs text-muted-foreground">{file.author || file.filename}</p><p className="mt-2 text-[11px] text-muted-foreground">{t('decks.entries_count', { count: file.entries.length })}{file.version ? ` · v${file.version}` : ''}</p></div>{currentKey === deckFileKey(file) && <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" />}
              </button>)}
            </div>
          </Card>
          {current && <Card className="min-w-0 overflow-hidden shadow-sm">
            <div className="space-y-4 border-b p-5 sm:p-6">
              <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><FileJson className="h-6 w-6" /></div><div className="min-w-0 flex-1"><p className="mb-1 break-all font-mono text-[11px] text-muted-foreground">{current.filename}</p><h2 className="break-words text-xl font-semibold tracking-tight">{current.title}</h2></div></div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{current.description || t('decks.no_brief')}</p>
              <div className="flex flex-wrap items-center gap-2">{[current.author, current.version && `v${current.version}`, current.date].filter(Boolean).map((value, i) => <Badge key={i} variant="secondary" className="font-normal">{value}</Badge>)}</div>
              {readOnly && <p className="text-sm text-muted-foreground">{t('decks.builtin_readonly_hint')}</p>}
              <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => { if (!readOnly) setEditing(current); }} disabled={readOnly || currentContent === undefined || busy}><Pencil className="mr-2 h-4 w-4" />{t('common.edit')}</Button><Button size="sm" variant="outline" onClick={download} disabled={currentContent === undefined}><Download className="mr-2 h-4 w-4" />{t('ui_refresh.download')}</Button><Button size="sm" variant="ghost" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => void remove()} disabled={readOnly || currentContent === undefined || busy}><Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}</Button></div>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-wrap gap-2">{groups.map((name) => <button key={name} className={`max-w-full break-words rounded-md border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeGroup === name ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'} ${name.startsWith('_') ? 'border-dashed' : ''}`} onClick={() => { setGroup(name); setEntryPage(1); }} aria-pressed={activeGroup === name}>{name}</button>)}</div>
              {readError ? <div role="alert" className="rounded-lg border border-destructive/20 p-4 text-sm"><p>{t('ui_refresh.read_error')}</p><p className="mt-2 break-words text-xs text-muted-foreground">{readError}</p><Button size="sm" variant="outline" className="mt-3" onClick={() => setRevision((n) => n + 1)}>{t('ui_refresh.retry')}</Button></div> : currentContent === undefined ? <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-muted-foreground" /> : !document ? <p className="text-sm text-destructive">{t('ui_refresh.invalid_json')}</p> : <>
                <h3 className="text-sm font-medium">{activeGroup || t('decks.no_entries')} <span className="ml-2 text-xs font-normal text-muted-foreground">{t('ui_refresh.entries', { count: entries.length })}</span></h3>
                <ol className="divide-y rounded-lg border bg-muted/15">{entries.slice((page - 1) * 30, page * 30).map((entry, i) => <li key={i} className="flex gap-3 px-4 py-3"><span className="w-5 shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground">{(page - 1) * 30 + i + 1}</span><p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed">{typeof entry === 'string' ? entry : JSON.stringify(entry)}</p></li>)}{!entries.length && <li className="p-8 text-center text-sm text-muted-foreground">{t('ui_refresh.empty_group')}</li>}</ol>
                <PaginationBar total={entries.length} page={page} pageSize={30} onPageChange={setEntryPage} fixedSize compact />
              </>}
            </div>
          </Card>}
        </div>}
      </TabsContent>
      <TabsContent value="transfer" className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="space-y-5 p-5 sm:p-8">
          <div><h2 className="text-lg font-semibold">{t('ui_refresh.import_title')}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('ui_refresh.import_note')}</p></div>
          <div className={`flex flex-col items-center gap-4 rounded-xl border-2 border-dashed px-5 py-12 text-center transition-colors ${dragging ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'}`}
            onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) void prepareImport(event.dataTransfer.files); }}>
            <span className="rounded-2xl border bg-card p-4 text-primary shadow-sm"><Upload className="h-7 w-7" /></span><p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{t('ui_refresh.import_hint')}</p><Button variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>{t('ui_refresh.choose_file')}</Button>
            <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void prepareImport(event.target.files)} />
          </div>
          {pending && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4"><FileJson className="h-5 w-5 text-primary" /><div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{pending.filename}</p><p className="text-xs text-muted-foreground">{t('ui_refresh.import_ready')} · {(new Blob([pending.content]).size / 1024).toFixed(1)} KB</p></div><Button onClick={() => void importFile()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('ui_refresh.import_confirm')}</Button><Button size="icon" variant="ghost" aria-label={t('common.cancel')} disabled={busy} onClick={() => setPending(null)}><X className="h-4 w-4" /></Button></div>}
        </Card>
        <Card className="space-y-3 p-6 shadow-none"><Download className="h-5 w-5 text-primary" /><h3 className="font-medium">{t('ui_refresh.export_title')}</h3><p className="text-sm leading-relaxed text-muted-foreground">{t('ui_refresh.export_hint')}</p><Button variant="outline" size="sm" onClick={() => setTab('library')}>{t('ui_refresh.library')}<ArrowUpRight className="ml-2 h-4 w-4" /></Button></Card>
      </TabsContent>
    </Tabs>
    {editing && !isReadonlyDeck(editing) && content && !isReadonlyDeck(content) && deckFileKey(content) === deckFileKey(editing) && <DeckEditor filename={editing.filename} title={editing.title} initialContent={content.content} initialGroup={activeGroup} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRevision((n) => n + 1); void fetchDecks(); }} />}
    {dlg.node}
  </div>;
};
export default DecksPage;
