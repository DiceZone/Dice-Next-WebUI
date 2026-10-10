import { useTourActive, useTourState } from '@/components/onboarding/tour-data';
import { tourSamples } from '@/lib/tour-samples';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { WeightedTemplateEditor } from '@/components/persona/weighted-template-editor';
import { readTemplateVariants, writeTemplateVariants, templateSummary, validWeights } from '@/lib/weighted-templates';
import { AdvancedOptions } from '@/components/ui/advanced-options';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { useRequestGate } from '@/hooks/use-request-gate';
import { PersonaManagerCard } from '@/components/persona/persona-manager';
import { PersonaAccessDialog } from '@/components/persona/persona-access-dialog';
import {
  Loader2, RefreshCw, RotateCcw, Save, ChevronRight, ChevronDown, Pencil, Trash2, Download, Upload,
  Image as ImageIcon, Globe, Users, BookText, UserCheck, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { FeatureHelp } from '@/components/ui/feature-help';
import { HelpLabel } from '@/components/ui/help-label';
import { ResponsiveActions } from '@/components/ui/responsive-actions';
import { VARIABLE_STYLES, variableStyleOf, restyleVariable, type VariableStyle } from '@/lib/template-variable-style';
import { PREVIEW_PLATFORMS, readReplyPreview, type PreviewPlatform, type ReplyPreview } from '@/lib/reply-preview';
import { Switch } from '@/components/ui/switch';
import { resolveOutcomeText, resolveOutcomeInheritance, outcomePreviewArgs, type OutcomeText, type ResolvedOutcomeText } from '@/lib/outcome-replies';
import { legacyTemplatePreviewArgs } from '@/lib/legacy-templates';
import { shortcutTemplatePreviewArgs } from '@/lib/command-shortcuts';
import { buildTextMetadata, commandCategory, COMMAND_CATEGORIES, filterAndSortTexts, type TextSort, type TextSortField } from '@/lib/command-text-catalog';

interface Var { name: string; desc: string; }
type ReplyFormat = 'plain' | 'markdown';
interface Reply extends OutcomeText { v2key?: string; example?: string; vars: Var[]; effective?: ResolvedOutcomeText; inherited?: ResolvedOutcomeText; }
interface Cmd { cmd: string; title: string; category: string; sources: string[]; example: string; desc: string; replies: Reply[]; }
interface AllKey extends OutcomeText { group: string; v2key?: string; vars?: Var[]; effective?: ResolvedOutcomeText; inherited?: ResolvedOutcomeText; }

const ALL_TAB = '__all__', VAR_TAB = '__vars__', ORPHAN_TAB = '__orphans__';
const SPECIAL_TABS = [ALL_TAB, VAR_TAB, ORPHAN_TAB];

const LANGS = [
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
];

// Globally-available variables (filled at send time for ANY text). Shown behind
// the「插入全局变量」button; command-specific vars stay as first-level chips.
const GLOBAL_VARS = ['self', 'nick', 'name', 'qqnick', 'card', 'pcname', 'qqnickw', 'cardw', 'pcnamew', 'user', 'group', 'date', 'time'];
const GLOBAL_SET = new Set(GLOBAL_VARS);

const extractVars = (s: string): string[] =>
  [...s.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]);

