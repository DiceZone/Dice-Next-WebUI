import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import {
  Puzzle, Upload, RefreshCw, Trash2, Settings2, Info, ArrowUpCircle,
  ExternalLink, Download, Database,
} from 'lucide-react';
import { PaginationBar } from '@/components/ui/pagination-bar';

interface PluginConfig {
  ext: string; key: string; type: string;
  default: string; description: string; value: string; options?: string[];
}
interface Plugin {
  kind: 'js' | 'lua';
  name: string; title?: string; author: string; version: string; file: string;
  description: string; lang: string; homepage: string; updateUrl: string; license: string;
  commandList: string[]; superseded: boolean; supersededBy: string;
  commands: number; enabled: boolean; configs: PluginConfig[];
  ruleCompat?: boolean; inMod?: boolean;
  ownerBundle?: string; ownerBundleFolder?: string;
  replies?: number; scripts?: number; singleFile?: boolean;
  // Lua mod：真实指令触发词（{trigger,kind}）与帮助词条分开展示。
  luaCommands?: { trigger: string; kind: string }[]; helpTopics?: string[];
}

interface UpdateState { latest?: string; hasUpdate?: boolean; error?: string; checking?: boolean }

async function jsend(method: string, path: string, body?: unknown) {
  const r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json(); if (j.code !== 0) throw new Error(j.message); return j.data;
}

