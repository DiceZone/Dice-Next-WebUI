import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Scroll, Upload, Trash2, Pencil, Download, RefreshCw, Dices, Plus, Package, Info } from 'lucide-react';
import { RuleEditor } from './rule-editor';
import { PaginationBar } from '@/components/ui/pagination-bar';

// C#27：规则包 bundle（data/rulepacks/<包>/，含 pack.json + rules/helpdoc/lua/js）。
interface RuleBundle {
  name: string; folder: string; version: string; author: string; description: string;
  enabled: boolean; setKeys: string[];
  ruleFiles: number; cmdCount: number; helpdocEntries: number; luaMods: number; jsPlugins: number;
  ruleNames: string[]; helpdocFiles: string[]; luaNames: string[]; jsNames: string[];
}

interface RulePack {
  name: string; fullName: string; version: string; file: string; author: string;
  diceSides: number; setKeys: string[];
  aliasGroups: number; computedCount: number; manualCount: number; helpCount: number;
  customCmds: string[]; cmdAlias: { from: string; to: string }[]; disableCmds: string[];
  builtin: boolean; enabled: boolean; ownerBundle?: string; ownerBundleFolder?: string;
}

interface CompatRule {
  kind: 'js' | 'lua';
  name: string; title?: string; author: string; version: string; file: string;
  commandList: string[]; enabled: boolean; ownerBundle?: string; ownerBundleFolder?: string;
}

async function jsend(method: string, path: string, body?: unknown) {
  const r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json(); if (j.code !== 0) throw new Error(j.message); return j.data;
}

