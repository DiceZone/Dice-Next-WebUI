import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { HelpCircle, Plus, Pencil, Eye, RotateCcw, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, Download, Upload, List, FolderTree, ChevronDown, ChevronRight as ChevR } from 'lucide-react';

interface HelpEntry {
  key: string; content: string; source: string;   // builtin | rule:<pack> | plugin:<name> | lua:<mod> | file:<name>
  i18nKey?: string; editable: boolean;
}
type Kind = 'builtin' | 'rule' | 'plugin' | 'lua' | 'helpdoc' | 'file';
const kindOf = (s: string): Kind =>
  s === 'builtin' ? 'builtin'
    : s.startsWith('rule:') ? 'rule'
    : s.startsWith('file:') ? 'file'
    : s.startsWith('lua:') ? 'lua'
    : s.startsWith('helpdoc:') ? 'helpdoc'
    : 'plugin';

const PAGE_SIZE = 30;

async function jget(path: string) {
  const r = await fetch('/api' + path); const j = await r.json();
  if (j.code !== 0) throw new Error(j.message); return j.data;
}
async function jsend(method: string, path: string, body?: unknown) {
  const r = await fetch('/api' + path, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json(); if (j.code !== 0) throw new Error(j.message); return j.data;
}

// 编辑器状态：mode 决定保存去向。
interface EditState { mode: 'new' | 'file' | 'builtin' | 'view'; key: string; i18nKey?: string; content: string; source: string; }

export const HelpDocsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [entries, setEntries] = useState<HelpEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  // 视图模式：flat=条目平铺(分页) / grouped=按来源(规则/插件/文件)分组，展开看全部条目。
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('grouped');   // C#41: 默认按来源分组展示
  const [groups, setGroups] = useState<{ source: string; count: number }[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [groupEntries, setGroupEntries] = useState<HelpEntry[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);

  // 搜索防抖（300ms）→ 重置到第 1 页。
  useEffect(() => {
    const h = setTimeout(() => { setQDebounced(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(h);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lang: i18n.language, q: qDebounced, page: String(page), size: String(PAGE_SIZE),
      });
      const d = await jget('/help?' + params.toString());
      setEntries(d.entries || []); setTotal(d.total || 0);
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [toast, i18n.language, qDebounced, page]);
  useEffect(() => { if (viewMode === 'flat') void load(); }, [load, viewMode]);

  // 分组视图：加载来源分组（搜索同样作用于分组）。
  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ lang: i18n.language, q: qDebounced });
      const d = await jget('/help/groups?' + params.toString());
      setGroups(d.groups || []);
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [toast, i18n.language, qDebounced]);
  useEffect(() => { if (viewMode === 'grouped') { setExpanded(null); void loadGroups(); } }, [loadGroups, viewMode]);

  // 展开某来源 → 拉取该来源全部条目（带当前搜索词）。
  const toggleExpand = async (source: string) => {
    if (expanded === source) { setExpanded(null); return; }
    setExpanded(source); setGroupEntries([]); setGroupLoading(true);
    try {
      const params = new URLSearchParams({ lang: i18n.language, q: qDebounced, source, page: '1', size: '200' });
      const d = await jget('/help?' + params.toString());
      setGroupEntries(d.entries || []);
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setGroupLoading(false); }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // 删除后当前页可能越界（服务端分页返回空列表）→ 钳制到最后一页，而不是显示空白。
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const sourceLabel = (source: string) => {
    const k = kindOf(source);
    return k === 'builtin' ? t('helpdoc.src_builtin')
      : k === 'rule' ? t('helpdoc.src_rule', { name: source.slice(5) })
      : k === 'file' ? t('helpdoc.src_file')
      : k === 'lua' ? t('helpdoc.src_lua', { name: source.slice(4) })
      : k === 'helpdoc' ? t('helpdoc.src_helpdoc', { name: source.slice(8) })
      : t('helpdoc.src_plugin', { name: source.slice(7) });
  };
  const sourceBadge = (e: HelpEntry) => {
    const k = kindOf(e.source);
    const label = sourceLabel(e.source);
    const variant = k === 'builtin' ? 'secondary' : k === 'file' ? 'default' : 'outline';
    return <Badge variant={variant as 'secondary' | 'default' | 'outline'} className="text-[11px] shrink-0 max-w-[45vw] truncate">{label}</Badge>;
  };

  const openEdit = (e: HelpEntry) => {
    const k = kindOf(e.source);
    if (k === 'builtin') setEdit({ mode: 'builtin', key: e.key, i18nKey: e.i18nKey, content: e.content, source: e.source });
    else if (k === 'file') setEdit({ mode: 'file', key: e.source.slice(5), content: e.content, source: e.source });
    else setEdit({ mode: 'view', key: e.key, content: e.content, source: e.source });
  };

  const save = async () => {
    if (!edit) return;
    if ((edit.mode === 'new' || edit.mode === 'file') && !edit.key.trim()) {
      toast({ title: t('helpdoc.need_name'), variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      if (edit.mode === 'builtin') await jsend('PUT', '/templates', { locale: i18n.language, key: edit.i18nKey, value: edit.content });
      else await jsend('POST', '/help/file', { name: edit.key.trim(), content: edit.content });
      toast({ title: t('common.save_success') }); setEdit(null); await load();
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const resetBuiltin = async (e: HelpEntry) => {
    try { await jsend('DELETE', `/templates/${encodeURIComponent(i18n.language)}/${encodeURIComponent(e.i18nKey || '')}`); toast({ title: t('helpdoc.reset_done') }); await load(); }
    catch (err) { toast({ title: (err as Error).message, variant: 'destructive' }); }
  };
  const delFile = async (name: string) => {
    try { await jsend('DELETE', `/help/file/${encodeURIComponent(name)}`); setConfirmDel(null); toast({ title: t('helpdoc.deleted') }); await load(); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };
  // C#26#6 导出：把自管帮助文档（data/help/*.md）打成一个 JSON {名:内容} 下载。
  const exportDocs = async () => {
    try {
      const d = await jget('/help/files');
      const files: { name: string }[] = d.files || [];
      if (files.length === 0) { toast({ title: t('helpdoc.export_empty') }); return; }
      const bundle: Record<string, string> = {};
      for (const f of files) { const fd = await jget('/help/file?name=' + encodeURIComponent(f.name)); bundle[f.name] = fd.content || ''; }
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = 'helpdocs-export.json'; a.click(); URL.revokeObjectURL(url);
      toast({ title: t('helpdoc.export_done', { n: files.length }) });
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };
  // C#26#6 导入：.json（{名:内容} 批量）或单个 .md（文件名作条目名）→ 写入 data/help/。
  const importDocs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      try {
        const text = await f.text();
        let count = 0;
        if (f.name.toLowerCase().endsWith('.json')) {
          const obj = JSON.parse(text);
          const map: Record<string, string> = Array.isArray(obj)
            ? Object.fromEntries(obj.map((it: any) => [it.name || it.key, it.content]))
            : obj;
          for (const [name, content] of Object.entries(map))
            if (name && typeof content === 'string') { await jsend('POST', '/help/file', { name, content }); count++; }
        } else {
          const name = f.name.replace(/\.(md|txt)$/i, '');
          await jsend('POST', '/help/file', { name, content: text }); count = 1;
        }
        toast({ title: t('helpdoc.import_done', { n: count }) }); await load();
      } catch (err) { toast({ title: (err as Error).message, variant: 'destructive' }); }
    }
    if (importRef.current) importRef.current.value = '';
  };

  const renderEntry = (e: HelpEntry, showBadge = true) => {
    const k = kindOf(e.source);
    return (
      <Card key={e.source + '|' + e.key}>
        <CardContent className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-sm font-medium truncate">.{e.key}</span>
              {showBadge && sourceBadge(e)}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.content}</p>
          </div>
          {(k === 'builtin' || k === 'file') ? (
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title={t('helpdoc.edit')} onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
          ) : (
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title={t('helpdoc.view')} onClick={() => openEdit(e)}><Eye className="h-4 w-4" /></Button>
          )}
          {k === 'builtin' && <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title={t('helpdoc.reset')} onClick={() => resetBuiltin(e)}><RotateCcw className="h-4 w-4" /></Button>}
          {k === 'file' && <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" title={t('common.delete')} onClick={() => setConfirmDel(e.source.slice(5))}><Trash2 className="h-4 w-4" /></Button>}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <PageHeader icon={HelpCircle} title={t('helpdoc.title')} description={t('helpdoc.desc')} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="h-9 pl-8" placeholder={t('helpdoc.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={() => setViewMode((m) => (m === 'flat' ? 'grouped' : 'flat'))} title={viewMode === 'flat' ? t('helpdoc.view_grouped') : t('helpdoc.view_flat')}>
          {viewMode === 'flat' ? <FolderTree className="mr-2 h-4 w-4" /> : <List className="mr-2 h-4 w-4" />}
          {viewMode === 'flat' ? t('helpdoc.view_grouped') : t('helpdoc.view_flat')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => (viewMode === 'grouped' ? loadGroups() : load())} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
        </Button>
        <Button size="sm" variant="outline" onClick={exportDocs} title={t('helpdoc.export')}><Download className="mr-2 h-4 w-4" />{t('helpdoc.export')}</Button>
        <Button size="sm" variant="outline" onClick={() => importRef.current?.click()} title={t('helpdoc.import')}><Upload className="mr-2 h-4 w-4" />{t('helpdoc.import')}</Button>
        <input ref={importRef} type="file" accept=".json,.md,.txt" className="hidden" onChange={importDocs} />
        <Button size="sm" onClick={() => setEdit({ mode: 'new', key: '', content: '', source: 'file:' })}>
          <Plus className="mr-2 h-4 w-4" />{t('helpdoc.new')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {viewMode === 'grouped' ? t('helpdoc.group_count', { n: groups.length }) : t('helpdoc.count', { total })}
      </p>

      {/* 平铺视图 */}
      {viewMode === 'flat' && (<>
        <div className="grid gap-2">
          {entries.map((e) => renderEntry(e))}
          {entries.length === 0 && !loading && <p className="py-8 text-center text-sm text-muted-foreground">{t('helpdoc.empty')}</p>}
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-xs text-muted-foreground tabular-nums">{t('helpdoc.page_of', { page, total: pageCount })}</span>
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= pageCount || loading} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        )}
      </>)}

      {/* 分组视图：按来源（规则/插件/文件）折叠，展开看全部条目 */}
      {viewMode === 'grouped' && (
        <div className="grid gap-1.5">
          {groups.map((g) => {
            const open = expanded === g.source;
            return (
              <Card key={g.source} className="overflow-hidden">
                <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40" onClick={() => toggleExpand(g.source)}>
                  {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevR className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{sourceLabel(g.source)}</span>
                  <Badge variant="secondary" className="shrink-0 text-[11px]">{t('helpdoc.group_entries', { n: g.count })}</Badge>
                </button>
                {open && (
                  <div className="border-t bg-muted/20 p-1.5">
                    {groupLoading ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">{t('common.loading')}</p>
                    ) : (
                      <div className="grid gap-1.5">
                        {groupEntries.map((e) => renderEntry(e, false))}
                        {g.count > groupEntries.length && !groupLoading && <p className="px-2 py-1 text-[11px] text-muted-foreground">{t('helpdoc.group_more', { n: g.count - groupEntries.length })}</p>}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          {groups.length === 0 && !loading && <p className="py-8 text-center text-sm text-muted-foreground">{t('helpdoc.empty')}</p>}
        </div>
      )}

      {edit && (
        <Dialog open onOpenChange={(o) => { if (!o) setEdit(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>
              {edit.mode === 'new' ? t('helpdoc.new') : edit.mode === 'view' ? t('helpdoc.view') : t('helpdoc.edit')}
            </DialogTitle></DialogHeader>
            <div className="space-y-3">
              {(edit.mode === 'new' || edit.mode === 'file') ? (
                <div>
                  <label className="text-xs text-muted-foreground">{t('helpdoc.name')}</label>
                  <Input className="h-8 text-sm" value={edit.key} disabled={edit.mode === 'file'}
                    placeholder={t('helpdoc.name_ph')} onChange={(ev) => setEdit({ ...edit, key: ev.target.value })} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground font-mono break-all">.{edit.key} · {edit.source}</p>
              )}
              <Textarea className="text-sm h-[45vh] font-mono" value={edit.content} readOnly={edit.mode === 'view'}
                spellCheck={false} onChange={(ev) => setEdit({ ...edit, content: ev.target.value })} />
              {edit.mode === 'view' && <p className="text-xs text-muted-foreground">{t('helpdoc.readonly_hint')}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEdit(null)}>{edit.mode === 'view' ? t('common.close') : t('common.cancel')}</Button>
              {edit.mode !== 'view' && <Button size="sm" onClick={save} disabled={saving}>{t('common.save')}</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {confirmDel && (
        <Dialog open onOpenChange={(o) => { if (!o) setConfirmDel(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{t('helpdoc.delete_confirm', { name: confirmDel })}</DialogTitle></DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDel(null)}>{t('common.cancel')}</Button>
              <Button variant="destructive" size="sm" onClick={() => delFile(confirmDel)}>{t('common.delete')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default HelpDocsPage;
