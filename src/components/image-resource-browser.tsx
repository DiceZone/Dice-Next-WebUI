import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronRight, Code2, Copy, Eye, Folder, FolderPlus, ImageIcon, Loader2, MoreHorizontal, Pencil, RefreshCw, Scissors, Search, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDialogs } from '@/hooks/use-dialogs';
import { useToast } from '@/hooks/use-toast';
import { useServerListPage } from '@/hooks/use-server-list-page';
import { apiClient, ApiError } from '@/lib/api-client';
import { IMAGE_ACCEPT, downloadResourceBlob, imageResourceCode, joinResourcePath, resourceBlob, resourceOperation, resourceUrl, resourceUsages, uploadResource, resourceArchive, importResourceArchive, type ImageResource, type ResourceListing, type ResourceSort, type ResourceUsage } from '@/lib/image-resources';

function formatSize(bytes: number) { return bytes < 1024 ? `${bytes} B` : bytes < 1024*1024 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1024/1024).toFixed(1)} MB`; }

/** Deliberately mounted only after an explicit Preview click. */
function ImagePreview({ entry, close }: { entry: ImageResource; close: () => void }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let objectUrl = '';
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      const blob = await resourceBlob(entry.id, controller.signal);
      if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [entry.id]);
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
    <DialogContent layout="editor" className="max-w-4xl">
      <DialogHeader><DialogTitle className="break-all pr-6 font-mono text-sm">data/images/{entry.path}</DialogTitle></DialogHeader>
      <DialogBody className="flex items-center justify-center rounded-md bg-muted/30 p-3">
        {failed ? <p role="alert">{t('image_resources.previewFailed')}</p> : url ? <img src={url} alt={entry.name} className="max-h-full max-w-full object-contain" onError={() => setFailed(true)} /> : <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('image_resources.previewLoading')}</p>}
      </DialogBody>
    </DialogContent>
  </Dialog>;
}

interface Props { initialDirectory?: string; onSelect?: (entry: ImageResource) => void; }
export function ImageResourceBrowser({ initialDirectory = '', onSelect }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const dialogs = useDialogs(t);
  const [directory, setDirectory] = useState(initialDirectory);
  const [page, setPage] = useState(1), [size, setSize] = useState(20);
  const [query, setQuery] = useState(''), [search, setSearch] = useState('');
  const [sort, setSort] = useState<ResourceSort>('name'), [descending, setDescending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<{ action: 'copy' | 'move'; paths: string[] } | null>(null);
  const [trash, setTrash] = useState(false), [busy, setBusy] = useState(false), [progress, setProgress] = useState<number | null>(null);
  const [editingPath, setEditingPath] = useState(false), [pathDraft, setPathDraft] = useState('');
  const [preview, setPreview] = useState<ImageResource | null>(null);
  const [usage, setUsage] = useState<{ path: string; items: ResourceUsage[]; warnings: string[] } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const archiveInput = useRef<HTMLInputElement>(null);
  const operationLock = useRef(false), mounted = useRef(true);
  const list = useServerListPage<ImageResource>(resourceUrl(directory, page, size, search, sort, descending, trash));
  const data = list.data as ResourceListing | null;
  const entries = data?.items || [];
  const chosen = entries.filter((entry) => selected.has(entry.id));
  const blocked = busy || list.loading;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { const timer = window.setTimeout(() => { setSearch(query); setPage(1); }, 300); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => { setSelected(new Set()); }, [directory, page, size, search, trash]);
  useEffect(() => { if (data && !list.loading && !list.error && page !== data.page) setPage(data.page); }, [data, list.loading, list.error, page]);
  useEffect(() => {
    if (data?.migration?.status !== 'running') return;
    const timer = window.setInterval(() => void list.load(), 3000); return () => window.clearInterval(timer);
  }, [data?.migration?.status, list.load]);
  const message = (error: unknown) => error instanceof Error ? error.message : String(error);
  const go = (path: string) => { setDirectory(path.replace(/^\/?data\/images\/?/, '').replace(/\/$/, '')); setPage(1); setSelected(new Set()); };
  const toggle = (entry: ImageResource) => setSelected((old) => { const next = new Set(old); if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id); return next; });
  const run = async (action: () => Promise<unknown>) => {
    if (operationLock.current) return;
    operationLock.current = true; setBusy(true);
    try {
      const result = await action();
      if (mounted.current && result && typeof result === 'object' && 'warnings' in result && Array.isArray(result.warnings) && result.warnings.length) {
        toast({ title: t('resource_transfer.warnings'), description: result.warnings.map((item: unknown) => typeof item === 'string' ? item : JSON.stringify(item)).join('\n') });
      }
      if (mounted.current) { toast({ title: t('image_resources.complete') }); setSelected(new Set()); await list.load(); }
    } catch (error) { if (mounted.current) toast({ title: t('image_resources.failed'), description: message(error), variant: 'destructive' }); }
    finally { operationLock.current = false; if (mounted.current) { setBusy(false); setProgress(null); } }
  };
  const copyText = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast({ title: t('image_resources.copied') }); }
    catch (error) { toast({ title: t('image_resources.failed'), description: message(error), variant: 'destructive' }); }
  };
  const mkdir = async () => {
    const name = await dialogs.prompt({ title: t('image_resources.folder'), description: t('image_resources.folderName') });
    if (!name?.trim() || !mounted.current) return;
    await run(() => apiClient.post('/resources/images/folder', { path: joinResourcePath(directory, name.trim()) }));
  };
  const rename = async (entry: ImageResource) => {
    const path = entry.path;
    const name = await dialogs.prompt({ title: t('image_resources.rename'), description: t('image_resources.renameName'), defaultValue: entry.name });
    if (!name?.trim() || name.trim() === entry.name || !mounted.current) return;
    await run(() => resourceOperation('rename', [path], joinResourcePath(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '', name.trim())));
  };
  const remove = async (items: ImageResource[], permanent = false) => {
    if (!items.length || !await dialogs.confirm({ title: t(permanent ? 'image_resources.purgeTitle' : 'image_resources.deleteTitle'), description: t(permanent ? 'image_resources.purgeHint' : 'image_resources.deleteHint'), destructive: true, confirmText: t('common.delete') }) || !mounted.current) return;
    await run(() => resourceOperation(permanent ? 'purge' : 'delete', items.map((item) => permanent ? item.id : item.path)));
  };
  const paste = async () => {
    if (!clipboard) return;
    const selection = clipboard;
    await run(async () => {
      let result;
      try { result = await resourceOperation(selection.action, selection.paths, directory); }
      catch (error) {
        if (!(error instanceof ApiError) || error.code !== 409 || !await dialogs.confirm({ title: t('image_resources.overwriteTitle'), description: t('image_resources.overwriteHint'), destructive: true })) throw error;
        result = await resourceOperation(selection.action, selection.paths, directory, true);
      }
      if (mounted.current) setClipboard(null);
      return result;
    });
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files).slice(0, onSelect ? 1 : 100);
    const destination = directory || 'shared';
    await run(async () => {
      let last: ImageResource | null = null;
      for (const file of picked) {
        try { last = await uploadResource(file, destination, false, (value) => { if (mounted.current) setProgress(value); }); }
        catch (error) {
          if (!(error instanceof ApiError) || error.code !== 409 || !await dialogs.confirm({ title: t('image_resources.overwriteTitle'), description: `${file.name}\n${t('image_resources.overwriteHint')}`, destructive: true })) throw error;
          last = await uploadResource(file, destination, true, (value) => { if (mounted.current) setProgress(value); });
        }
      }
      if (last && onSelect && mounted.current) onSelect(last);
    });
    if (input.current) input.current.value = '';
  };
  const showUsages = async (entry: ImageResource) => {
    await run(async () => { const result = await resourceUsages(entry.path); if (mounted.current) setUsage({ path: entry.path, items: result.items, warnings: result.warnings }); });
  };
  const downloadZip = (paths: string[]) => run(async () => downloadResourceBlob(await resourceArchive(paths), 'images.zip'));
  const importZip = async (file?: File) => {
    if (!file) return;
    if (file.size > 128 * 1024 * 1024) { toast({ title: t('resource_transfer.archiveLimit'), variant: 'destructive' }); return; }
    await run(async () => {
      try { return await importResourceArchive(file, directory); }
      catch (error) { if (!(error instanceof ApiError) || error.code !== 409 || !await dialogs.confirm({ title: t('image_resources.overwriteTitle'), description: error.responseMessage, destructive: true })) throw error; return importResourceArchive(file, directory, true); }
    });
    if (archiveInput.current) archiveInput.current.value = '';
  };
  const iconButton = (title: string, icon: ReactNode, action: () => void, disabled = blocked) => <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title={title} aria-label={title} disabled={disabled} onClick={action}>{icon}</Button>;

  return <div className="min-w-0 space-y-3" data-image-resource-browser>
    {dialogs.node}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">{t('image_resources.bulkHint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void list.load()} disabled={blocked}><RefreshCw className="mr-1.5 h-4 w-4" />{t('common.refresh')}</Button>
        {!trash && <><Button variant="outline" size="sm" onClick={() => void mkdir()} disabled={blocked}><FolderPlus className="mr-1.5 h-4 w-4" />{t('image_resources.folder')}</Button>
          <Button size="sm" onClick={() => input.current?.click()} disabled={blocked}>{busy && progress !== null ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}{progress === null ? t('image_resources.upload') : t('image_resources.uploadProgress', { n: progress })}</Button></>}
        {!onSelect && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" aria-label={t('image_resources.more')} disabled={busy}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => { setTrash((old) => !old); setPage(1); }}>{t(trash ? 'image_resources.back' : 'image_resources.trash')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void run(() => apiClient.post('/resources/images/scan', {}))}>{t('image_resources.scan')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void run(() => apiClient.post('/resources/images/migration', {}))}>{t('image_resources.migrate')}</DropdownMenuItem>
          {!trash && <DropdownMenuItem onSelect={() => archiveInput.current?.click()}>{t('resource_transfer.extract')}</DropdownMenuItem>}
        </DropdownMenuContent></DropdownMenu>}
      </div>
      <input ref={input} type="file" multiple={!onSelect} accept={IMAGE_ACCEPT} className="hidden" onChange={(event) => void upload(event.target.files)} />
      <input ref={archiveInput} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => void importZip(event.target.files?.[0])} />
    </div>
    {data?.migration?.status === 'running' && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('resource_transfer.migrationRunning', { n: data.migration.copied })}</p>}
    {data?.migration && ['failed', 'partial'].includes(data.migration.status) && <div role="alert" className="rounded-md border border-amber-400/50 bg-amber-50/30 p-3 text-sm"><p>{t('resource_transfer.migrationFailed')}</p><details className="mt-2 text-xs"><summary className="cursor-pointer">{t('resource_transfer.details')}</summary><p className="mt-2 whitespace-pre-wrap">{[data.migration.error, ...data.migration.warnings].filter(Boolean).join('\n')}</p></details></div>}
    {!!data?.recoveryWarnings?.length && <details role="alert" className="rounded-md border border-amber-400/50 p-3 text-xs"><summary className="cursor-pointer">{t('resource_transfer.warnings')}</summary><p className="mt-2 whitespace-pre-wrap">{data.recoveryWarnings.join('\n')}</p></details>}
    <div className="space-y-3 rounded-lg border border-slate-300 bg-slate-100 p-3 text-slate-900 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100">
      {trash ? <div className="flex items-center gap-2 text-sm font-medium"><Trash2 className="h-4 w-4" />{t('image_resources.trash')}</div> : editingPath ? <Input autoFocus aria-label={t('image_resources.path')} value={pathDraft} onChange={(event) => setPathDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { go(pathDraft); setEditingPath(false); } if (event.key === 'Escape') setEditingPath(false); }} onBlur={() => setEditingPath(false)} className="font-mono" /> :
        <div className="flex min-h-10 min-w-0 flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1 text-sm" onDoubleClick={() => { setPathDraft(`data/images/${directory}`); setEditingPath(true); }}>
          <button type="button" className="inline-flex items-center gap-1 rounded px-1 py-1 hover:bg-muted" onClick={() => go('')}><Folder className="h-4 w-4" />data/images</button>
          {directory.split('/').filter(Boolean).map((part, index, parts) => <span key={`${index}-${part}`} className="inline-flex min-w-0 items-center gap-1"><ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" /><button type="button" className="truncate rounded px-1 py-1 font-mono hover:bg-muted" onClick={() => go(parts.slice(0, index+1).join('/'))}>{part}</button></span>)}
          <button type="button" className="ml-auto px-2 py-1 text-muted-foreground" aria-label={t('image_resources.path')} onClick={() => { setPathDraft(`data/images/${directory}`); setEditingPath(true); }}><Pencil className="h-3.5 w-3.5" /></button>
        </div>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label={t('image_resources.search')} placeholder={t('image_resources.search')} value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 bg-background pl-9" /></div>
        <Select value={sort} onValueChange={(value) => { setSort(value as ResourceSort); setPage(1); }}><SelectTrigger aria-label={t('image_resources.name')} className="h-9 w-32 bg-background"><SelectValue /></SelectTrigger><SelectContent>{(['name','path','size','modified'] as const).map((key) => <SelectItem key={key} value={key}>{t(`image_resources.${key}`)}</SelectItem>)}</SelectContent></Select>
        {iconButton(t(descending ? 'image_resources.descending' : 'image_resources.ascending'), descending ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />, () => { setDescending((old) => !old); setPage(1); }, busy)}
      </div>
      {(chosen.length > 0 || clipboard) && <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-200 p-2 text-sm dark:bg-slate-800">
        {chosen.length > 0 && !trash && <Button size="sm" variant="outline" disabled={blocked} onClick={() => void downloadZip(chosen.map((entry) => entry.path))}>{t('resource_transfer.archive')}</Button>}
        {chosen.length > 0 && <><span className="mr-1 text-xs">{t('image_resources.picked', { n: chosen.length })}</span>{trash ? <><Button size="sm" variant="outline" disabled={blocked} onClick={() => void run(() => resourceOperation('restore', chosen.map((entry) => entry.id)))}>{t('image_resources.restore')}</Button><Button size="sm" variant="destructive" disabled={blocked} onClick={() => void remove(chosen, true)}>{t('image_resources.purge')}</Button></> : <><Button size="sm" variant="outline" disabled={blocked} onClick={() => setClipboard({ action: 'move', paths: chosen.map((entry) => entry.path) })}><Scissors className="mr-1 h-3.5 w-3.5" />{t('image_resources.cut')}</Button><Button size="sm" variant="outline" disabled={blocked} onClick={() => setClipboard({ action: 'copy', paths: chosen.map((entry) => entry.path) })}><Copy className="mr-1 h-3.5 w-3.5" />{t('image_resources.copy')}</Button><Button size="sm" variant="destructive" disabled={blocked || chosen.some((entry) => entry.protected)} onClick={() => void remove(chosen)}><Trash2 className="mr-1 h-3.5 w-3.5" />{t('common.delete')}</Button></>}</>}
        {clipboard && !trash && <><span className="ml-auto text-xs text-muted-foreground">{t('image_resources.clipboard', { action: t(clipboard.action === 'move' ? 'image_resources.cut' : 'image_resources.copy'), n: clipboard.paths.length })}</span><Button size="sm" disabled={blocked} onClick={() => void paste()}>{t('image_resources.paste')}</Button><Button size="sm" variant="ghost" onClick={() => setClipboard(null)}>{t('common.cancel')}</Button></>}
      </div>}
      {list.error ? <div role="alert" className="rounded border border-destructive/40 p-5 text-sm"><p>{t('common.load_fail')}</p><Button variant="outline" className="mt-2" onClick={() => void list.load()}>{t('common.retry')}</Button></div> : <div className="overflow-x-auto rounded-md border bg-background" aria-busy={list.loading}>
        <table className={`w-full text-sm ${list.loading ? 'opacity-60' : ''}`}><thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr>
          <th className="w-10 p-3"><input type="checkbox" aria-label={t('image_resources.selectAll')} disabled={blocked || !entries.length} checked={entries.length > 0 && entries.every((entry) => selected.has(entry.id))} onChange={(event) => setSelected(new Set(event.target.checked ? entries.map((entry) => entry.id) : []))} /></th>
          <th className="p-3 text-left font-medium">{t('image_resources.name')}</th><th className="hidden p-3 text-right font-medium sm:table-cell">{t('image_resources.size')}</th><th className="hidden p-3 text-left font-medium lg:table-cell">{t('image_resources.modified')}</th><th className="p-3 text-right font-medium">{t('common.actions')}</th>
        </tr></thead><tbody>
          {!trash && directory && <tr className="border-b"><td /><td colSpan={4} className="p-2"><button type="button" className="inline-flex items-center gap-2 px-1 py-1 text-muted-foreground hover:text-foreground" onClick={() => go(directory.includes('/') ? directory.slice(0,directory.lastIndexOf('/')) : '')}><ArrowLeft className="h-4 w-4" />..</button></td></tr>}
          {entries.map((entry) => <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/30">
            <td className="p-3"><input type="checkbox" checked={selected.has(entry.id)} disabled={blocked} aria-label={entry.path} onChange={() => toggle(entry)} /></td>
            <td className="max-w-0 p-3"><div className="flex min-w-0 items-start gap-2">{entry.isDirectory ? <Folder className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" /> : <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}<div className="min-w-0">{entry.isDirectory && !trash ? <button type="button" className="max-w-full truncate font-medium hover:underline" disabled={busy} onClick={() => go(entry.path)}>{entry.name}</button> : <p className="truncate font-medium" title={entry.name}>{entry.name}</p>}<p className="truncate font-mono text-xs text-muted-foreground" title={`data/images/${entry.path}`}>data/images/{entry.path}</p></div></div></td>
            <td className="hidden whitespace-nowrap p-3 text-right tabular-nums text-muted-foreground sm:table-cell">{entry.isDirectory ? '—' : formatSize(entry.size)}</td>
            <td className="hidden whitespace-nowrap p-3 text-xs text-muted-foreground lg:table-cell">{entry.modified ? new Date(entry.modified * 1000).toLocaleString() : '—'}</td>
            <td className="p-2"><div className="flex items-center justify-end gap-0.5">
              {trash ? <>{iconButton(t('image_resources.restore'), <RefreshCw className="h-4 w-4" />, () => void run(() => resourceOperation('restore',[entry.id])))}{iconButton(t('image_resources.purge'), <Trash2 className="h-4 w-4" />, () => void remove([entry],true))}</> : <>
                {!entry.isDirectory && <>{iconButton(t('image_resources.preview'), <Eye className="h-4 w-4" />, () => setPreview(entry))}{iconButton(t('image_resources.copyCode'), <Code2 className="h-4 w-4" />, () => void copyText(entry.code || imageResourceCode(entry.path)))}{onSelect && iconButton(t('image_resources.select'), <Check className="h-4 w-4" />, () => onSelect(entry))}</>}
                <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`${t('image_resources.more')} ${entry.name}`} disabled={blocked}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void copyText(`data/images/${entry.path}`)}>{t('image_resources.copyPath')}</DropdownMenuItem>
                  {!entry.isDirectory && <DropdownMenuItem onSelect={() => void run(async () => downloadResourceBlob(await resourceBlob(entry.id),entry.name))}>{t('image_resources.download')}</DropdownMenuItem>}
                  {entry.isDirectory && <DropdownMenuItem onSelect={() => void downloadZip([entry.path])}>{t('resource_transfer.archive')}</DropdownMenuItem>}
                  <DropdownMenuItem onSelect={() => void showUsages(entry)}>{t('image_resources.usages')}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setClipboard({ action:'copy',paths:[entry.path] })}>{t('image_resources.copy')}</DropdownMenuItem>
                  <DropdownMenuItem disabled={entry.protected} onSelect={() => setClipboard({ action:'move',paths:[entry.path] })}>{t('image_resources.cut')}</DropdownMenuItem>
                  <DropdownMenuItem disabled={entry.protected} onSelect={() => void rename(entry)}>{t('image_resources.rename')}</DropdownMenuItem>
                  <DropdownMenuItem disabled={entry.protected} onSelect={() => void remove([entry])} className="text-destructive">{t('common.delete')}</DropdownMenuItem>
                </DropdownMenuContent></DropdownMenu>
              </>}
            </div></td>
          </tr>)}
          {!entries.length && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">{list.loading ? <span role="status" className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{t('image_resources.loading')}</span> : t(search ? 'image_resources.noMatch' : 'image_resources.empty')}</td></tr>}
        </tbody></table>
      </div>}
      {!list.error && <PaginationBar total={data?.total || 0} page={page} pageSize={size} onPageChange={setPage} onPageSizeChange={(value) => { setSize(value); setPage(1); }} disabled={blocked} />}
    </div>
    {preview && <ImagePreview key={preview.id} entry={preview} close={() => setPreview(null)} />}
    <Dialog open={usage !== null} onOpenChange={(open) => { if (!open) setUsage(null); }}><DialogContent layout="editor"><DialogHeader><DialogTitle>{t('image_resources.usageLocation')}</DialogTitle></DialogHeader><DialogBody className="space-y-3"><p className="break-all font-mono text-xs">{usage?.path}</p><p className="text-xs text-muted-foreground">{t('image_resources.dynamicHint')}</p>{usage?.items.length ? usage.items.map((item,index) => <div key={`${item.id}-${index}`} className="rounded-md border p-3 text-sm"><p>{item.label}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{item.type} · {item.id}</p></div>) : <p className="text-sm text-muted-foreground">{t('image_resources.noUsages')}</p>}{usage?.warnings.map((warning,index) => <p key={index} className="text-sm text-amber-600">{warning}</p>)}</DialogBody></DialogContent></Dialog>
  </div>;
}