export const RulesPage: React.FC = () => {
  const { t } = useTranslation(); const toast = useToast();
  const [packs, setPacks] = useState<RulePack[]>([]);
  const [bundles, setBundles] = useState<RuleBundle[]>([]);
  const [compatRules, setCompatRules] = useState<CompatRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorFile, setEditorFile] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [confirmDelBundle, setConfirmDelBundle] = useState<RuleBundle | null>(null);
  const [detailBundle, setDetailBundle] = useState<RuleBundle | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try { const d = await jsend('GET', '/rules'); setPacks(d.packs || []); } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    try { const d = await jsend('GET', '/rulepacks'); setBundles(d.bundles || []); } catch { /* ignore */ }
    try {
      const r = await fetch('/api/plugins/js'); const j = await r.json();
      if (j.code === 0) setCompatRules((j.data as any[]).filter((p: any) => p.ruleCompat).map((p: any) => ({ kind: 'js' as const, name: p.name, author: p.author, version: p.version, file: p.file, commandList: p.commandList || [], enabled: p.enabled, ownerBundle: p.ownerBundle, ownerBundleFolder: p.ownerBundleFolder })));
    } catch { /* ignore */ }
    try {
      const r = await fetch('/api/mod/lua'); const j = await r.json();
      if (j.code === 0) setCompatRules((prev) => [...prev, ...(j.data as any[]).filter((p: any) => p.ruleCompat).map((p: any) => ({ kind: 'lua' as const, name: p.title || p.name, author: p.author, version: p.version, file: p.name, commandList: [], enabled: p.enabled, ownerBundle: p.ownerBundle, ownerBundleFolder: p.ownerBundleFolder }))]);
    } catch { /* ignore */ }
    setLoading(false);
  }, [toast]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) {
      try { const content = await f.text(); const d = await jsend('POST', '/rules/upload', { filename: f.name, content }); toast({ title: t('rules.imported', { n: d.loaded }) }); await loadAll(); }
      catch (err) { toast({ title: (err as Error).message, variant: 'destructive' }); }
    } if (fileRef.current) fileRef.current.value = '';
  };
  const exportPack = async (file: string) => {
    try { const d = await jsend('GET', `/rules/file?file=${encodeURIComponent(file)}`); const blob = new Blob([d.content], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = file.replace(/\.disabled$/, ''); a.click(); URL.revokeObjectURL(url); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };
  const toggle = async (p: RulePack) => {
    try { await jsend('POST', '/rules/toggle', { file: p.file, enabled: !p.enabled }); await loadAll(); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };
  const doDelete = async (file: string) => {
    try { await jsend('POST', '/rules/delete', { file }); setConfirmDel(null); await loadAll(); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };
  const toggleCompat = async (cr: CompatRule) => {
    try {
      if (cr.kind === 'js') await jsend('POST', '/plugins/js/toggle', { file: cr.file, enabled: !cr.enabled });
      else await jsend('POST', '/mod/lua/toggle', { name: cr.file, enabled: !cr.enabled });
      await loadAll();
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };
  // ── 规则包 bundle（C#27）──
  const onUploadZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      try {
        const content = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
        await jsend('POST', '/rulepacks/upload', { filename: f.name, content });
        toast({ title: t('rules.bundle_imported') }); await loadAll();
      } catch (err) { toast({ title: (err as Error).message, variant: 'destructive' }); }
    }
    if (zipRef.current) zipRef.current.value = '';
  };
  const toggleBundle = async (b: RuleBundle) => {
    try { await jsend('POST', '/rulepacks/toggle', { folder: b.folder, enabled: !b.enabled }); await loadAll(); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };
  const deleteBundle = async (b: RuleBundle) => {
    // D#11：先关闭确认框再等待后端热重载。规则包较大或带 JS/Lua 扩展时，重载不应让
    // 用户误以为删除确认框卡死。
    setConfirmDelBundle(null);
    try { await jsend('POST', '/rulepacks/delete', { folder: b.folder }); await loadAll(); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };

  // bundle 的规则/JS/Lua 由父包统一管理，不能再作为独立条目重复出现。
  const allItems = [...packs.filter((p) => !p.ownerBundle).map((p) => ({ type: 'pack' as const, data: p })), ...compatRules.filter((c) => !c.ownerBundle).map((c) => ({ type: 'compat' as const, data: c }))];
  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));
  const curPage = Math.min(page, totalPages);   // 删除后页码越界 → 钳到最后一页
  const pageItems = allItems.slice((curPage - 1) * pageSize, curPage * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Scroll className="h-5 w-5" />{t('rules.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('rules.desc')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={loadAll} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}</Button>
          <Button size="sm" variant="outline" onClick={() => zipRef.current?.click()}><Package className="mr-2 h-4 w-4" />{t('rules.import_bundle')}</Button>
          <input ref={zipRef} type="file" accept=".zip" className="hidden" onChange={onUploadZip} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />{t('rules.import')}</Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onUpload} />
          <Button size="sm" onClick={() => setEditorFile('')}><Plus className="mr-2 h-4 w-4" />{t('ruleed.new')}</Button>
        </div>
      </div>

      {/* C#27 规则包 bundle 区 */}
      {bundles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{t('rules.bundles_title')}</h2>
            <span className="text-xs text-muted-foreground">{t('rules.bundles_hint')}</span>
          </div>
          {bundles.map((b) => (
            <Card key={b.folder} className={b.enabled ? 'overflow-hidden border-primary/30' : 'opacity-60 overflow-hidden'}>
              <CardContent className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0"><Package className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{b.name}</span>
                    {b.version && <span className="text-xs text-muted-foreground">v{b.version}</span>}
                    {b.author && <span className="text-xs text-muted-foreground">{t('rules.by', { author: b.author })}</span>}
                    <Badge className="text-xs bg-primary/15 text-primary">{t('rules.bundle_badge')}</Badge>
                    {!b.enabled && <Badge variant="outline" className="text-xs">{t('rules.disabled')}</Badge>}
                  </div>
                  {b.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{b.description}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {b.setKeys.map((k) => <Badge key={k} variant="outline" className="font-mono">.set {k}</Badge>)}
                    <span>· {t('rules.bundle_stat', { rules: b.ruleFiles, cmds: b.cmdCount, help: b.helpdocEntries })}</span>
                    {(b.luaMods > 0 || b.jsPlugins > 0) && <span>· {t('rules.bundle_plugins', { lua: b.luaMods, js: b.jsPlugins })}</span>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" title={t('rules.bundle_contents')} onClick={() => setDetailBundle(b)}><Info className="h-4 w-4" /></Button>
                <Switch checked={b.enabled} onCheckedChange={() => toggleBundle(b)} title={t('rules.toggle')} />
                <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-destructive" title={t('common.delete')} onClick={() => setConfirmDelBundle(b)}><Trash2 className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {loading && <p className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</p>}

      {!loading && allItems.length === 0 && bundles.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t('rules.empty')}</p>}

      {!loading && allItems.length > 0 && (
        <>
          <div className="space-y-2">
            {pageItems.map((item) => {
              if (item.type === 'pack') {
                const p = item.data as RulePack;
                return (
          <Card key={p.file} className={p.enabled ? 'overflow-hidden' : 'opacity-60 overflow-hidden'}>
            <CardContent className="flex items-center gap-3 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0"><Dices className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{p.fullName || p.name}</span>
                  {p.version && <span className="text-xs text-muted-foreground">v{p.version}</span>}
                  {p.author && <span className="text-xs text-muted-foreground">{t('rules.by', { author: p.author })}</span>}
                  {p.builtin ? <Badge variant="secondary" className="text-xs">{t('rules.builtin')}</Badge> : <Badge className="text-xs">{t('rules.imported_badge')}</Badge>}
                  {!p.enabled && <Badge variant="outline" className="text-xs">{t('rules.disabled')}</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {p.setKeys.map((k) => <Badge key={k} variant="outline" className="font-mono">.set {k}</Badge>)}
                  <span>· d{p.diceSides || '?'}</span>
                  <span>· {t('rules.stat', { alias: p.aliasGroups, computed: p.computedCount, manual: p.manualCount })}</span>
                  {p.helpCount > 0 && <span>· {t('rules.help_count', { n: p.helpCount })}</span>}
                </div>
                {(p.customCmds.length > 0 || p.cmdAlias.length > 0 || p.disableCmds.length > 0) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {p.customCmds.map((c) => <Badge key={'c' + c} variant="secondary" className="font-mono text-[11px]">.{c}</Badge>)}
                    {p.cmdAlias.map((a) => <Badge key={'a' + a.from} variant="outline" className="font-mono text-[11px]">.{a.from}→.{a.to}</Badge>)}
                    {p.disableCmds.map((d) => <Badge key={'d' + d} variant="outline" className="font-mono text-[11px] line-through opacity-70">.{d}</Badge>)}
                  </div>
                )}
              </div>
              <Switch checked={p.enabled} onCheckedChange={() => toggle(p)} title={t('rules.toggle')} />
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" title={t('rules.edit')} onClick={() => setEditorFile(p.file)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" title={t('rules.export')} onClick={() => exportPack(p.file)}><Download className="h-4 w-4" /></Button>
              {!p.builtin && <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-destructive" title={t('common.delete')} onClick={() => setConfirmDel(p.file)}><Trash2 className="h-4 w-4" /></Button>}
            </CardContent>
          </Card>
              );
            }
            const cr = item.data as CompatRule;
            const langBadge = cr.kind === 'js' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
            return (
              <Card key={cr.kind + '/' + cr.file} className={cr.enabled ? 'overflow-hidden' : 'opacity-60 overflow-hidden'}>
                <CardContent className="flex items-center gap-3 py-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-md shrink-0 ${langBadge}`}>
                    <span className="font-mono font-bold text-xs">{cr.kind === 'js' ? '{js}' : '{lua}'}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{cr.name}</span>
                      {cr.version && <span className="text-xs text-muted-foreground">v{cr.version}</span>}
                      {cr.author && <span className="text-xs text-muted-foreground">{t('rules.by', { author: cr.author })}</span>}
                      <Badge className={cr.kind === 'js' ? 'bg-violet-500/15 text-violet-700 dark:text-violet-400 text-xs' : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 text-xs'}>{cr.kind === 'js' ? t('modules.rule_compat') : t('rules.lua_compat_badge')}</Badge>
                      {!cr.enabled && <Badge variant="outline" className="text-xs">{t('rules.disabled')}</Badge>}
                    </div>
                    {cr.commandList && cr.commandList.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {cr.commandList.slice(0, 12).map((c) => <Badge key={c} variant="outline" className="font-mono text-[10px] px-1 py-0 font-normal">{c}</Badge>)}
                        {cr.commandList.length > 12 && <span className="text-[10px] text-muted-foreground">+{cr.commandList.length - 12}</span>}
                      </div>
                    ) : (
                      <p className="mt-1 text-[10px] text-muted-foreground italic opacity-50">{t('modules.no_commands')}</p>
                    )}
                  </div>
                  <Switch checked={cr.enabled} onCheckedChange={() => toggleCompat(cr)} title={t('rules.toggle')} />
                </CardContent>
              </Card>
            );
          })}
        </div>
        {totalPages > 1 && (
          <PaginationBar total={allItems.length} page={curPage} pageSize={pageSize}
            onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            label={`${allItems.length} 项`} />
        )}
      </>
    )}

      {editorFile !== null && <RuleEditor file={editorFile} onClose={() => setEditorFile(null)} onSaved={() => { setEditorFile(null); void loadAll(); }} />}
      {confirmDel && (
        <Dialog open onOpenChange={(o) => { if (!o) setConfirmDel(null); }}>
          <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>{t('rules.delete_confirm', { file: confirmDel })}</DialogTitle></DialogHeader>
          <DialogFooter className="gap-2"><Button variant="ghost" size="sm" onClick={() => setConfirmDel(null)}>{t('common.cancel')}</Button><Button variant="destructive" size="sm" onClick={() => doDelete(confirmDel)}>{t('common.delete')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {detailBundle && (
        <Dialog open onOpenChange={(o) => { if (!o) setDetailBundle(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t('rules.bundle_contents_title', { name: detailBundle.name })}</DialogTitle></DialogHeader>
            <div className="space-y-4 text-sm">
              {detailBundle.description && <p className="text-muted-foreground whitespace-pre-wrap">{detailBundle.description}</p>}
              {([
                [t('rules.bundle_rules'), detailBundle.ruleNames],
                [t('rules.bundle_helpdocs'), detailBundle.helpdocFiles],
                ['Lua', detailBundle.luaNames],
                ['JavaScript', detailBundle.jsNames],
              ] as [string, string[]][]).map(([label, values]) => (
                <div key={label}><p className="mb-1 font-medium">{label}（{values?.length || 0}）</p>
                  {values?.length ? <div className="flex flex-wrap gap-1.5">{values.map((v) => <Badge key={v} variant="outline" className="font-mono text-xs">{v}</Badge>)}</div> : <p className="text-xs text-muted-foreground">—</p>}
                </div>
              ))}
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setDetailBundle(null)}>{t('common.close')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {confirmDelBundle && (
        <Dialog open onOpenChange={(o) => { if (!o) setConfirmDelBundle(null); }}>
          <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>{t('rules.bundle_delete_confirm', { name: confirmDelBundle.name })}</DialogTitle></DialogHeader>
          <DialogFooter className="gap-2"><Button variant="ghost" size="sm" onClick={() => setConfirmDelBundle(null)}>{t('common.cancel')}</Button><Button variant="destructive" size="sm" onClick={() => deleteBundle(confirmDelBundle)}>{t('common.delete')}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
