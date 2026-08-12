import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PersonaManagerCard } from '@/components/persona/persona-manager';
import {
  Loader2, RefreshCw, RotateCcw, Save, ChevronRight, ChevronDown, Pencil, Trash2, Download, Upload,
  Image as ImageIcon, Globe, HelpCircle, Users, BookText,
} from 'lucide-react';

interface Var { name: string; desc: string; }
interface Reply { key: string; default: string; override: string | null; v2key?: string; example?: string; vars: Var[]; }
interface Cmd { cmd: string; title: string; category: string; sources: string[]; example: string; desc: string; replies: Reply[]; }
interface AllKey { key: string; group: string; default: string; override: string | null; v2key?: string; }

const ALL_TAB = '__all__', VAR_TAB = '__vars__', ORPHAN_TAB = '__orphans__';
const SPECIAL_TABS = [ALL_TAB, VAR_TAB, ORPHAN_TAB];

const LANGS = [
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
];
const CAT_ORDER = ['掷骰', 'COC', 'BRP', 'DND', '人物卡', '牌堆', '跑团', '娱乐', '互动', 'AI', '工具', '权限', '管理', '系统'];

// Globally-available variables (filled at send time for ANY text). Shown behind
// the「插入全局变量」button; command-specific vars stay as first-level chips.
const GLOBAL_VARS = ['self', 'nick', 'name', 'qqnick', 'card', 'pcname', 'qqnickw', 'cardw', 'pcnamew', 'user', 'group', 'date', 'time'];
const GLOBAL_SET = new Set(GLOBAL_VARS);

const replyLabel = (key: string): string => {
  const seg = key.split('.').pop() || key;
  const map: Record<string, string> = {
    result: '默认', result_reason: '带原因', multi: '多轮', multi_reason: '多轮·带原因',
    result_noloss: '无损失', success: '成功', fail: '失败', build: '生成',
    temp: '临时', long: '总结', on: '开启', off: '关闭', set: '设置', clear: '清除',
    jrrp: '人品', sleep: '休息', done: '完成', already_on: '已开启提示', already_off: '已关闭提示',
  };
  return map[seg] || seg;
};

const extractVars = (s: string): string[] =>
  [...s.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]);

const fineGroupFor = (key: string): string => {
  const parts = key.split('.');
  return ['dice', 'card', 'fun', 'dnd', 'help'].includes(parts[0]) && parts[1]
    ? `${parts[0]}.${parts[1]}` : parts[0];
};