// ── Config editor ────────────────────────────────────────
const ConfigDialog: React.FC<{ plugin: Plugin; onClose: () => void; onSaved: () => void }> = ({ plugin, onClose, onSaved }) => {
  const { t } = useTranslation(); const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const c of plugin.configs) {
      if (c.type === 'template') { try { const arr = JSON.parse(c.value || '[]'); o[c.key] = Array.isArray(arr) ? arr.join('\n') : c.value; } catch { o[c.key] = c.value; } }
      else o[c.key] = c.value;
    } return o;
  });
  const save = async () => {
    setSaving(true);
    try {
      const items = plugin.configs.map((c) => {
        let value = form[c.key] ?? ''; if (c.type === 'template') value = JSON.stringify(value.split('\n').filter((s) => s.length > 0));
        return { ext: c.ext, key: c.key, value };
      });
      await jsend('POST', '/plugins/js/config', { items });
      toast({ title: t('modules.config_saved') }); onSaved(); onClose();
    } catch (e) { toast({ title: t('common.operation_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('modules.config_title', { name: plugin.name })}</DialogTitle><DialogDescription>{t('modules.config_desc')}</DialogDescription></DialogHeader>
        <div className="space-y-4 py-2">
          {plugin.configs.map((c) => (
            <div key={c.key} className="space-y-1.5">
              <Label className="text-sm font-medium">{c.key}</Label>
              {c.description && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{c.description}</p>}
              {c.type === 'bool' ? (
                <div className="flex items-center gap-2">
                  <Switch checked={form[c.key] === '1' || form[c.key] === 'true'} onCheckedChange={(v) => setForm((f) => ({ ...f, [c.key]: v ? '1' : '0' }))} />
                  <span className="text-xs text-muted-foreground">{form[c.key] === '1' || form[c.key] === 'true' ? t('common.enabled') : t('common.disabled')}</span>
                </div>
              ) : c.type === 'option' && c.options ? (
                <Select value={form[c.key]} onValueChange={(v) => setForm((f) => ({ ...f, [c.key]: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{c.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                </Select>
              ) : c.type === 'template' ? (
                <Textarea rows={4} value={form[c.key]} onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))} placeholder={t('modules.template_hint')} className="font-mono text-xs" />
              ) : (
                <Input type={c.type === 'int' || c.type === 'float' ? 'number' : 'text'} value={form[c.key]} onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))} />
              )}
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button><Button onClick={save} disabled={saving}>{t('common.save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Stored-data panel ─────────────────────────────────────
const StoragePanel: React.FC<{ name: string; file: string }> = ({ name, file }) => {
  const { t } = useTranslation(); const toast = useToast();
  const [entries, setEntries] = useState<{ key: string; fullKey: string; value: string }[] | null>(null);
  const [loading, setLoading] = useState(false); const [open, setOpen] = useState(false); const [confirmClear, setConfirmClear] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await jsend('GET', `/plugins/js/storage?file=${encodeURIComponent(file)}`); setEntries(d.entries || []); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [file, toast]);
  const toggle = () => { const n = !open; setOpen(n); if (n && entries === null) load(); };
  const exportJson = () => {
    const obj: Record<string, string> = {}; (entries || []).forEach((e) => { obj[e.fullKey] = e.value; });
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${name}-storage.json`; a.click(); URL.revokeObjectURL(url);
  };
  const clear = async () => {
    try { const d = await jsend('POST', '/plugins/js/storage/clear', { file }); toast({ title: t('modules.storage_cleared', { n: d.removed }) }); setEntries([]); setConfirmClear(false); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };
  return (
    <div className="pt-1">
      <button type="button" onClick={toggle} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><Database className="h-3.5 w-3.5" />{t('modules.storage_title')}{entries && <span className="text-xs">（{entries.length}）</span>}</button>
      {open && (
        <div className="mt-2 space-y-2">
          {loading && <p className="text-xs text-muted-foreground">{t('common.loading')}</p>}
          {!loading && entries && entries.length === 0 && <p className="text-xs text-muted-foreground">{t('modules.storage_empty')}</p>}
          {!loading && entries && entries.length > 0 && (
            <>
              <div className="max-h-48 overflow-y-auto rounded-md border"><table className="rt w-full text-xs"><tbody>{entries.map((e) => (<tr key={e.fullKey} className="border-b last:border-0 align-top"><td data-label={t('players.col_key')} className="w-1/3 break-all p-1.5 font-mono text-muted-foreground">{e.key}</td><td data-label={t('players.col_value')} className="break-all p-1.5 font-mono">{e.value}</td></tr>))}</tbody></table></div>
              <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={exportJson}><Download className="mr-2 h-4 w-4" />{t('modules.storage_export')}</Button>
                {confirmClear ? (<><Button variant="destructive" size="sm" onClick={clear}>{t('modules.storage_clear_confirm')}</Button><Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>{t('common.cancel')}</Button></>) : (<Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmClear(true)}><Trash2 className="mr-2 h-4 w-4" />{t('modules.storage_clear')}</Button>)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Detail view ───────────────────────────────────────────
const DetailDialog: React.FC<{ plugin: Plugin; update?: UpdateState; onClose: () => void; onCheck: () => void; onUpdate: () => void }> = ({ plugin, update, onClose, onCheck, onUpdate }) => {
  const { t } = useTranslation();
  const row = (label: string, value: React.ReactNode) => value ? (<div className="flex gap-3 text-sm"><span className="w-20 shrink-0 text-muted-foreground">{label}</span><span className="min-w-0 break-words">{value}</span></div>) : null;
  const langBadge = plugin.kind === 'js' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600';
  const LangIcon = plugin.kind === 'js' ? () => <span className="font-mono font-bold text-xs">{'{js}'}</span> : () => <span className="font-mono font-bold text-xs">{'{lua}'}</span>;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-md shrink-0 ${langBadge}`}><LangIcon /></span>{plugin.name}</DialogTitle></DialogHeader>
        <div className="space-y-2 py-1">
          {row(t('modules.detail_version'), update?.hasUpdate ? <span>{plugin.version} <span className="text-amber-600 dark:text-amber-400">→ {update.latest}（{t('modules.has_update')}）</span></span> : (plugin.version || '-'))}
          {row(t('modules.by'), plugin.author)}
          {row(t('modules.detail_lang'), plugin.lang?.toUpperCase() || (plugin.kind === 'js' ? 'JS' : 'LUA'))}
          {row(t('modules.detail_license'), plugin.license)}
          {row(t('modules.detail_file'), <span className="font-mono text-xs">{plugin.file.replace(/\.disabled$/, '')}</span>)}
          {row(t('modules.detail_homepage'), plugin.homepage ? <a href={plugin.homepage} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">{plugin.homepage}<ExternalLink className="h-3 w-3" /></a> : null)}
          {row(t('modules.detail_update_url'), plugin.updateUrl ? <span className="font-mono text-xs break-all">{plugin.updateUrl}</span> : null)}
          {plugin.description && (<div className="pt-1"><p className="mb-1 text-sm text-muted-foreground">{t('modules.detail_desc')}</p><p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs leading-relaxed">{plugin.description}</p></div>)}
          <div className="pt-1"><p className="mb-1 text-sm text-muted-foreground">{t('modules.detail_commands')}（{plugin.commandList?.length || 0}）{plugin.kind === 'lua' && plugin.luaCommands && plugin.luaCommands.length > 0 && <span className="ml-1 text-[10px] text-muted-foreground">{t('luamod.cmd_hint')}</span>}</p>
            {plugin.kind === 'lua' && plugin.luaCommands ? (
              plugin.luaCommands.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {plugin.luaCommands.map((c) => (
                    <div key={c.kind + c.trigger} className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">{c.trigger}</Badge>
                      <span className="text-[10px] text-muted-foreground">{t(`luamod.kind_${c.kind}`)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">{t('modules.detail_no_commands')}</p>
            ) : (
              plugin.commandList && plugin.commandList.length > 0 ? (<div className="flex flex-wrap gap-1.5">{plugin.commandList.map((c) => <Badge key={c} variant="secondary" className="font-mono text-xs">{c}</Badge>)}</div>) : <p className="text-xs text-muted-foreground">{t('modules.detail_no_commands')}</p>
            )}
          </div>
          {plugin.kind === 'lua' && plugin.helpTopics && plugin.helpTopics.length > 0 && (
            <div className="pt-1"><p className="mb-1 text-sm text-muted-foreground">{t('luamod.help_topics')}（{plugin.helpTopics.length}）<span className="ml-1 text-[10px] text-muted-foreground">{t('luamod.help_hint')}</span></p>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto rounded-md bg-muted/30 p-1.5">
                {plugin.helpTopics.slice(0, 200).map((h) => <Badge key={h} variant="outline" className="font-mono text-[10px] px-1 py-0 font-normal">{h}</Badge>)}
                {plugin.helpTopics.length > 200 && <span className="text-[10px] text-muted-foreground self-center">+{plugin.helpTopics.length - 200}</span>}
              </div>
            </div>
          )}
          <StoragePanel name={plugin.name} file={plugin.file.replace(/\.disabled$/, '')} />
          {update?.error && <p className="text-xs text-destructive">{update.error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {plugin.updateUrl && (<Button variant="outline" size="sm" onClick={onCheck} disabled={update?.checking}><RefreshCw className={`mr-2 h-4 w-4 ${update?.checking ? 'animate-spin' : ''}`} />{t('modules.check_update')}</Button>)}
          {update?.hasUpdate && (<Button size="sm" onClick={onUpdate}><ArrowUpCircle className="mr-2 h-4 w-4" />{t('modules.update_now')}</Button>)}
          <Button variant="ghost" size="sm" onClick={onClose}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Plugin Card ───────────────────────────────────────────
const PluginCard: React.FC<{
  p: Plugin; up?: UpdateState; busy: boolean;
  onToggle: () => void; onDelete: () => void; onConfig: () => void; onDetail: () => void; onUpdate?: () => void;
}> = ({ p, up, busy, onToggle, onDelete, onConfig, onDetail, onUpdate }) => {
  const { t } = useTranslation();
  const inactive = !p.enabled || p.superseded;
  const langBadge = p.kind === 'js' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
  return (
    <Card className={inactive ? 'opacity-60 overflow-hidden' : 'overflow-hidden'}>
      <CardContent className="flex items-center gap-3 py-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${langBadge}`}>
          <span className="font-mono font-bold text-sm">{p.kind === 'js' ? '{js}' : '{lua}'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{p.name}</span>
            {p.version && <span className="text-xs text-muted-foreground">v{p.version}</span>}
            {p.author && <span className="text-xs text-muted-foreground">{t('modules.by')} {p.author}</span>}
            {up?.hasUpdate && <Badge variant="warning" className="text-xs">{t('modules.new_version', { v: up.latest })}</Badge>}
            {p.ruleCompat && <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-400 text-xs">{t('modules.rule_compat')}</Badge>}
            {p.superseded && <Badge variant="outline" className="text-xs">{t('modules.superseded', { v: p.supersededBy })}</Badge>}
            {!p.enabled && !p.superseded && <Badge variant="outline" className="text-xs">{t('modules.disabled')}</Badge>}
          </div>
          {p.description ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.description}</p>
          ) : (
            <p className="mt-0.5 truncate text-xs text-muted-foreground italic opacity-50">{t('modules.no_desc')}</p>
          )}
          {p.commandList && p.commandList.length > 0 ? (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {p.commandList.slice(0, 12).map((c) => <Badge key={c} variant="outline" className="font-mono text-[10px] px-1 py-0 font-normal">{c}</Badge>)}
              {p.commandList.length > 12 && <span className="text-[10px] text-muted-foreground">+{p.commandList.length - 12}</span>}
              {p.helpTopics && p.helpTopics.length > 0 && <span className="text-[10px] text-muted-foreground">· {t('luamod.help_count', { n: p.helpTopics.length })}</span>}
            </div>
          ) : p.helpTopics && p.helpTopics.length > 0 ? (
            <p className="mt-1 text-[10px] text-muted-foreground">{t('luamod.help_only', { n: p.helpTopics.length })}</p>
          ) : (
            <p className="mt-1 text-[10px] text-muted-foreground italic opacity-50">{t('modules.no_commands')}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {up?.hasUpdate && onUpdate && (
            <Button variant="ghost" size="icon" className="h-9 w-9 text-amber-600 dark:text-amber-400" title={t('modules.update_now')} onClick={onUpdate} disabled={busy}><ArrowUpCircle className="h-4 w-4" /></Button>
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" title={t('modules.details')} onClick={onDetail}><Info className="h-4 w-4" /></Button>
          {!inactive && p.configs && p.configs.length > 0 && (
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" title={t('modules.config')} onClick={onConfig} disabled={busy}><Settings2 className="h-4 w-4" /></Button>
          )}
          {!p.superseded && <Switch checked={p.enabled} onCheckedChange={onToggle} disabled={busy} />}
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={onDelete} disabled={busy}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const ModulesPage: React.FC = () => {
  const { t } = useTranslation(); const toast = useToast();
  const dlg = useDialogs(t);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [configPlugin, setConfigPlugin] = useState<Plugin | null>(null);
  const [detailPlugin, setDetailPlugin] = useState<Plugin | null>(null);
  const [updates, setUpdates] = useState<Record<string, UpdateState>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);
  const [tab, setTab] = useState<'js' | 'lua'>('js');   // JS 插件 / Lua 模组 分开显示

  const loadAll = useCallback(async () => {
    setLoading(true);
    const all: Plugin[] = [];
    try { const d = await jsend('GET', '/plugins/js'); (Array.isArray(d) ? d : []).forEach((p: any) => all.push({ ...p, kind: 'js' as const, name: p.name, file: p.file, lang: p.lang || 'js' })); } catch { /* ignore */ }
    try { const d = await jsend('GET', '/mod/lua'); (Array.isArray(d) ? d : []).forEach((m: any) => { const cmds = (m.commands || []) as { trigger: string; kind: string }[]; all.push({ ...m, kind: 'lua' as const, name: m.title || m.name, file: m.name, lang: 'lua', description: m.brief || '', commandList: cmds.map((c) => c.trigger), luaCommands: cmds, helpTopics: m.helpTopics || [], configs: [], updateUrl: '', homepage: '', license: '', superseded: false, supersededBy: '', commands: cmds.length }); }); } catch { /* ignore */ }
    // 规则包内插件跟随父包启停，在插件页隐藏，避免出现无法独立管理的重复卡片。
    const standalone = all.filter((p) => !p.ownerBundle);
    standalone.sort((a, b) => a.name.localeCompare(b.name));
    setPlugins(standalone); setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const reload = async () => {
    setBusy(true);
    try {
      let n = 0;
      try { const d = await jsend('POST', '/plugins/js/reload'); n += d.loaded ?? 0; } catch { /* ignore */ }
      try { const d = await jsend('POST', '/mod/lua/reload'); n += (Array.isArray(d) ? d.length : 0); } catch { /* ignore */ }
      toast({ title: t('modules.reloaded', { n }) }); await loadAll();
    } catch (e) { toast({ title: t('common.operation_fail'), description: String(e), variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const onPickFile = () => fileRef.current?.click();
  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setBusy(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'js') {
        const content = await file.text();
        await jsend('POST', '/plugins/js/upload', { filename: file.name, content });
        toast({ title: t('modules.uploaded', { name: file.name }) });
      } else if (ext === 'lua' || ext === 'zip' || ext === 'json') {
        const content = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
        // 安全预检：权限声明 + 静态风险扫描，人工确认后才真正安装。
        const pre = await jsend('POST', '/mod/lua/upload', { filename: file.name, content, dry_run: true });
        const perms: string[] = (pre?.permissions || []) as string[];
        const risks: string[] = (pre?.risks || []) as string[];
        const permText = perms.length ? perms.join(', ') : t('modules.upload_no_perm');
        const riskText = risks.length ? t('modules.upload_risk', { risks: risks.join(', ') }) : t('modules.upload_no_risk');
        if (!(await dlg.confirm({ title: t('modules.upload'), description: `${t('modules.upload_confirm', { name: file.name, perms: permText })}\n\n${riskText}`, destructive: risks.length > 0, confirmText: t('modules.upload') }))) { setBusy(false); return; }
        await jsend('POST', '/mod/lua/upload', { filename: file.name, content });
        toast({ title: t('luamod.imported') });
      }
      if (ext === 'js' || ext === 'lua' || ext === 'zip' || ext === 'json') setTab(ext === 'js' ? 'js' : 'lua');   // 上传后跳到对应选项卡
      await loadAll();
    } catch (err) { toast({ title: t('common.upload_fail'), description: String(err), variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const toggle = async (p: Plugin) => {
    setBusy(true);
    try {
      if (p.kind === 'js') { await jsend('POST', '/plugins/js/toggle', { file: p.file, enabled: !p.enabled }); }
      else { await jsend('POST', '/mod/lua/toggle', { name: p.file, enabled: !p.enabled }); }
      await loadAll();
    } catch (e) { toast({ title: t('common.operation_fail'), description: String(e), variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const remove = async (p: Plugin) => {
    const msg = p.kind === 'lua' ? t('luamod.delete_confirm', { name: p.name }) : t('modules.delete_confirm', { name: p.name });
    if (!(await dlg.confirm({ title: t('common.confirm_delete'), description: msg, destructive: true, confirmText: t('common.delete') }))) return;
    setBusy(true);
    try {
      if (p.kind === 'js') await jsend('POST', '/plugins/js/delete', { file: p.file });
      else await jsend('POST', '/mod/lua/delete', { name: p.file });
      toast({ title: t('modules.deleted') }); await loadAll();
    } catch (e) { toast({ title: t('common.operation_fail'), description: String(e), variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const checkOne = async (p: Plugin) => {
    setUpdates((u) => ({ ...u, [p.file]: { ...u[p.file], checking: true } }));
    try { const r = await jsend('POST', '/plugins/js/check-update', { file: p.file }); setUpdates((u) => ({ ...u, [p.file]: { latest: r.latest, hasUpdate: r.hasUpdate, error: r.error } })); }
    catch (e) { setUpdates((u) => ({ ...u, [p.file]: { error: String(e) } })); }
  };

  const checkAll = async () => {
    setBusy(true); let found = 0;
    for (const p of plugins) {
      if (p.kind !== 'js' || !p.updateUrl || p.superseded) continue;
      try { const r = await jsend('POST', '/plugins/js/check-update', { file: p.file }); if (r.hasUpdate) found++; setUpdates((u) => ({ ...u, [p.file]: { latest: r.latest, hasUpdate: r.hasUpdate, error: r.error } })); } catch { /* ignore */ }
    }
    setBusy(false); toast({ title: t('modules.update_checked', { n: found }) });
  };

  const doUpdate = async (p: Plugin) => {
    setBusy(true);
    try { await jsend('POST', '/plugins/js/update', { file: p.file }); setUpdates((u) => { const n = { ...u }; delete n[p.file]; return n; }); toast({ title: t('modules.updated', { name: p.name }) }); await loadAll(); }
    catch (e) { toast({ title: t('common.operation_fail'), description: String(e), variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  // JS / Lua 分选项卡；删除等操作后 page 越界时钳制到最后一页（不再回退到第一页/显示空白）。
  const shown = plugins.filter((p) => p.kind === tab);
  const jsCount = plugins.filter((p) => p.kind === 'js').length;
  const luaCount = plugins.length - jsCount;
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const safePage = Math.min(page, totalPages);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageItems = shown.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="space-y-6">
      {dlg.node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Puzzle className="h-5 w-5" />{t('modules.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('modules.subtitle')}</p>
        </div>
        <div data-tour="modules-actions" className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".js,.lua,.zip,.json" className="hidden" onChange={onFileChosen} />
          <Button variant="outline" size="sm" onClick={checkAll} disabled={busy}><ArrowUpCircle className="mr-2 h-4 w-4" />{t('modules.check_all')}</Button>
          <Button variant="outline" size="sm" onClick={reload} disabled={busy}><RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{t('modules.reload')}</Button>
          <Button size="sm" onClick={onPickFile} disabled={busy}><Upload className="mr-2 h-4 w-4" />{t('modules.upload')}</Button>
        </div>
      </div>

      {/* JS 插件 / Lua 模组 选项卡 */}
      <div data-tour="modules-tabs" className="flex gap-1 border-b">
        {([['js', `{js} ${t('modules.tab_js')} (${jsCount})`], ['lua', `{lua} ${t('modules.tab_lua')} (${luaCount})`]] as const).map(([k, label]) => (
          <button key={k}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => { setTab(k); setPage(1); }}>
            {label}
          </button>
        ))}
      </div>

      <div data-tour="modules-list">
      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : shown.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-3 py-12 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Puzzle className="h-8 w-8 text-muted-foreground" /></div><p className="text-sm text-muted-foreground">{t('modules.empty')}</p></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-3">
            {pageItems.map((p) => {
              const up = updates[p.file];
              return (
                <PluginCard key={p.kind + '/' + p.file} p={p} up={up} busy={busy}
                  onToggle={() => toggle(p)} onDelete={() => remove(p)}
                  onConfig={() => setConfigPlugin(p)} onDetail={() => setDetailPlugin(p)}
                  onUpdate={p.kind === 'js' ? () => doUpdate(p) : undefined}
                />
              );
            })}
          </div>
          {totalPages > 1 && (
            <PaginationBar total={shown.length} page={safePage} pageSize={pageSize}
              onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              label={`${shown.length} 个插件`} />
          )}
        </>
      )}
      </div>

      {configPlugin && <ConfigDialog plugin={configPlugin} onClose={() => setConfigPlugin(null)} onSaved={loadAll} />}
      {detailPlugin && <DetailDialog plugin={detailPlugin} update={updates[detailPlugin.file]} onClose={() => setDetailPlugin(null)} onCheck={() => checkOne(detailPlugin)} onUpdate={() => doUpdate(detailPlugin)} />}
    </div>
  );
};
export default ModulesPage;
