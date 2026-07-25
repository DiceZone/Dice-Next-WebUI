import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { Upload, Trash2, RefreshCw, Loader2, FileJson, ChevronDown, ChevronRight, Pencil, X, FolderKanban } from 'lucide-react';
import { PaginationBar } from '@/components/ui/pagination-bar';

interface DeckFile { id: number; filename: string; title: string; author?: string | null; version?: string | null; date?: string | null; description?: string | null; entries: string[]; hidden_entries?: string[]; }

export const DecksPage: React.FC = () => {
  const { t } = useTranslation(); const toast = useToast();
  const dlg = useDialogs(t);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<DeckFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<DeckFile | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);

  const fetchDecks = useCallback(async () => {
    try { const resp = await fetch('/api/decks'); const json = await resp.json(); if (json.code === 0) setFiles((json.data || []).filter((d: DeckFile) => d.filename)); }
    catch { toast({ title: t('common.load_fail'), variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [toast, t]);

  const reloadDecks = useCallback(async () => {
    setLoading(true);
    try { const resp = await fetch('/api/decks/reload', { method: 'POST' }); const json = await resp.json(); if (json.code === 0) toast({ title: t('decks.reloaded', { n: json.data?.total_decks ?? 0 }) }); }
    catch { toast({ title: t('common.load_fail'), variant: 'destructive' }); }
    await fetchDecks();
  }, [fetchDecks, toast, t]);

  useEffect(() => { void fetchDecks(); }, [fetchDecks]);

  const toggleExpand = (id: number) => { const next = new Set(expanded); next.has(id) ? next.delete(id) : next.add(id); setExpanded(next); };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.name.endsWith('.json')) { toast({ title: t('common.upload_fail'), description: '仅支持 .json', variant: 'destructive' }); return; }
    setUploading(true);
    try {
      const content = await file.text();
      const resp = await fetch('/api/decks/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, content }) });
      const json = await resp.json();
      if (json.code === 0) { toast({ title: t('decks.uploaded', { name: file.name }) + ` (${json.data.total_decks} decks)` }); void fetchDecks(); }
      else toast({ title: json.message || t('decks.upload_fail'), variant: 'destructive' });
    } catch { toast({ title: t('decks.upload_fail'), variant: 'destructive' }); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };
  const handleEdit = async (df: DeckFile) => {
    try { const resp = await fetch(`/api/decks/file?name=${encodeURIComponent(df.filename)}`); const json = await resp.json(); if (json.code === 0) { setEditContent(json.data.content); setEditing(df); } else toast({ title: t('decks.read_fail'), variant: 'destructive' }); }
    catch { toast({ title: t('decks.read_error'), variant: 'destructive' }); }
  };
  const handleSaveEdit = async () => {
    if (!editing) return; setEditSaving(true);
    try { const resp = await fetch('/api/decks/file', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: editing.filename, content: editContent }) }); const json = await resp.json(); if (json.code === 0) { toast({ title: t('decks.saved') }); setEditing(null); void fetchDecks(); } else toast({ title: json.message || t('common.save_fail'), variant: 'destructive' }); }
    catch { toast({ title: t('common.save_fail'), variant: 'destructive' }); }
    finally { setEditSaving(false); }
  };
  const handleDelete = async (df: DeckFile) => {
    if (!(await dlg.confirm({ title: t('common.confirm_delete'), description: t('decks.confirm_delete', { title: df.title, filename: df.filename, count: df.entries.length }), destructive: true, confirmText: t('common.delete') }))) return;
    try { await fetch(`/api/decks/file/${encodeURIComponent(df.filename)}`, { method: 'DELETE' }); toast({ title: t('decks.deleted') }); void fetchDecks(); }
    catch { toast({ title: t('common.delete_fail'), variant: 'destructive' }); }
  };

  const totalPages = Math.max(1, Math.ceil(files.length / pageSize));
  const curPage = Math.min(page, totalPages);   // 删除后页码越界 → 钳到最后一页
  const pageItems = files.slice((curPage - 1) * pageSize, curPage * pageSize);

  return (
    <div className="space-y-6">
      {dlg.node}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><FolderKanban className="h-5 w-5" />{t('decks.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('decks.subtitle')}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={reloadDecks} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}</Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{t('decks.upload')}
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleUpload} className="hidden" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <FileJson className="h-12 w-12 mb-3" />
          <p className="text-lg mb-1">{t('decks.no_decks')}</p>
          <p className="text-sm">{t('decks.no_decks_hint')}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {pageItems.map((df) => {
              const isOpen = expanded.has(df.id);
              const brief = df.description || t('decks.no_brief');
              const hasNoDesc = !df.description;
              return (
                <Card key={df.id} className="overflow-hidden">
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-pink-200 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400">
                      <FileJson className="h-5 w-5" />
                    </span>
                    <button onClick={() => toggleExpand(df.id)} className="shrink-0 text-muted-foreground hover:text-foreground">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{df.title}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                        {df.author && <span>{df.author}</span>}
                        {df.version && <span>v{df.version}</span>}
                        {df.date && <span>{df.date}</span>}
                        <span>{df.filename}</span>
                        <span>({t('decks.entries_count', { count: df.entries.length })})</span>
                      </div>
                      <p className={`text-xs text-muted-foreground mt-1 truncate ${hasNoDesc ? 'italic opacity-50' : ''}`}>{brief}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(df)} title={t('common.edit')}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(df)} className="text-muted-foreground hover:text-destructive" title={t('common.delete')}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                  {isOpen && (
                    <div className="border-t px-4 py-3 bg-muted/30">
                      <div className="flex flex-wrap gap-2">
                        {df.entries.map((e) => (<span key={e} className="inline-flex items-center rounded-md bg-background border px-2 py-1 text-xs font-mono">{e}</span>))}
                        {df.entries.length === 0 && !df.hidden_entries?.length && <span className="text-xs text-muted-foreground">{t('decks.no_entries')}</span>}
                      </div>
                      {df.hidden_entries && df.hidden_entries.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-dashed">
                          {df.hidden_entries.map((e) => (<span key={e} className="inline-flex items-center rounded-md bg-background/50 border border-dashed px-2 py-1 text-xs font-mono text-muted-foreground">{e}</span>))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
          {totalPages > 1 && (
            <PaginationBar total={files.length} page={curPage} pageSize={pageSize}
              onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              label={`${files.length} 个牌堆`} />
          )}
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditing(null)}>
          <div className="bg-background rounded-lg shadow-xl w-[90vw] max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">{t('decks.edit_title', { title: editing.title })} <span className="text-xs text-muted-foreground font-normal ml-1">{editing.filename}</span></h2>
              <Button variant="ghost" size="icon" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
            </div>
            <textarea className="flex-1 min-h-[40vh] p-4 font-mono text-sm bg-muted/20 border-0 resize-none focus:outline-none" value={editContent} onChange={(e) => setEditContent(e.target.value)} spellCheck={false} />
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <Button variant="outline" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
              <Button onClick={handleSaveEdit} disabled={editSaving}>{editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('common.save')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DecksPage;