export const CommandsPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const dlg = useDialogs(t);
  const [lang, setLang] = useState('zh-Hans');
  const [rows, setRows] = useTourState<Cmd[]>([], tourSamples.commands);
  const [loading, setLoading] = useTourState(true, false);
  const [cat, setCat] = useTourState('掷骰', '掷骰');
  const [expanded, setExpanded] = useTourState<Set<string>>(new Set(), new Set(['r']));
  const [editing, setEditing] = useState<{ cmd: string; reply: Reply } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [allRows, setAllRows] = useState<AllKey[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allQ, setAllQ] = useState('');
  const [allGroup, setAllGroup] = useState('__all_groups__');
  const [allSort, setAllSort] = useState<TextSort>({ field: 'example', direction: 'asc' });
  // C#40: persona editing — pick a persona and edit ITS reply text directly.
  const [personas, setPersonas] = useTourState<{ id: number; name: string }[]>([], tourSamples.personas);
  const [personaId, setPersonaId] = useTourState(0, 0);            // 0 = 默认人格 (global overrides)
  const [personaMap, setPersonaMap] = useTourState<Record<string, { value: string; format: ReplyFormat }>>({}, {});
  const [mgrOpen, setMgrOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const tourActive = useTourActive();
  const editScrollY = useRef(0);
  const personaKey = `${personaId}:${lang}`;
  const personaGate = useRequestGate(personaKey);
  const commandGate = useRequestGate(lang);
  const allGate = useRequestGate(lang);
  const [personaLoaded, setPersonaLoaded] = useState('');
  const [personaError, setPersonaError] = useState('');
  const [rowsLocale, setRowsLocale] = useState('');
  const [allLocale, setAllLocale] = useState('');

  const fetchPersonas = useCallback(async () => {
    try { const r = await fetch('/api/personas'); const j = await r.json(); if (j.code === 0) setPersonas(j.data || []); }
    catch { /* ignore — persona editing just stays on 默认 */ }
  }, []);
  useEffect(() => { void fetchPersonas(); }, [fetchPersonas]);

  const loadPersonaMap = useCallback(async () => {
    const current = personaGate.start();
    setPersonaLoaded(''); setPersonaError(''); setPersonaMap({});
    if (personaId === 0) { setPersonaLoaded(personaKey); return; }
    try {
      const r = await fetch(`/api/personas/${personaId}/entries`); const j = await r.json();
      if (!r.ok || j.code !== 0) throw new Error(j.message || t('common.load_fail'));
      if (current()) {
        const m: Record<string, { value: string; format: ReplyFormat }> = {};
        for (const e of (j.data || [])) if (e.locale === lang) m[e.key] = { value: e.value, format: e.format === 'markdown' ? 'markdown' : 'plain' };
        setPersonaMap(m);
        setPersonaLoaded(personaKey);
      }
    } catch (e) { if (current()) setPersonaError(String(e)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaId, lang]);
  useEffect(() => { void loadPersonaMap(); }, [loadPersonaMap]);

  const load = useCallback(async () => {
    const current = commandGate.start();
    setRowsLocale('');
    setLoading(true);
    try {
      const r = await fetch(`/api/commands?lang=${encodeURIComponent(lang)}`);
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      if (current()) { setRows(j.data || []); setRowsLocale(lang); }
    } catch { if (current()) toast({ title: t('common.load_fail'), variant: 'destructive' }); }
    finally { if (current()) setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  useEffect(() => { void load(); }, [load]);

  const loadAll = useCallback(async () => {
    const current = allGate.start();
    setAllLocale('');
    setAllLoading(true);
    try {
      const r = await fetch(`/api/i18n/all?lang=${encodeURIComponent(lang)}`);
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      if (current()) { setAllRows(j.data || []); setAllLocale(lang); }
    } catch { if (current()) toast({ title: t('common.load_fail'), variant: 'destructive' }); }
    finally { if (current()) setAllLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  useEffect(() => { if (SPECIAL_TABS.includes(cat)) void loadAll(); }, [cat, loadAll]);

  const categoryRows = rows.map((row) => ({ ...row, category: commandCategory(row.category) }));
  const cats = [...COMMAND_CATEGORIES.filter((c) => categoryRows.some((r) => r.category === c)),
    ...[...new Set(categoryRows.map((r) => r.category))].filter((c) => !COMMAND_CATEGORIES.some((known) => known === c)),
    ...SPECIAL_TABS];
  const categoryLabel = (category: string) => t(`commands.categories.${category}`, { defaultValue: category });
  const tabLabel = (c: string) => c === ALL_TAB ? t('commands.tab_all') : c === VAR_TAB ? t('commands.tab_vars')
    : c === ORPHAN_TAB ? t('commands.tab_orphans') : categoryLabel(c);
  const replyLabel = (key: string) => {
    const parts = key.split('.');
    if (parts[0] === 'shortcut') return t(`shortcuts.labels.${parts[1]}`, { defaultValue: '' });
    if (parts[0] === 'dice' && parts[1] === 'compat') {
      const kind = parts[2] === 'check' ? parts[3] === 'single' ? 'single' : parts[3] : parts.slice(2).join('_');
      const label = t('legacy_text.labels.' + kind);
      return parts[3] === 'single' ? label + ' · ' + t('outcome.grades.' + parts[4]) : label;
    }
    if (parts[0] === 'dice' && parts[1] === 'outcome')
      return `${t(`outcome.families.${parts[2]}`)} · ${t(`outcome.grades.${parts[3]}`)}`;
    if (parts[0] === 'help' && parts[1] === 'topic') {
      const related = categoryRows.find((row) => row.cmd.split('/').some((cmd) => cmd.replace(/^\./, '') === parts[2]));
      return related ? `${related.title} · ${t('commands.text_labels.usage')}` : t('commands.text_labels.usage');
    }
    const exact = t(`commands.text_labels.${parts.join('_')}`, { defaultValue: '' });
    const full = exact || t(`commands.text_labels.${parts.slice(1).join('_')}`, { defaultValue: '' });
    return full || t(`commands.text_labels.${parts[parts.length - 1]}`, { defaultValue: '' });
  };
  const textMetadata = buildTextMetadata(tourActive || rowsLocale === lang ? categoryRows : [], replyLabel);
  const textIndex = new Map<string, OutcomeText>([
    ...(allLocale === lang ? allRows : []),
    ...(tourActive || rowsLocale === lang ? categoryRows.flatMap(row => row.replies) : []),
  ].map(row => [row.key, row]));
  const decorateOutcome = <T extends OutcomeText,>(row: T) => ({ ...row,
    effective: resolveOutcomeText(row, textIndex, personaId > 0 ? personaMap : undefined),
    inherited: resolveOutcomeInheritance(row, textIndex, personaId > 0 ? personaMap : undefined),
  });
  const inheritanceLabel = (reply: Reply | AllKey) => {
    const source = reply.effective;
    if (!source) return t('outcome.unavailable');
    const name = source.key.startsWith('dice.outcome.') ? replyLabel(source.key) : t('outcome.original');
    return t('outcome.inherited', { source: source.layer === 'global' && personaId > 0 ? `${t('outcome.global')} · ${name}` : name });
  };
  // When a persona is selected, swap each key's `override` for that persona's entry
  // (or null if it hasn't overridden the key) so the whole page shows / edits THAT persona.
  const outcomeRows = categoryRows.map(c => ({ ...c, replies: c.replies.map(decorateOutcome) }));
  const dispRows = personaId === 0 ? outcomeRows
    : outcomeRows.map((c) => ({ ...c, replies: c.replies.map((r) => ({ ...r,
      override: personaMap[r.key]?.value ?? null,
      format: personaMap[r.key]?.format ?? 'plain',
    })) }));
  const outcomeAll = allRows.map(decorateOutcome);
  const dispAll = personaId === 0 ? outcomeAll
    : outcomeAll.map((k) => ({ ...k, override: personaMap[k.key]?.value ?? null,
      format: personaMap[k.key]?.format ?? 'plain' }));
  const shown = dispRows.filter((r) => r.category === cat);

  const toggle = (cmd: string) =>
    setExpanded((p) => { const n = new Set(p); n.has(cmd) ? n.delete(cmd) : n.add(cmd); return n; });

  const beginEdit = (next: { cmd: string; reply: Reply }) => {
    if (personaLoaded !== personaKey || (SPECIAL_TABS.includes(cat) ? allLocale : rowsLocale) !== lang) {
      toast({ title: t('ui_audit.wait_for_data'), variant: 'destructive' }); return;
    }
    editScrollY.current = document.querySelector('main')?.scrollTop ?? 0;
    setEditing(next);
  };
  const restoreEditScroll = () => requestAnimationFrame(() => requestAnimationFrame(() =>
    document.querySelector('main')?.scrollTo({ top: editScrollY.current, behavior: 'auto' })));
  const closeEditor = () => { setEditing(null); restoreEditScroll(); };
  const savedEditor = (key: string, value: string | null, format: ReplyFormat) => {
    if (personaId > 0) {
      setPersonaMap((prev) => {
        const next = { ...prev };
        if (value == null) delete next[key]; else next[key] = { value, format };
        return next;
      });
    } else {
      setRows((prev) => prev.map((command) => ({
        ...command,
        replies: command.replies.map((reply) => reply.key === key ? { ...reply, override: value, format } : reply),
      })));
      setAllRows((prev) => prev.map((reply) => reply.key === key ? { ...reply, override: value, format } : reply));
    }
    closeEditor();
  };

  const editKey = (k: AllKey) => beginEdit({ cmd: k.key, reply: {
    ...k, vars: k.vars ?? extractVars(k.default).map((n) => ({ name: n, desc: '' })) } });

  // 删除导入的无效文本（legacy.* 覆盖）：清除 DB 覆盖并刷新列表。
  const delKey = async (k: AllKey) => {
    if (!(await dlg.confirm({ title: t('common.confirm_delete'), description: t('commands.delete_orphan_confirm', { key: k.key.replace(/^legacy\./, '') }), destructive: true, confirmText: t('common.delete') }))) return;
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

  const V2Help = () => <FeatureHelp title={t('commands.v2_label')} description={<p>{t('commands.v2_tooltip')}</p>} />;
  const V2Head: React.FC<{ label: string }> = ({ label }) => (
    <span className="inline-flex items-center gap-1">{label}
      <V2Help /></span>
  );
  const V2Sub: React.FC<{ v2?: string }> = ({ v2 }) =>
    v2 ? <div className="text-[11px] text-muted-foreground/70 font-mono">{t('commands.v2_label')}: {v2}</div> : null;

  const filterRows = (pred: (k: AllKey) => boolean) => dispAll.filter((k) => {
    if (!pred(k)) return false;
    const q = allQ.toLowerCase();
    return !q || k.key.toLowerCase().includes(q) || (k.override ?? k.default).toLowerCase().includes(q);
  });
  const describedTexts = dispAll.filter((row) => row.group !== 'tplvar' && row.group !== 'legacy').map((row) => ({
    ...row, ...(textMetadata.get(row.key) ?? { description: t('commands.unclassified_description'), example: '', categories: ['__unclassified__'] }),
  }));
  const allGroups = [...COMMAND_CATEGORIES.filter((category) => describedTexts.some((row) => row.categories.includes(category))),
    ...new Set(describedTexts.flatMap((row) => row.categories).filter((category) => !COMMAND_CATEGORIES.some((known) => known === category)))];
  const visibleTexts = filterAndSortTexts(describedTexts, allQ, allGroup === '__all_groups__' ? '' : allGroup, allSort, lang);
  const changeSort = (field: TextSortField) => setAllSort((previous) => ({ field,
    direction: previous.field === field && previous.direction === 'asc' ? 'desc' : 'asc' }));
  const SortHead = ({ field, label, help }: { field: TextSortField; label: string; help?: React.ReactNode }) => (
    <th className="p-2.5 text-left font-medium" aria-sort={allSort.field !== field ? 'none' : allSort.direction === 'asc' ? 'ascending' : 'descending'}>
      <div className="inline-flex items-center gap-1.5">
      <button className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-foreground" onClick={() => changeSort(field)}
        aria-label={t('commands.sort_column', { column: label })}>
        {label}{allSort.field === field ? allSort.direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
      </button>
      {help}
      </div>
    </th>
  );

  return (
    <div className="space-y-5">
      {dlg.node}
      <PageHeader icon={BookText} title={t('commands.title')} help={`${t('page_help.commands')}\n\n${t('commands.compat_note')}`}
        description={t('commands.subtitle')}
        actions={<div data-tour="commands-toolbar" className="grid grid-cols-2 items-center gap-2 md:flex md:flex-wrap">
          {/* persona being edited (default = global). Switching shows that persona's reply text. */}
          <Select value={String(personaId)} disabled={!!editing} onValueChange={(v) => setPersonaId(Number(v))}>
            <SelectTrigger className="w-full md:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t('commands.persona_default')}</SelectItem>
              {personas.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={lang} disabled={!!editing} onValueChange={(v) => setLang(v)}>
            <SelectTrigger className="w-full md:w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGS.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <ResponsiveActions actions={[
            { id: 'personas', label: t('commands.persona_manage'), icon: Users, onAction: () => setMgrOpen(true) },
            { id: 'access', label: t('commands.persona_access'), icon: UserCheck, disabled: tourActive, onAction: () => setAccessOpen(true) },
            { id: 'export', label: t('commands.export'), icon: Download, onAction: doExport },
            { id: 'import', label: t('commands.import'), icon: Upload, onAction: () => fileRef.current?.click() },
          ]} />
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ''; }} />
          <Button variant="outline" onClick={() => { void load(); void loadAll(); void loadPersonaMap(); }} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}</Button>
        </div>} />

      {personaError && <p role="alert" className="text-sm text-destructive">{t('common.load_fail')}：{personaError}</p>}
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
      <Tabs value={cat} onValueChange={setCat} className="space-y-5">
      <TabsList variant="page" data-tour="commands-filters" aria-label={t('commands.title')}>
        {cats.map((c) => (
          <TabsTrigger key={c} value={c}>
            {tabLabel(c)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value={cat} data-tour="commands-list" className="mt-0">
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
                  {allGroups.map((group) => <SelectItem key={group} value={group}>{categoryLabel(group)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {cat === ALL_TAB && <div className="flex items-center gap-2 sm:hidden">
              <Select value={allSort.field} onValueChange={(field) => setAllSort((previous) => ({ ...previous, field: field as TextSortField }))}>
                <SelectTrigger className="w-36" aria-label={t('commands.sort_by')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['example', 'description', 'key', 'text'] as const).map((field) => <SelectItem key={field} value={field}>
                    {t(`commands.${field === 'example' ? 'col_command_example' : field === 'description' ? 'col_description' : field === 'key' ? 'col_key' : 'col_text'}`)}
                  </SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => changeSort(allSort.field)}
                aria-label={t(allSort.direction === 'asc' ? 'commands.sort_desc' : 'commands.sort_asc')}>
                {allSort.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              </Button>
            </div>}
          </div>
          {cat === ALL_TAB && !loading && !tourActive && rowsLocale !== lang && <p role="alert" className="text-sm text-destructive">{t('commands.metadata_unavailable')}</p>}
          {allLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="rt-frame rounded-lg border overflow-x-auto">
              <table className="rt rt-record w-full text-sm" style={cat === ALL_TAB ? { tableLayout: 'fixed' } : undefined}>
                {cat === ALL_TAB && <colgroup>
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '24%' }} />
                  <col />
                  <col style={{ width: '5rem' }} />
                </colgroup>}
                <thead className="bg-muted/50 text-muted-foreground">
                  {cat === ALL_TAB ? <tr>
                    <SortHead field="example" label={t('commands.col_command_example')} />
                    <SortHead field="description" label={t('commands.col_description')} />
                    <SortHead field="key" label={t('commands.col_key')} help={<V2Help />} />
                    <SortHead field="text" label={t('commands.col_text')} />
                    <th className="p-2.5 text-left font-medium w-20">{t('common.actions')}</th>
                  </tr> : <tr>
                    <th className="text-left font-medium p-2.5 whitespace-nowrap"><V2Head label={t('commands.col_key')} /></th>
                    {cat === VAR_TAB && <th className="text-left font-medium p-2.5 whitespace-nowrap">{t('commands.col_var')}</th>}
                    <th className="text-left font-medium p-2.5">{cat === ORPHAN_TAB ? t('commands.col_orphan_text') : t('commands.col_text')}</th>
                    <th className="text-left font-medium p-2.5 w-20"></th>
                  </tr>}
                </thead>
                <tbody>
                  {cat === ALL_TAB && visibleTexts.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t('commands.no_matching_text')}</td></tr>}
                  {cat === ALL_TAB && visibleTexts.map((text) => <tr key={text.key} className="border-t align-top hover:bg-muted/30">
                    <td data-label={t('commands.col_command_example')} className="rt-body p-2.5">
                      {text.example ? <code className="text-xs font-mono break-words">{text.example}</code> : <span className="text-xs text-muted-foreground">{t('commands.no_command_example')}</span>}
                    </td>
                    <td data-label={t('commands.col_description')} className="rt-title p-2.5 font-medium break-words">
                      {text.description}
                      {text.override != null && <span className="ml-1 text-amber-600" title={t('commands.modified')}>●</span>}
                    </td>
                    <td data-label={t('commands.col_key')} className="rt-body p-2.5 text-xs font-mono break-all">
                      {text.key}<V2Sub v2={text.v2key} />
                    </td>
                    <td data-label={t('commands.col_text')} className="rt-body p-2.5 text-muted-foreground">
                      {text.outcome && !text.override && <p className="mb-1 text-xs text-primary">{inheritanceLabel(text)}</p>}
                      <div className="line-clamp-3 whitespace-pre-wrap break-words" title={templateSummary(text.effective?.value ?? text.override ?? text.default)}>{templateSummary(text.effective?.value ?? text.override ?? text.default)}</div>
                    </td>
                    <td data-label={t('common.actions')} className="rt-footer p-2.5">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => editKey(text)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" />{t('commands.edit')}
                      </Button>
                    </td>
                  </tr>)}
                  {cat === ORPHAN_TAB && filterRows((k) => k.group === 'legacy').length === 0 && (
                    <tr><td colSpan={3} className="p-8 text-center text-sm text-muted-foreground">{t('commands.orphan_empty')}</td></tr>
                  )}
                  {cat === VAR_TAB && GLOBAL_VARS
                    .filter((name) => { const q = allQ.toLowerCase(); return !q || name.includes(q) || t(`commands.gvar_${name}`).toLowerCase().includes(q); })
                    .map((name) => (
                    <tr key={`gvar-${name}`} className="border-t align-top bg-primary/5">
                      <td data-label={t('commands.col_key')} className="rt-title p-2.5 font-mono text-xs whitespace-nowrap">
                        {name}
                        <div className="text-[11px] text-muted-foreground/70">{t('commands.gvar_badge')}</div>
                      </td>
                      <td data-label={t('commands.col_var')} className="rt-body p-2.5 font-mono text-xs text-primary">{`{${name}}`}</td>
                      <td data-label={t('commands.col_text')} className="rt-body p-2.5 text-muted-foreground w-full max-w-0">
                        <div className="truncate" title={t(`commands.gvar_${name}`)}>{t(`commands.gvar_${name}`)}</div>
                      </td>
                      <td className="p-2.5"></td>
                    </tr>
                  ))}
                  {cat !== ALL_TAB && filterRows((k) =>
                    cat === VAR_TAB ? k.group === 'tplvar' : k.group === 'legacy'
                  ).map((k) => (
                    <tr key={k.key} className="border-t align-top hover:bg-muted/30">
                      <td data-label={t('commands.col_key')} className="rt-title p-2.5 font-mono text-xs whitespace-nowrap">
                        {cat === ORPHAN_TAB ? k.key.replace(/^legacy\./, '') : k.key}
                        {k.override != null && <span className="ml-1 text-amber-600" title={t('commands.modified')}>●</span>}
                        {cat !== ORPHAN_TAB && <V2Sub v2={k.v2key} />}
                      </td>
                      {cat === VAR_TAB && <td data-label={t('commands.col_var')} className="rt-body p-2.5 font-mono text-xs text-primary">{`{${k.key.replace(/^tplvar\./, '')}}`}</td>}
                      <td data-label={t('commands.col_text')} className="rt-body p-2.5 text-muted-foreground w-full max-w-0">
                        <div className="truncate" title={templateSummary(k.override ?? k.default)}>{templateSummary(k.override ?? k.default)}</div>
                      </td>
                      <td data-label={t('common.actions')} className="rt-footer p-2.5">
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
        <div className="rt-frame rounded-lg border overflow-x-auto">
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
                const rowId = c.cmd || c.title;
                const isOpen = expanded.has(rowId);
                const multi = c.replies.length > 1;
                const hasOverride = c.replies.some((r) => r.override != null);
                return (
                  <React.Fragment key={rowId}>
                    <tr className="command-row border-t align-top hover:bg-muted/30">
                      <td data-label={t('common.actions')} className="command-expand p-2.5">
                        {multi && (
                          <button onClick={() => toggle(rowId)} aria-expanded={isOpen} aria-label={`${t('commands.col_reply')} · ${c.title}`} className="text-muted-foreground hover:text-foreground">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                      <td data-label={t('commands.col_title')} className="command-title p-2.5 font-medium whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">{c.title}
                          {c.cmd === '.alias' && <FeatureHelp title={t('shortcuts.title')} description={<div className="whitespace-pre-line">{t('shortcuts.help')}</div>} />}
                        </span>
                      </td>
                      <td data-label={t('commands.col_cmd')} className="command-name p-2.5 font-mono whitespace-nowrap">
                        {c.cmd || <span className="text-xs font-sans text-muted-foreground">{t('commands.automatic_event')}</span>}{hasOverride && <span className="ml-1 text-[11px] text-amber-600">●</span>}
                      </td>
                      <td data-label={t('commands.col_example')} className="command-example p-2.5">
                        <div className="flex flex-wrap gap-1">
                          {c.example && c.example.split(' / ').map((ex, i) => (
                            <code key={i} className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground/80 whitespace-nowrap">{ex}</code>
                          ))}
                        </div>
                      </td>
                      <td data-label={t('commands.col_desc')} className="command-description p-2.5 text-muted-foreground w-full max-w-0">
                        <div className="truncate" title={c.desc}>{c.desc}</div>
                      </td>
                      <td data-label={t('commands.col_reply')} data-empty={c.replies.length === 0} className="command-actions p-2.5">
                        {c.replies.length === 0 ? <span className="text-xs text-muted-foreground">—</span>
                          : multi
                            ? <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => toggle(rowId)} aria-expanded={isOpen}><Pencil className="mr-1 h-3.5 w-3.5" />{t('commands.edit')} ({c.replies.length}){isOpen ? <ChevronDown className="ml-1 h-3.5 w-3.5" /> : <ChevronRight className="ml-1 h-3.5 w-3.5" />}</Button>
                            : <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => beginEdit({ cmd: c.cmd, reply: c.replies[0] })}><Pencil className="mr-1 h-3.5 w-3.5" />{t('commands.edit')}</Button>}
                      </td>
                    </tr>
                    {isOpen && multi && c.replies.map((rep) => (
                      <tr key={rep.key} className="command-reply-row border-t bg-muted/20">
                        <td></td>
                        <td data-label={t('commands.col_title')} className="p-2 pl-4 text-xs text-muted-foreground" colSpan={2}>
                          <span className="font-medium">{replyLabel(rep.key) || c.title}</span>
                          <span className="ml-2 font-mono opacity-60">{rep.key}</span>
                          {rep.override != null && <span className="ml-2 text-amber-600">{t('commands.modified')}</span>}
                          {rep.v2key && <div className="text-[11px] text-muted-foreground/70 font-mono">{t('commands.v2_label')}: {rep.v2key}</div>}
                        </td>
                        <td data-label={t('commands.col_example')} className="p-2">
                          {rep.example && <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground/80 whitespace-nowrap">{rep.example}</code>}
                        </td>
                        <td data-label={t('commands.col_reply')} className="p-2 text-xs text-muted-foreground" colSpan={1}>
                          {rep.outcome && !rep.override && <p className="mb-1 text-primary">{inheritanceLabel(rep)}</p>}
                          <span className="font-mono whitespace-pre-wrap break-words">{templateSummary(rep.effective?.value ?? rep.override ?? rep.default)}</span>
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
      </TabsContent>
      </Tabs>
      {editing && (
        <EditReplyModal lang={lang} cmd={editing.cmd} reply={editing.reply} personaId={personaId}
          description={textMetadata.get(editing.reply.key)?.description ?? replyLabel(editing.reply.key)}
          onClose={closeEditor} onSaved={savedEditor} />
      )}

      {accessOpen && <PersonaAccessDialog onClose={() => setAccessOpen(false)} />}
      {/* C#40: persona management dialog (create / copy / edit / delete / set default) */}
      <Dialog open={mgrOpen} onOpenChange={(o) => { setMgrOpen(o); if (!o) { void fetchPersonas(); void loadPersonaMap(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 pr-6">{t('commands.persona_manage')}
              <FeatureHelp title={t('commands.persona_manage')} description={<p>{t('commands.persona_manage_desc')}</p>} />
            </DialogTitle>
            <DialogDescription className="sr-only">{t('commands.persona_manage_desc')}</DialogDescription>
          </DialogHeader>
          <PersonaManagerCard onChanged={() => { void fetchPersonas(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Edit modal ──────────────────────────────────────────────
const PREVIEW_VALUES: Record<string, string> = {
  nick: '测试玩家', name: '测试玩家', qqnick: '测试玩家', card: '调查员', pcname: '调查员',
  qqnickw: '<测试玩家>', cardw: '<调查员>', pcnamew: '<调查员>', self: 'Dice!Next',
  user: '10001', group: '100000', date: '2026-08-21', time: '20:00:00',
  res: '1D100=42', expr: '1D100', result: '42', reason: '示例检定', turn: '3', attr: '侦查',
  roll: '42', rate: '60', level: '成功', outcome: '成功', total: '18', mod: '+3', detail: '1D20=15+3=18',
};

const inlineMarkdown = (text: string, prefix: string): React.ReactNode[] => {
  const pattern = /(\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\))/g;
  const out: React.ReactNode[] = [];
  let last = 0, index = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const token = match[0];
    const key = `${prefix}-${index++}`;
    if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__')))
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_')))
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    else if (token.startsWith('~~')) out.push(<del key={key}>{token.slice(2, -2)}</del>);
    else if (token.startsWith('`')) out.push(<code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{token.slice(1, -1)}</code>);
    else {
      const parsed = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      out.push(parsed ? <a key={key} href={parsed[2]} className="text-primary underline" target="_blank" rel="noreferrer">{parsed[1]}</a> : token);
    }
    last = start + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

const MarkdownExample: React.FC<{ text: string; enabled: boolean }> = ({ text, enabled }) => {
  if (!enabled) return <div className="whitespace-pre-wrap break-words">{text}</div>;
  return <div className="space-y-1 break-words">{text.split(/\r?\n/).map((line, i) => {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) return <div key={i} className="font-bold" style={{ fontSize: `${Math.max(1, 1.45 - heading[1].length * 0.08)}rem` }}>{inlineMarkdown(heading[2], `h${i}`)}</div>;
    if (/^>\s?/.test(line)) return <blockquote key={i} className="border-l-2 border-primary/40 pl-3 text-muted-foreground">{inlineMarkdown(line.replace(/^>\s?/, ''), `q${i}`)}</blockquote>;
    if (/^[-+*]\s+/.test(line)) return <div key={i} className="flex gap-2"><span>•</span><span>{inlineMarkdown(line.replace(/^[-+*]\s+/, ''), `l${i}`)}</span></div>;
    if (!line) return <div key={i} className="h-2" />;
    return <div key={i}>{inlineMarkdown(line, `p${i}`)}</div>;
  })}</div>;
};

const EditReplyModal: React.FC<{ lang: string; cmd: string; description: string; reply: Reply; personaId: number; onClose: () => void; onSaved: (key: string, value: string | null, format: ReplyFormat) => void }>
  = ({ lang, cmd, description, reply, personaId, onClose, onSaved }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [variants, setVariants] = useState(() => readTemplateVariants(reply.override ?? reply.default));
  const [useInherited, setUseInherited] = useState(!!reply.outcome && !reply.override);
  const [activeIndex, setActiveIndex] = useState(0);
  const text = variants[activeIndex]?.text ?? '';
  const setText = (next: string | ((current: string) => string)) =>
    setVariants(current => current.map((item, i) => i === activeIndex
      ? { ...item, text: typeof next === 'function' ? next(item.text) : next } : item));
  const storedValue = writeTemplateVariants(variants);
  const [resample, setResample] = useState(0);
  const [saving, setSaving] = useState(false);
  const [supportsWeighted, setSupportsWeighted] = useState(false);
  const [backendTooOld, setBackendTooOld] = useState(false);
  const [format, setFormat] = useState<ReplyFormat>(reply.override == null ? reply.defaultFormat : reply.format);
  const [preview, setPreview] = useState<ReplyPreview | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<PreviewPlatform>('qq_group');
  const [previewStyle, setPreviewStyle] = useState('visual');
  const [previewPlain, setPreviewPlain] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [showGlobals, setShowGlobals] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const inheritedSource = reply.inherited?.key.startsWith('dice.outcome.')
    ? `${t(`outcome.families.${reply.inherited.key.split('.')[2]}`)} · ${t(`outcome.grades.${reply.inherited.key.split('.')[3]}`)}`
    : t('outcome.original');
  const inheritedLabel = t('outcome.inherited', { source: reply.inherited?.layer === 'global' && personaId > 0
    ? `${t('outcome.global')} · ${inheritedSource}` : inheritedSource });
  const gradeLabels = Object.fromEntries(['critical', 'extreme', 'hard', 'regular', 'failure', 'fumble', 'special', 'tie']
    .map(grade => [grade, t(`outcome.grades.${grade}`)]));
  const previewKey = useInherited ? reply.inherited?.key ?? reply.key : reply.key;
  const previewArgs = shortcutTemplatePreviewArgs(legacyTemplatePreviewArgs(
    outcomePreviewArgs(PREVIEW_VALUES, reply.outcome, gradeLabels), previewKey, gradeLabels, reply.outcome), previewKey, lang);

  useEffect(() => {
    const controller = new AbortController();
    setPreviewLoading(true); setPreviewFailed(false);
    const timer = window.setTimeout(async () => {
      try {
        if (useInherited && reply.outcome && !reply.inherited) throw new Error('Inherited text unavailable');
        const previewVariants = useInherited ? readTemplateVariants(reply.inherited?.value ?? '') : variants;
        const previewFormat = useInherited ? reply.inherited?.format ?? 'plain' : format;
        const r = await fetch('/api/templates/preview', { method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variants: previewVariants, args: previewArgs, format: previewFormat,
            platform: previewPlatform, style: previewStyle, forcePlain: previewPlain, locale: lang, personaId }) });
        const j = await r.json();
        if (controller.signal.aborted) return;
        if (j.code === 0 && j.data?.templateVersion !== 1) {
          setBackendTooOld(true); throw new Error('Weighted template backend required');
        }
        const next = j.code === 0 ? readReplyPreview(j.data) : null;
        if (!r.ok || !next) throw new Error('Preview unavailable');
        setSupportsWeighted(true); setBackendTooOld(false);
        setPreview(next);
      } catch (e) { if ((e as Error).name !== 'AbortError' && !controller.signal.aborted) { setPreview(null); setPreviewFailed(true); } }
      finally { if (!controller.signal.aborted) setPreviewLoading(false); }
    }, 160);
    return () => { window.clearTimeout(timer); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedValue, format, previewPlatform, previewStyle, previewPlain, resample, useInherited, reply.inherited, lang, personaId]);

  // Command-specific vars (chips) vs global vars (behind the button).
  const exclusiveVars = reply.vars.filter((v) => !GLOBAL_SET.has(v.name));
  const allowed = new Set([...reply.vars.map((v) => v.name), ...GLOBAL_VARS, ...(reply.legacyReferences ?? [])]);
  const used = extractVars(variants.map(item => item.text).join('\n'));
  const unknown = [...new Set(used.filter((u) => !allowed.has(u) && !u.includes('|') && !u.includes(':')))];
  const missing = reply.outcome || reply.legacyCompatibility ? [] : exclusiveVars.map((v) => v.name).filter((n) => !used.includes(n));
  const styledVars = [...new Set(used.filter((name) => allowed.has(name)))];
  const applyVariableStyle = (name: string, style: VariableStyle) => {
    setText((current) => restyleVariable(current, name, style));
    if (style !== 'plain') setFormat('markdown');
  };

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
    if (saving) return;
    if (reply.outcome && (useInherited || storedValue === '')) { await reset(); return; }
    if (!supportsWeighted) { toast({ title: t('weighted.backend_required'), variant: 'destructive' }); return; }
    if (!validWeights(variants)) { toast({ title: t('weighted.invalid_weights'), variant: 'destructive' }); return; }
    if (variants.reduce((bytes, item) => bytes + new TextEncoder().encode(item.text).length, 0) > 65536) {
      toast({ title: t('weighted.text_limit'), variant: 'destructive' }); return;
    }
    if (unknown.length) { toast({ title: t('commands.err_unknown', { vars: unknown.map((u) => `{${u}}`).join(' ') }), variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const r = personaId > 0
        ? await fetch(`/api/personas/${personaId}/entries`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale: lang, key: reply.key, value: storedValue,
              ...(variants.length > 1 ? { variants } : {}), format }) })
        : await fetch('/api/templates', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale: lang, key: reply.key, value: storedValue,
              ...(variants.length > 1 ? { variants } : {}), format }) });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      toast({ title: t('common.save_success') }); onSaved(reply.key, storedValue, format);
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  const reset = async () => {
    if (reply.outcome && reply.override == null) { onSaved(reply.key, null, reply.defaultFormat); return; }
    if (reply.override == null) { setVariants(readTemplateVariants(reply.default)); setActiveIndex(0); setFormat(reply.defaultFormat); return; }
    setSaving(true);
    try {
      const r = personaId > 0
        ? await fetch(`/api/personas/${personaId}/entries`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale: lang, key: reply.key }) })
        : await fetch(`/api/templates/${encodeURIComponent(lang)}/${encodeURIComponent(reply.key)}`, { method: 'DELETE' });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      toast({ title: t('commands.reset_done') }); onSaved(reply.key, null, reply.defaultFormat);
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col overflow-hidden lg:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 pr-6">{description || cmd || reply.key}
            <FeatureHelp title={description || cmd || reply.key} description={<p>{t('commands.var_insert_hint')}</p>} />
          </DialogTitle>
          <DialogDescription className={reply.v2key ? undefined : 'sr-only'}>{t('commands.var_insert_hint')}{reply.v2key ? `　${t('commands.v2_label')}: ${reply.v2key}` : ''}</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 items-start gap-5 overflow-y-auto pr-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          {reply.outcome && <div className="space-y-2 rounded-lg border bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <HelpLabel title={t('outcome.title')} description={<><p>{t('outcome.hint')}</p><p>{t('outcome.preview_hint')}</p></>} labelClassName="text-sm font-medium" />
              <label className="flex items-center gap-2 text-xs">
                {t('outcome.independent')}
                <Switch checked={!useInherited} aria-label={t('outcome.independent')} onCheckedChange={checked => {
                  if (checked && storedValue === '') {
                    setVariants(readTemplateVariants(reply.inherited?.value ?? '')); setActiveIndex(0);
                    setFormat(reply.inherited?.format ?? reply.defaultFormat);
                  }
                  setUseInherited(!checked);
                }} />
              </label>
            </div>
            {useInherited && <p className="text-xs text-muted-foreground">{reply.inherited ? inheritedLabel : t('outcome.unavailable')}</p>}
          </div>}
          {reply.legacyCompatibility && <HelpLabel title={t('legacy_text.title')}
            description={<><p>{t('legacy_text.hint')}</p><p>{t('legacy_text.macros')}</p><p>{t('legacy_text.preview')}</p></>}
            labelClassName="text-sm font-medium" />}
          {!useInherited && <>
          <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{t('commands.edit')}</span><span className="text-xs text-muted-foreground">{t('commands.format_' + format)}</span></div>
          <WeightedTemplateEditor items={variants} onChange={setVariants} activeIndex={activeIndex}
            onActiveIndex={setActiveIndex} textareaRef={taRef} />
          {unknown.length > 0 && <p role="alert" className="text-xs text-destructive">{t('commands.err_unknown', { vars: unknown.map((u) => `{${u}}`).join(' ') })}</p>}
          {missing.length > 0 && unknown.length === 0 && <p className="text-xs text-amber-600">{t('commands.warn_missing', { vars: missing.map((m) => `{${m}}`).join(' ') })}</p>}
          </>}
          <Tabs defaultValue="display" className="rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <HelpLabel title={t('commands.preview_title')} description={<p>{t('commands.preview_hint')}</p>} labelClassName="text-sm font-medium" />
              <Button type="button" size="sm" variant="outline" disabled={useInherited ? !reply.inherited : !validWeights(variants)}
                onClick={() => setResample(current => current + 1)}><RefreshCw className="mr-1 h-3.5 w-3.5" />{t('weighted.resample')}</Button>
              <TabsList aria-label={t('commands.preview_title')}>
                <TabsTrigger value="display" className="px-2.5 text-xs">{t('commands.preview_display')}</TabsTrigger>
                <TabsTrigger value="payload" className="px-2.5 text-xs">{t('commands.preview_payload')}</TabsTrigger>
              </TabsList>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Select value={previewPlatform} onValueChange={value => setPreviewPlatform(value as PreviewPlatform)}>
                <SelectTrigger aria-label={t('commands.preview_platform')}><SelectValue /></SelectTrigger>
                <SelectContent>{PREVIEW_PLATFORMS.map(platform => <SelectItem key={platform} value={platform}>{t(`commands.preview_platform_${platform}`)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={previewStyle} onValueChange={setPreviewStyle}>
                <SelectTrigger aria-label={t('settings.message_style_label')}><SelectValue /></SelectTrigger>
                <SelectContent>{['traditional', 'standard', 'visual'].map(style => <SelectItem key={style} value={style}>{t(`settings.message_style_${style}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs"><Switch checked={previewPlain} onCheckedChange={setPreviewPlain} />{t('commands.preview_force_plain')}</label>
            <p className="mt-2 text-[11px] text-muted-foreground">{t('feature_help.preview_note')}</p>
            {previewLoading ? <p role="status" className="mt-3 text-xs text-muted-foreground">{t('common.loading')}</p>
              : previewFailed ? <p role="alert" className="mt-3 text-xs text-destructive">{t(backendTooOld ? 'weighted.backend_required' : 'commands.preview_unavailable')}</p>
              : preview && <>
                <TabsContent value="display" className="min-h-24 break-words rounded-md bg-background p-3 text-sm">
                  <MarkdownExample text={preview.text} enabled={preview.markdown} />
                  {preview.actions.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{preview.actions.map((action, i) => <span key={i} title={action.text} className="rounded border bg-muted px-2 py-1 text-xs">{action.label} · {action.text}</span>)}</div>}
                </TabsContent>
                <TabsContent value="payload"><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-background p-3 text-xs">{preview.payload === null ? preview.plain : JSON.stringify(preview.payload, null, 2)}</pre></TabsContent>
              </>}
          </Tabs>
        </div>
        {!useInherited && <AdvancedOptions title={t('ui_refresh.advanced_options')} description={t('ui_refresh.template_advanced_hint')}>
        <div className="space-y-4">
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
          <button onClick={() => insertRaw('[[bar:HP|6|10]]')}
            className="inline-flex items-center gap-1 rounded border border-dashed px-2 py-1 text-xs hover:bg-muted transition-colors">
            {t('commands.insert_status_bar')}
          </button>
          <button onClick={() => insertRaw('[[action:掷骰指令|.r]]')}
            className="inline-flex items-center gap-1 rounded border border-dashed px-2 py-1 text-xs hover:bg-muted transition-colors">
            {t('commands.insert_action_hint')}
          </button>
          <input ref={imgRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ''; }} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <HelpLabel title={t('commands.format_label')} description={<><p>{t('commands.format_hint')}</p><p>{t('commands.presentation_component_hint')}</p></>} labelClassName="text-sm font-medium shrink-0" />
          <Select value={format} onValueChange={(v) => setFormat(v as ReplyFormat)}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="plain">{t('commands.format_plain')}</SelectItem>
              <SelectItem value="markdown">{t('commands.format_markdown')}</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{t('commands.format_hint')}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">{t('commands.presentation_component_hint')}</p>

        {styledVars.length > 0 && (
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <div>
              <HelpLabel title={t('commands.variable_styles_title')} description={<p>{t('commands.variable_styles_desc')}</p>} labelClassName="text-sm font-medium" />
              <p className="text-[11px] text-muted-foreground">{t('feature_help.variable_style_note')}</p>
            </div>
            <div className="grid gap-2">
              {styledVars.map((name) => (
                <div key={name} className="flex items-center justify-between gap-2 rounded-md bg-background px-2.5 py-2">
                  <code className="min-w-0 truncate text-xs text-primary">{'{' + name + '}'}</code>
                  <Select value={variableStyleOf(text, name)} onValueChange={(value) => applyVariableStyle(name, value as VariableStyle)}>
                    <SelectTrigger className="h-8 w-28 shrink-0 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VARIABLE_STYLES.map((style) => (
                        <SelectItem key={style} value={style}>{t('commands.variable_style_' + style)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">{t('commands.default_label')}: <span className="font-mono">{reply.default}</span></p>
        </div>
        </AdvancedOptions>}
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t pt-4 sm:gap-2">
          <Button variant="outline" disabled={saving || (storedValue === reply.default && reply.override == null)} onClick={reset}><RotateCcw className="mr-2 h-4 w-4" />{t(reply.outcome ? 'outcome.reset' : 'commands.reset')}</Button>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={saving || (useInherited ? !reply.inherited : !supportsWeighted || unknown.length > 0 || !validWeights(variants))} onClick={save}><Save className="mr-2 h-4 w-4" />{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>

      {/* second-level popup: global variables */}
      <Dialog open={showGlobals} onOpenChange={setShowGlobals}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 pr-6">{t('commands.global_vars_title')}
              <FeatureHelp title={t('commands.global_vars_title')} description={<p>{t('commands.global_vars_desc')}</p>} />
            </DialogTitle>
            <DialogDescription className="sr-only">{t('commands.global_vars_desc')}</DialogDescription>
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
