import { useTourState } from '@/components/onboarding/tour-data';
/**
 * AI 知识库：设置、检索测试与骰主录入的条目。
 * 后端：/api/knowledge/settings (GET/PUT)、/api/knowledge/status、/api/knowledge/search、
 * /api/knowledge/entries (GET/POST/DELETE)、/api/knowledge/import。
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HelpLabel } from '@/components/ui/help-label';
import { FeatureHelp } from '@/components/ui/feature-help';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { AlertTriangle, BookOpen, Loader2, Pencil, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react';

interface KbSettings {
  enabled: boolean; sources: { help: boolean; docs: boolean; custom: boolean };
  top_k: number; min_score: number; max_chars: number; faq_direct: boolean; faq_threshold: number; semantic: boolean;
}
interface KbStatus { help: number; docs: number; custom: number; aiEnabled: boolean; embedModel: boolean; }
interface KbEntry { id: string; title: string; content: string; tags: string[]; questions: string[]; direct: boolean; enabled: boolean; updated_at: number; }
interface KbHit { source: 'help' | 'docs' | 'custom'; id: string; title: string; url: string; text: string; coverage: number; score: number; semantic: number; }
interface KbSearch { hits: KbHit[]; below: KbHit[]; scanned: number; elapsedMs: number; injected: string; injectedChars: number; faq: { id: string; title: string; text: string } | null; faqSimilarity: number; }

const emptySettings = (): KbSettings => ({ enabled: false, sources: { help: true, docs: true, custom: true }, top_k: 3, min_score: 0.45, max_chars: 1200, faq_direct: true, faq_threshold: 0.6, semantic: false });
const emptyEntry = (): KbEntry => ({ id: '', title: '', content: '', tags: [], questions: [], direct: false, enabled: true, updated_at: 0 });
const sampleEntries: KbEntry[] = [
  { id: 'demo-kb-1', title: '开团时间 · 示例', content: '本群每周六晚上八点开团，请提前半小时集合并准备好人物卡。', tags: ['团务'], questions: ['几点开团', '什么时候跑团'], direct: true, enabled: true, updated_at: 1788264000 },
  { id: 'demo-kb-2', title: '团规 · 示例', content: '跑团期间请保持角色扮演，掷骰请使用 .r 或 .ra，场外讨论请加括号。', tags: ['团规'], questions: [], direct: false, enabled: true, updated_at: 1788264000 },
];

async function call(path: string, init?: RequestInit) {
  const r = await fetch('/api' + path, init);
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.message);
  return j.data;
}
const send = (path: string, method: string, body?: unknown) =>
  call(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const lines = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const percent = (v: number) => `${Math.round(v * 100)}%`;

export const KnowledgePage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const dlg = useDialogs();
  const [settings, setSettings] = useTourState<KbSettings>(emptySettings(), { ...emptySettings(), enabled: true });
  const [status, setStatus] = useTourState<KbStatus | null>(null, { help: 128, docs: 786, custom: 2, aiEnabled: true, embedModel: false });
  const [entries, setEntries] = useTourState<KbEntry[]>([], sampleEntries);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<KbSearch | null>(null);
  const [editing, setEditing] = useState<KbEntry | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);   // 关闭动画期间保留内容
  const [questionsText, setQuestionsText] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [entryBusy, setEntryBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try { setSettings({ ...emptySettings(), ...(await call('/knowledge/settings')) }); } catch { /* ignore */ }
    try { setStatus(await call('/knowledge/status')); } catch { /* ignore */ }
    try { setEntries(((await call('/knowledge/entries'))?.entries || []) as KbEntry[]); } catch { /* ignore */ }
  };
  useEffect(() => { void load(); }, []);

  const num = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const patch = (p: Partial<KbSettings>) => setSettings((s) => ({ ...s, ...p }));

  const saveSettings = async () => {
    setSaving(true);
    try { setSettings({ ...emptySettings(), ...(await send('/knowledge/settings', 'PUT', settings)) }); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try { setResult(await send('/knowledge/search', 'POST', { query, settings }) as KbSearch); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSearching(false); }
  };

  const openEditor = (e?: KbEntry) => {
    const entry = e ? { ...e } : emptyEntry();
    setEditing(entry);
    setEditorOpen(true);
    setQuestionsText(entry.questions.join('\n'));
    setTagsText(entry.tags.join(', '));
  };
  const saveEntry = async () => {
    if (!editing) return;
    const entry = { ...editing, questions: lines(questionsText), tags: tagsText.split(/[,，]/).map((s) => s.trim()).filter(Boolean) };
    if (!entry.title.trim() && !entry.content.trim()) { toast({ title: t('knowledge.entry_empty'), variant: 'destructive' }); return; }
    setEntryBusy(true);
    try {
      const saved = await send('/knowledge/entries', 'POST', { entry }) as KbEntry;
      setEntries((list) => (list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]));
      setEditorOpen(false);
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setEntryBusy(false); }
  };
  const toggleEntry = async (e: KbEntry, enabledNow: boolean) => {
    setEntryBusy(true);
    try {
      const saved = await send('/knowledge/entries', 'POST', { entry: { ...e, enabled: enabledNow } }) as KbEntry;
      setEntries((list) => list.map((x) => (x.id === saved.id ? saved : x)));
    } catch (err) { toast({ title: (err as Error).message, variant: 'destructive' }); }
    finally { setEntryBusy(false); }
  };
  const removeEntry = async (e: KbEntry) => {
    if (!(await dlg.confirm({ title: t('knowledge.delete_title'), description: t('knowledge.delete_confirm', { title: e.title || e.id }), destructive: true, confirmText: t('common.delete') }))) return;
    setEntryBusy(true);
    try { await send('/knowledge/entries?id=' + encodeURIComponent(e.id), 'DELETE'); setEntries((list) => list.filter((x) => x.id !== e.id)); }
    catch (err) { toast({ title: (err as Error).message, variant: 'destructive' }); }
    finally { setEntryBusy(false); }
  };
  const importFile = async (file: File) => {
    setEntryBusy(true);
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data?.entries;
      if (!Array.isArray(list)) throw new Error(t('knowledge.import_invalid'));
      const r = await send('/knowledge/import', 'POST', { entries: list }) as { imported: number };
      toast({ title: t('knowledge.import_done', { count: r.imported }) });
      setEntries(((await call('/knowledge/entries'))?.entries || []) as KbEntry[]);
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setEntryBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const sourceLabel = (s: string) => t('knowledge.source_' + s);
  const hitRow = (h: KbHit, dim = false) => (
    <div key={h.source + h.id + h.title} className={`rounded-md border p-2.5 space-y-1 ${dim ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[11px]">{sourceLabel(h.source)}</Badge>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{h.title}</span>
        <span className="text-xs text-muted-foreground">{t('knowledge.coverage', { value: percent(h.coverage) })}</span>
        {h.semantic >= 0 && <span className="text-xs text-muted-foreground">{t('knowledge.semantic_value', { value: h.semantic.toFixed(2) })}</span>}
      </div>
      <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{h.text}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {dlg.node}
      <PageHeader icon={BookOpen} title={t('nav.ai_knowledge')} description={t('knowledge.desc')} help={t('page_help.ai_knowledge')} />

      {status && !status.aiEnabled && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />{t('ai.master_off_hint')}
        </div>
      )}

      {/* 设置 */}
      <Card data-setting-anchor="ai-knowledge">
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="pr-4">
              <div className="flex items-center gap-1.5">
                <Label className="text-sm font-medium">{t('knowledge.enable')}</Label>
                <FeatureHelp title={t('knowledge.enable')} description={<>
                  <p>{t('knowledge.enable_desc')}</p>
                  <p>{t('knowledge.cost_note')}</p>
                </>} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{t('knowledge.enable_desc')}</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(v) => patch({ enabled: v })} />
          </div>
          {settings.enabled && (
            <div className="space-y-3 border-t pt-3">
              <div className="space-y-1.5">
                <HelpLabel title={t('knowledge.sources')} description={<p>{t('knowledge.sources_desc')}</p>} labelClassName="text-xs" />
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {(['help', 'docs', 'custom'] as const).map((k) => (
                    <label key={k} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                      <input type="checkbox" className="accent-primary" checked={settings.sources[k]} onChange={(e) => patch({ sources: { ...settings.sources, [k]: e.target.checked } })} />
                      {sourceLabel(k)}{status && <span className="text-muted-foreground">（{t('knowledge.count', { count: status[k] })}）</span>}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="space-y-1"><HelpLabel title={t('knowledge.top_k')} description={<p>{t('knowledge.top_k_desc')}</p>} labelClassName="text-xs" />
                  <Input type="number" min={1} max={8} className="h-8 text-sm" value={settings.top_k} onChange={(e) => patch({ top_k: num(e.target.value) })} /></div>
                <div className="space-y-1"><HelpLabel title={t('knowledge.min_score')} description={<p>{t('knowledge.min_score_desc')}</p>} labelClassName="text-xs" />
                  <Input type="number" min={0.05} max={1} step={0.05} className="h-8 text-sm" value={settings.min_score} onChange={(e) => patch({ min_score: num(e.target.value) })} /></div>
                <div className="space-y-1"><HelpLabel title={t('knowledge.max_chars')} description={<p>{t('knowledge.max_chars_desc')}</p>} labelClassName="text-xs" />
                  <Input type="number" min={200} max={6000} step={100} className="h-8 text-sm" value={settings.max_chars} onChange={(e) => patch({ max_chars: num(e.target.value) })} /></div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <HelpLabel title={t('knowledge.faq_direct')} description={<p>{t('knowledge.faq_direct_desc')}</p>} labelClassName="text-sm font-medium" />
                <div className="flex items-center gap-3">
                  {settings.faq_direct && (
                    <label className="flex items-center gap-1.5 text-xs">{t('knowledge.faq_threshold')}
                      <Input type="number" min={0.3} max={1} step={0.05} className="h-7 w-20 text-xs" value={settings.faq_threshold} onChange={(e) => patch({ faq_threshold: num(e.target.value) })} />
                    </label>
                  )}
                  <Switch checked={settings.faq_direct} onCheckedChange={(v) => patch({ faq_direct: v })} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <HelpLabel title={t('knowledge.semantic')} description={<p>{t('knowledge.semantic_desc')}</p>} labelClassName="text-sm font-medium" />
                  {status && !status.embedModel && <p className="text-[11px] text-muted-foreground mt-0.5">{t('knowledge.semantic_need_model')}</p>}
                </div>
                <Switch checked={settings.semantic} disabled={!!status && !status.embedModel && !settings.semantic} onCheckedChange={(v) => patch({ semantic: v })} />
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={saveSettings} disabled={saving}>{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}{t('common.save')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* 检索测试 */}
      <Card data-setting-anchor="ai-knowledge-test">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">{t('knowledge.test_title')}
            <FeatureHelp title={t('knowledge.test_title')} description={<p>{t('knowledge.test_desc')}</p>} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void runSearch(); }}>
            <Input className="h-9 flex-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('knowledge.test_ph')} aria-label={t('knowledge.test_title')} />
            <Button type="submit" size="sm" className="h-9" disabled={searching || !query.trim()}>{searching ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}{t('knowledge.test_run')}</Button>
          </form>
          {result && (
            <div className="space-y-2.5">
              <p className="text-xs text-muted-foreground">{t('knowledge.test_stats', { scanned: result.scanned, ms: result.elapsedMs, hits: result.hits.length })}</p>
              {result.faq ? (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 text-xs space-y-1">
                  <div className="font-medium">{t('knowledge.faq_hit', { title: result.faq.title, value: percent(result.faqSimilarity) })}</div>
                  <div className="whitespace-pre-wrap break-words">{result.faq.text}</div>
                </div>
              ) : settings.faq_direct && result.faqSimilarity > 0 && (
                <p className="text-xs text-muted-foreground">{t('knowledge.faq_miss', { value: percent(result.faqSimilarity) })}</p>
              )}
              {result.hits.length === 0 && !result.faq && <p className="text-xs text-muted-foreground italic">{t('knowledge.test_none')}</p>}
              {result.hits.map((h) => hitRow(h))}
              {result.hits.length > 0 && <p className="text-xs text-muted-foreground">{t('knowledge.test_injected', { count: result.injectedChars })}</p>}
              {result.below.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">{t('knowledge.test_below', { count: result.below.length })}</summary>
                  <div className="mt-2 space-y-2">{result.below.map((h) => hitRow(h, true))}</div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 自定义条目 */}
      <Card data-setting-anchor="ai-knowledge-entries">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base flex items-center gap-2">{t('knowledge.entries')} ({entries.length})
            <FeatureHelp title={t('knowledge.entries')} description={<><p>{t('knowledge.entries_desc')}</p><p>{t('knowledge.import_desc')}</p></>} />
          </CardTitle>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }} />
            <Button size="sm" variant="outline" disabled={entryBusy} onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-4 w-4" />{t('knowledge.import')}</Button>
            <Button size="sm" variant="outline" disabled={entryBusy} onClick={() => openEditor()}><Plus className="mr-1 h-4 w-4" />{t('knowledge.add')}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {entries.length === 0 && <p className="text-xs text-muted-foreground italic py-4 text-center">{t('knowledge.empty')}</p>}
          {entries.map((e) => (
            <div key={e.id} className="rounded-md border p-2.5 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Switch aria-label={t('common.enabled') + ' ' + (e.title || e.id)} disabled={entryBusy} checked={e.enabled} onCheckedChange={(v) => void toggleEntry(e, v)} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.title || t('knowledge.untitled')}</span>
                {e.direct && <Badge variant="secondary" className="text-[11px]">{t('knowledge.direct_badge')}</Badge>}
                {e.tags.map((tag) => <Badge key={tag} variant="outline" className="text-[11px]">{tag}</Badge>)}
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t('common.edit')} title={t('common.edit')} disabled={entryBusy} onClick={() => openEditor(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label={t('common.delete')} title={t('common.delete')} disabled={entryBusy} onClick={() => void removeEntry(e)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              {e.questions.length > 0 && <p className="text-[11px] text-muted-foreground">{t('knowledge.questions_list', { list: e.questions.join(t('ai.usage_list_sep')) })}</p>}
              <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{e.content}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={(open) => { if (!open && !entryBusy) setEditorOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">{editing?.id ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editing?.id ? t('knowledge.edit') : t('knowledge.add')}</DialogTitle>
            <DialogDescription className="sr-only">{t('knowledge.entries_desc')}</DialogDescription>
          </DialogHeader>
          {editing && (
            <fieldset disabled={entryBusy} className="min-w-0 space-y-3">
              <div className="space-y-1.5"><Label className="font-normal">{t('knowledge.title')}</Label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder={t('knowledge.title_ph')} /></div>
              <div className="space-y-1.5"><Label className="font-normal">{t('knowledge.content')}</Label>
                <Textarea rows={6} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} placeholder={t('knowledge.content_ph')} /></div>
              <div className="space-y-1.5"><HelpLabel title={t('knowledge.questions')} description={<p>{t('knowledge.questions_desc')}</p>} labelClassName="font-normal text-sm" />
                <Textarea rows={3} value={questionsText} onChange={(e) => setQuestionsText(e.target.value)} placeholder={t('knowledge.questions_ph')} /></div>
              <div className="space-y-1.5"><Label className="font-normal">{t('knowledge.tags')}</Label>
                <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder={t('knowledge.tags_ph')} /></div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <HelpLabel title={t('knowledge.direct')} description={<p>{t('knowledge.direct_desc')}</p>} labelClassName="text-sm font-medium" />
                <Switch checked={editing.direct} onCheckedChange={(v) => setEditing({ ...editing, direct: v })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={() => void saveEntry()}>{entryBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{t('common.save')}</Button>
                <Button variant="outline" onClick={() => setEditorOpen(false)}><X className="mr-2 h-4 w-4" />{t('common.cancel')}</Button>
              </div>
            </fieldset>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default KnowledgePage;