export const CommandsPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [lang, setLang] = useState('zh-Hans');
  const [rows, setRows] = useState<Cmd[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('掷骰');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ cmd: string; reply: Reply } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [allRows, setAllRows] = useState<AllKey[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allQ, setAllQ] = useState('');
  const [allGroup, setAllGroup] = useState('__all_groups__');
  // C#40: persona editing — pick a persona and edit ITS reply text directly.
  const [personas, setPersonas] = useState<{ id: number; name: string }[]>([]);
  const [personaId, setPersonaId] = useState(0);            // 0 = 默认人格 (global overrides)
  const [personaMap, setPersonaMap] = useState<Record<string, string>>({});  // key → value for personaId+lang
  const [mgrOpen, setMgrOpen] = useState(false);
  const editScrollY = useRef(0);

  const fetchPersonas = useCallback(async () => {
    try { const r = await fetch('/api/personas'); const j = await r.json(); if (j.code === 0) setPersonas(j.data || []); }
    catch { /* ignore — persona editing just stays on 默认 */ }
  }, []);
  useEffect(() => { void fetchPersonas(); }, [fetchPersonas]);

  const loadPersonaMap = useCallback(async () => {
    if (personaId === 0) { setPersonaMap({}); return; }
    try {
      const r = await fetch(`/api/personas/${personaId}/entries`); const j = await r.json();
      if (j.code === 0) {
        const m: Record<string, string> = {};
        for (const e of (j.data || [])) if (e.locale === lang) m[e.key] = e.value;
        setPersonaMap(m);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaId, lang]);
  useEffect(() => { void loadPersonaMap(); }, [loadPersonaMap]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/commands?lang=${encodeURIComponent(lang)}`);
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      setRows(j.data || []);
    } catch { toast({ title: t('common.load_fail'), variant: 'destructive' }); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  useEffect(() => { void load(); }, [load]);

  const loadAll = useCallback(async () => {
    setAllLoading(true);
    try {
      const r = await fetch(`/api/i18n/all?lang=${encodeURIComponent(lang)}`);
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      setAllRows(j.data || []);
    } catch { toast({ title: t('common.load_fail'), variant: 'destructive' }); }
    finally { setAllLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  useEffect(() => { if (SPECIAL_TABS.includes(cat)) void loadAll(); }, [cat, loadAll]);

  const cats = [...CAT_ORDER.filter((c) => rows.some((r) => r.category === c))
    .concat([...new Set(rows.map((r) => r.category))].filter((c) => !CAT_ORDER.includes(c))),
    ...SPECIAL_TABS];
  const tabLabel = (c: string) => c === ALL_TAB ? t('commands.tab_all') : c === VAR_TAB ? t('commands.tab_vars')
    : c === ORPHAN_TAB ? t('commands.tab_orphans') : c;
  // When a persona is selected, swap each key's `override` for that persona's entry
  // (or null if it hasn't overridden the key) so the whole page shows / edits THAT persona.
  const dispRows = personaId === 0 ? rows
    : rows.map((c) => ({ ...c, replies: c.replies.map((r) => ({ ...r, override: personaMap[r.key] ?? null })) }));
  const dispAll = personaId === 0 ? allRows
    : allRows.map((k) => ({ ...k, override: personaMap[k.key] ?? null }));
  const shown = dispRows.filter((r) => r.category === cat);

  const toggle = (cmd: string) =>
    setExpanded((p) => { const n = new Set(p); n.has(cmd) ? n.delete(cmd) : n.add(cmd); return n; });

  const beginEdit = (next: { cmd: string; reply: Reply }) => {
    editScrollY.current = window.scrollY;
    setEditing(next);
  };
  const restoreEditScroll = () => requestAnimationFrame(() => requestAnimationFrame(() =>
    window.scrollTo({ top: editScrollY.current, behavior: 'auto' })));
  const closeEditor = () => { setEditing(null); restoreEditScroll(); };
  const savedEditor = (key: string, value: string | null) => {
    if (personaId > 0) {
      setPersonaMap((prev) => {
        const next = { ...prev };
        if (value == null) delete next[key]; else next[key] = value;
        return next;
      });
    } else {
      setRows((prev) => prev.map((command) => ({
        ...command,
        replies: command.replies.map((reply) => reply.key === key ? { ...reply, override: value } : reply),
      })));
      setAllRows((prev) => prev.map((reply) => reply.key === key ? { ...reply, override: value } : reply));
    }
    closeEditor();
  };

  const editKey = (k: AllKey) => beginEdit({ cmd: k.key, reply: {
    key: k.key, default: k.default, override: k.override, v2key: k.v2key,
    vars: extractVars(k.default).map((n) => ({ name: n, desc: '' })) } });

  // 删除导入的无效文本（legacy.* 覆盖）：清除 DB 覆盖并刷新列表。
  const delKey = async (k: AllKey) => {
    if (!window.confirm(t('commands.delete_orphan_confirm', { key: k.key.replace(/^legacy\./, '') }))) return;
    try {
      const r = await fetch(`/api/templates/${encodeURIComponent(lang)}/${encodeURIComponent(k.key)}`, { method: 'DELETE' });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      toast({ title: t('common.delete_success') });
      await loadAll();
    } catch (e) { toast({ title: t('common.delete_fail'), description: String(e), variant: 'destructive' }); }
  };
  const doExport = async () => {
    try {
      const r = await fetch('/api/templates/export'); const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      const blob = new Blob([JSON.stringify(j.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'dice-replies.json'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast({ title: t('common.operation_fail'), description: String(e), variant: 'destructive' }); }
  };
  const doImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const r = await fetch('/api/templates/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      toast({ title: t('commands.import_ok', { n: j.data?.imported ?? 0 }) }); void load(); void loadAll();
    } catch (e) { toast({ title: t('commands.import_fail'), description: String(e), variant: 'destructive' }); }
  };

  // Header (?) tooltip explaining the gray V2-key subtext.
  const V2Head: React.FC<{ label: string }> = ({ label }) => (
    <span className="inline-flex items-center gap-1">{label}
      <span title={t('commands.v2_tooltip')} className="inline-flex"><HelpCircle className="h-3.5 w-3.5 opacity-60" /></span></span>
  );
  const V2Sub: React.FC<{ v2?: string }> = ({ v2 }) =>
    v2 ? <div className="text-[11px] text-muted-foreground/70 font-mono">{t('commands.v2_label')}: {v2}</div> : null;

  const filterRows = (pred: (k: AllKey) => boolean) => dispAll.filter((k) => {
    if (!pred(k)) return false;
    if (cat === ALL_TAB && allGroup !== '__all_groups__' && fineGroupFor(k.key) !== allGroup) return false;
    const q = allQ.toLowerCase();
    return !q || k.key.toLowerCase().includes(q) || (k.override ?? k.default).toLowerCase().includes(q);
  });
  const allGroups = [...new Set(dispAll
    .filter((k) => k.group !== 'tplvar' && k.group !== 'legacy')
    .map((k) => fineGroupFor(k.key)))].sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><BookText className="h-5 w-5" />{t('commands.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('commands.subtitle')}</p>
          <p className="text-sm text-muted-foreground">{t('commands.compat_note')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* persona being edited (default = global). Switching shows that persona's reply text. */}
          <Select value={String(personaId)} onValueChange={(v) => setPersonaId(Number(v))}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t('commands.persona_default')}</SelectItem>
              {personas.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setMgrOpen(true)}><Users className="mr-2 h-4 w-4" />{t('commands.persona_manage')}</Button>
          <Select value={lang} onValueChange={(v) => setLang(v)}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGS.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={doExport}><Download className="mr-2 h-4 w-4" />{t('commands.export')}</Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />{t('commands.import')}</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ''; }} />
          <Button variant="outline" size="sm" onClick={() => { void load(); void loadAll(); }} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}</Button>
        </div>
      </div>

      {personaId > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <Users className="h-4 w-4 text-primary shrink-0" />
          <span className="text-muted-foreground">
            {t('commands.persona_editing', { name: personas.find((p) => p.id === personaId)?.name ?? '' })}
          </span>
          <button className="ml-auto text-xs text-primary hover:underline" onClick={() => setPersonaId(0)}>{t('commands.persona_back')}</button>
        </div>
      )}

      {/* category + special tabs */}
      <div className="flex gap-1 border-b flex-wrap">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${cat === c ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {tabLabel(c)}
          </button>
        ))}
      </div>

      {SPECIAL_TABS.includes(cat) ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input value={allQ} onChange={(e) => setAllQ(e.target.value)} placeholder={t('commands.all_search')}
              className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm" />
            {cat === ALL_TAB && (
              <Select value={allGroup} onValueChange={setAllGroup}>
                <SelectTrigger className="h-9 w-48"><SelectValue placeholder={t('commands.all_group')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all_groups__">{t('commands.all_group_all')}</SelectItem>
                  {allGroups.map((group) => <SelectItem key={group} value={group}>{group}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          {allLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="rt w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium p-2.5 whitespace-nowrap"><V2Head label={t('commands.col_key')} /></th>
                    {cat === VAR_TAB && <th className="text-left font-medium p-2.5 whitespace-nowrap">{t('commands.col_var')}</th>}
                    <th className="text-left font-medium p-2.5">{cat === ORPHAN_TAB ? t('commands.col_orphan_text') : t('commands.col_text')}</th>
                    <th className="text-left font-medium p-2.5 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {cat === ORPHAN_TAB && filterRows((k) => k.group === 'legacy').length === 0 && (
                    <tr><td colSpan={3} className="p-8 text-center text-sm text-muted-foreground">{t('commands.orphan_empty')}</td></tr>
                  )}
                  {cat === VAR_TAB && GLOBAL_VARS
                    .filter((name) => { const q = allQ.toLowerCase(); return !q || name.includes(q) || t(`commands.gvar_${name}`).toLowerCase().includes(q); })
                    .map((name) => (
                    <tr key={`gvar-${name}`} className="border-t align-top bg-primary/5">
                      <td data-label={t('commands.col_key')} className="p-2.5 font-mono text-xs whitespace-nowrap">
                        {name}
                        <div className="text-[11px] text-muted-foreground/70">{t('commands.gvar_badge')}</div>
                      </td>
                      <td data-label={t('commands.col_var')} className="p-2.5 font-mono text-xs text-primary">{`{${name}}`}</td>
                      <td data-label={t('commands.col_text')} className="p-2.5 text-muted-foreground w-full max-w-0">
                        <div className="truncate" title={t(`commands.gvar_${name}`)}>{t(`commands.gvar_${name}`)}</div>
                      </td>
                      <td className="p-2.5"></td>
                    </tr>
                  ))}
                  {filterRows((k) =>
                    cat === VAR_TAB ? k.group === 'tplvar'
                    : cat === ORPHAN_TAB ? k.group === 'legacy'
                    : (k.group !== 'tplvar' && k.group !== 'legacy')      // ALL_TAB
                  ).map((k) => (
                    <tr key={k.key} className="border-t align-top hover:bg-muted/30">
                      <td data-label={t('commands.col_key')} className="p-2.5 font-mono text-xs whitespace-nowrap">
                        {cat === ORPHAN_TAB ? k.key.replace(/^legacy\./, '') : k.key}
                        {k.override != null && <span className="ml-1 text-amber-600" title={t('commands.modified')}>●</span>}
                        {cat !== ORPHAN_TAB && <V2Sub v2={k.v2key} />}
                      </td>
                      {cat === VAR_TAB && <td data-label={t('commands.col_var')} className="p-2.5 font-mono text-xs text-primary">{`{${k.key.replace(/^tplvar\./, '')}}`}</td>}
                      <td data-label={t('commands.col_text')} className="p-2.5 text-muted-foreground w-full max-w-0">
                        <div className="truncate" title={k.override ?? k.default}>{k.override ?? k.default}</div>
                      </td>
                      <td data-label={t('common.actions')} className="p-2.5">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => editKey(k)}>
                            <Pencil className="mr-1 h-3.5 w-3.5" />{t('commands.edit')}
                          </Button>
                          {cat === ORPHAN_TAB && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => void delKey(k)}>
                              <Trash2 className="mr-1 h-3.5 w-3.5" />{t('common.delete')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="rt w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium p-2.5 w-8"></th>
                <th className="text-left font-medium p-2.5 whitespace-nowrap">{t('commands.col_title')}</th>
                <th className="text-left font-medium p-2.5 whitespace-nowrap">{t('commands.col_cmd')}</th>
                <th className="text-left font-medium p-2.5">{t('commands.col_example')}</th>
                <th className="text-left font-medium p-2.5">{t('commands.col_desc')}</th>
                <th className="text-left font-medium p-2.5 w-28">{t('commands.col_reply')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const isOpen = expanded.has(c.cmd);
                const multi = c.replies.length > 1;
                const hasOverride = c.replies.some((r) => r.override != null);
                return (
                  <React.Fragment key={c.cmd}>
                    <tr className="border-t align-top hover:bg-muted/30">
                      <td data-label={t('common.actions')} className="p-2.5">
                        {multi && (
                          <button onClick={() => toggle(c.cmd)} className="text-muted-foreground hover:text-foreground">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                      <td data-label={t('commands.col_title')} className="p-2.5 font-medium whitespace-nowrap">{c.title}</td>
                      <td data-label={t('commands.col_cmd')} className="p-2.5 font-mono whitespace-nowrap">
                        {c.cmd}{hasOverride && <span className="ml-1 text-[11px] text-amber-600">●</span>}
                      </td>
                      <td data-label={t('commands.col_example')} className="p-2.5">
                        <div className="flex flex-wrap gap-1">
                          {c.example.split(' / ').map((ex, i) => (
                            <code key={i} className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground/80 whitespace-nowrap">{ex}</code>
                          ))}
                        </div>
                      </td>
                      <td data-label={t('commands.col_desc')} className="p-2.5 text-muted-foreground w-full max-w-0">
                        <div className="truncate" title={c.desc}>{c.desc}</div>
                      </td>
                      <td data-label={t('commands.col_reply')} className="p-2.5">
                        {c.replies.length === 0 ? <span className="text-xs text-muted-foreground">—</span>
                          : multi
                            ? <button onClick={() => toggle(c.cmd)} className="text-xs text-primary hover:underline">{t('commands.edit')} ({c.replies.length})</button>
                            : <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => beginEdit({ cmd: c.cmd, reply: c.replies[0] })}><Pencil className="mr-1 h-3.5 w-3.5" />{t('commands.edit')}</Button>}
                      </td>
                    </tr>
                    {isOpen && multi && c.replies.map((rep) => (
                      <tr key={rep.key} className="border-t bg-muted/20">
                        <td></td>
                        <td data-label={t('commands.col_title')} className="p-2 pl-4 text-xs text-muted-foreground" colSpan={2}>
                          <span className="font-medium">{replyLabel(rep.key)}</span>
                          <span className="ml-2 font-mono opacity-60">{rep.key}</span>
                          {rep.override != null && <span className="ml-2 text-amber-600">{t('commands.modified')}</span>}
                          {rep.v2key && <div className="text-[11px] text-muted-foreground/70 font-mono">{t('commands.v2_label')}: {rep.v2key}</div>}
                        </td>
                        <td data-label={t('commands.col_example')} className="p-2">
                          {rep.example && <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground/80 whitespace-nowrap">{rep.example}</code>}
                        </td>
                        <td data-label={t('commands.col_reply')} className="p-2 text-xs text-muted-foreground" colSpan={1}>
                          <span className="font-mono whitespace-pre-wrap break-words">{rep.override ?? rep.default}</span>
                        </td>
                        <td data-label={t('common.actions')} className="p-2">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => beginEdit({ cmd: c.cmd, reply: rep })}><Pencil className="mr-1 h-3.5 w-3.5" />{t('commands.edit')}</Button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditReplyModal lang={lang} cmd={editing.cmd} reply={editing.reply} personaId={personaId}
          onClose={closeEditor} onSaved={savedEditor} />
      )}

      {/* C#40: persona management dialog (create / copy / edit / delete / set default) */}
      <Dialog open={mgrOpen} onOpenChange={(o) => { setMgrOpen(o); if (!o) { void fetchPersonas(); void loadPersonaMap(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('commands.persona_manage')}</DialogTitle>
            <DialogDescription>{t('commands.persona_manage_desc')}</DialogDescription>
          </DialogHeader>
          <PersonaManagerCard onChanged={() => { void fetchPersonas(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Edit modal ──────────────────────────────────────────────
const EditReplyModal: React.FC<{ lang: string; cmd: string; reply: Reply; personaId: number; onClose: () => void; onSaved: (key: string, value: string | null) => void }>
  = ({ lang, cmd, reply, personaId, onClose, onSaved }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [text, setText] = useState(reply.override ?? reply.default);
  const [showGlobals, setShowGlobals] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Command-specific vars (chips) vs global vars (behind the button).
  const exclusiveVars = reply.vars.filter((v) => !GLOBAL_SET.has(v.name));
  const allowed = new Set([...reply.vars.map((v) => v.name), ...GLOBAL_VARS]);
  const used = extractVars(text);
  const unknown = [...new Set(used.filter((u) => !allowed.has(u) && !u.includes('|') && !u.includes(':')))];
  const missing = exclusiveVars.map((v) => v.name).filter((n) => !used.includes(n));

  const imgRef = useRef<HTMLInputElement>(null);
  const insertRaw = (tok: string) => {
    const ta = taRef.current;
    if (!ta) { setText((x) => x + tok); return; }
    const s = ta.selectionStart, e = ta.selectionEnd;
    setText(text.slice(0, s) + tok + text.slice(e));
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + tok.length; }, 0);
  };
  const insert = (name: string) => insertRaw(`{${name}}`);
  const uploadImage = async (file: File) => {
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file);
      });
      const r = await fetch('/api/assets/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data: dataUrl }) });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      insertRaw(j.data.code);
    } catch (e) { toast({ title: t('commands.image_fail'), description: String(e), variant: 'destructive' }); }
  };

  const save = async () => {
    if (unknown.length) { toast({ title: t('commands.err_unknown', { vars: unknown.map((u) => `{${u}}`).join(' ') }), variant: 'destructive' }); return; }
    try {
      const r = personaId > 0
        ? await fetch(`/api/personas/${personaId}/entries`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale: lang, key: reply.key, value: text }) })
        : await fetch('/api/templates', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale: lang, key: reply.key, value: text }) });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      toast({ title: t('common.save_success') }); onSaved(reply.key, text);
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const reset = async () => {
    if (reply.override == null) { setText(reply.default); return; }
    try {
      const r = personaId > 0
        ? await fetch(`/api/personas/${personaId}/entries`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale: lang, key: reply.key }) })
        : await fetch(`/api/templates/${encodeURIComponent(lang)}/${encodeURIComponent(reply.key)}`, { method: 'DELETE' });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      toast({ title: t('commands.reset_done') }); onSaved(reply.key, null);
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{cmd} · {replyLabel(reply.key)}</DialogTitle>
          <DialogDescription>{t('commands.var_insert_hint')}{reply.v2key ? `　${t('commands.v2_label')}: ${reply.v2key}` : ''}</DialogDescription>
        </DialogHeader>

        {/* command-specific chips + insert image + insert global var */}
        <div className="flex flex-wrap items-center gap-1.5">
          {exclusiveVars.length === 0 && <span className="text-xs text-muted-foreground">{t('commands.no_vars')}</span>}
          {exclusiveVars.map((v) => (
            <button key={v.name} onClick={() => insert(v.name)} title={v.desc}
              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted transition-colors">
              <code className="text-primary">{`{${v.name}}`}</code>
              {v.desc && <span className="text-muted-foreground">{v.desc}</span>}
            </button>
          ))}
          <button onClick={() => setShowGlobals(true)}
            className="inline-flex items-center gap-1 rounded border border-dashed px-2 py-1 text-xs hover:bg-muted transition-colors">
            <Globe className="h-3.5 w-3.5 text-primary" />{t('commands.insert_global')}
          </button>
          <button onClick={() => imgRef.current?.click()}
            className="inline-flex items-center gap-1 rounded border border-dashed px-2 py-1 text-xs hover:bg-muted transition-colors">
            <ImageIcon className="h-3.5 w-3.5 text-primary" />{t('commands.insert_image')}
          </button>
          <input ref={imgRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ''; }} />
        </div>

        <Textarea ref={taRef} rows={4} className="font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} />

        {unknown.length > 0 && (
          <p className="text-xs text-destructive">{t('commands.err_unknown', { vars: unknown.map((u) => `{${u}}`).join(' ') })}</p>
        )}
        {missing.length > 0 && unknown.length === 0 && (
          <p className="text-xs text-amber-600">{t('commands.warn_missing', { vars: missing.map((m) => `{${m}}`).join(' ') })}</p>
        )}
        <p className="text-[11px] text-muted-foreground">{t('commands.default_label')}: <span className="font-mono">{reply.default}</span></p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" disabled={text === reply.default && reply.override == null} onClick={reset}><RotateCcw className="mr-2 h-4 w-4" />{t('commands.reset')}</Button>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={unknown.length > 0} onClick={save}><Save className="mr-2 h-4 w-4" />{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>

      {/* second-level popup: global variables */}
      <Dialog open={showGlobals} onOpenChange={setShowGlobals}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('commands.global_vars_title')}</DialogTitle>
            <DialogDescription>{t('commands.global_vars_desc')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">
            {GLOBAL_VARS.map((name) => (
              <button key={name} onClick={() => { insert(name); setShowGlobals(false); }}
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted transition-colors">
                <code className="text-primary">{`{${name}}`}</code>
                <span className="text-muted-foreground">{t(`commands.gvar_${name}`)}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default CommandsPage;
