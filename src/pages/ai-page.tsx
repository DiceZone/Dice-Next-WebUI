import { AiMemoryDialog } from '@/components/ai-memory-dialog';
import { useTourState } from '@/components/onboarding/tour-data';
import { tourSamples } from '@/lib/tour-samples';
/**
 * 人工智能：模型管理和功能设置。开关单独即时保存，表单保存只提交当前页面。
 * 后端：/api/system/ai (GET/PUT)、/api/system/ai/test (POST)。
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FeatureHelp } from '@/components/ui/feature-help';
import { HelpLabel } from '@/components/ui/help-label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { providerPresets, modelPresets, providerPresetId, primaryAiUsages } from '@/lib/ai-presets';
import { useToast } from '@/hooks/use-toast';
import { PlatformIcon } from '@/components/platform-icon';
import { Sparkles, Plus, Trash2, Loader2, AlertTriangle, Wand2, Languages, MessageCircle, Drama, ArrowUp, ArrowDown, Route, Pencil } from 'lucide-react';

interface AiProvider { id: string; name: string; base_url: string; api_key: string; enabled: boolean; }
type ModelKind = 'chat' | 'embedding';
interface AiModel {
  id: string; name: string; provider_id: string; model: string; kind: ModelKind; vision: boolean;
  enabled: boolean; price_in: number; price_out: number;
  token_limit: number; cost_limit: number; used_tokens: number; used_cost: number;
}
type Strategy = 'balance' | 'random' | 'priority' | 'weight';
interface UsageEntry { id: string; weight: number; }
interface Usage { models: UsageEntry[]; strategy: Strategy; }
type Usages = Record<string, Usage>;
// 与后端 ai_usage.h 的 usageDefs 一一对应；fallback = 未分配时的去向。
const USAGES: { key: string; kind: ModelKind; vision?: boolean; fallback: string }[] = [
  { key: 'reply', kind: 'chat', fallback: 'first' },
  { key: 'decision', kind: 'chat', fallback: 'reply' },
  { key: 'polish', kind: 'chat', fallback: 'reply' },
  { key: 'translate', kind: 'chat', fallback: 'reply' },
  { key: 'summary', kind: 'chat', fallback: 'reply' },
  { key: 'extract', kind: 'chat', fallback: 'reply' },
  { key: 'npc', kind: 'chat', fallback: 'reply' },
  { key: 'mood', kind: 'chat', fallback: 'npc' },
  { key: 'vision', kind: 'chat', vision: true, fallback: 'reply' },
  { key: 'speech', kind: 'chat', fallback: 'none' },
  { key: 'embed', kind: 'embedding', fallback: 'none' },
];
const STRATEGIES: Strategy[] = ['balance', 'random', 'priority', 'weight'];
const emptyUsages = (): Usages => Object.fromEntries(USAGES.map((u) => [u.key, { models: [], strategy: u.key === 'embed' ? 'priority' : 'balance' }]));
interface Speech { enabled: boolean; }
interface TestResult { ok: boolean; reply: string; error: string; latencyMs: number; totalTokens: number; cost: number; }
type Cov = { roll: boolean; deck: boolean; fun: boolean; custom: boolean; plugin: boolean };
interface Params { temperature: number; top_p: number; max_tokens: number; frequency_penalty: number; presence_penalty: number; }
interface Polish { enabled: boolean; mode: string; persona: string; prompt: string; cov: Cov; }
interface AiLang { name: string; keywords: string[]; }
interface Translate { enabled: boolean; prompt: string; cov: Cov; langs: AiLang[]; }

const emptyCov = (roll = true, others = false): Cov => ({ roll, deck: others, fun: others, custom: others, plugin: others });
const emptyParams = (): Params => ({ temperature: 0.7, top_p: 1, max_tokens: 1024, frequency_penalty: 0, presence_penalty: 0 });
const emptyPolish = (): Polish => ({ enabled: false, mode: 'text', persona: '', prompt: '', cov: emptyCov(true, false) });
const emptyTranslate = (): Translate => ({ enabled: false, prompt: '', cov: emptyCov(true, true), langs: [] });
interface Chat { enabled: boolean; persona: string; prompt: string; at_bot: boolean; keywords: string[]; standby_prob: number; decision: boolean; context_rounds: number; max_chars: number; cooldown_sec: number; reply_at: boolean; no_emoji: boolean; filters: string[]; }
const emptyChat = (): Chat => ({ enabled: false, persona: '', prompt: '', at_bot: true, keywords: [], standby_prob: 0, decision: false, context_rounds: 10, max_chars: 200, cooldown_sec: 5, reply_at: false, no_emoji: true, filters: [] });
interface MemoryShort { enabled: boolean; rounds: number; max_chars: number; summary_prompt: string; }
interface MemoryLong { enabled: boolean; top_k: number; min_similarity: number; max_facts: number; extract_prompt: string; }
interface Memory { short: MemoryShort; long: MemoryLong; }
const emptyMemory = (): Memory => ({
  short: { enabled: false, rounds: 20, max_chars: 400, summary_prompt: '' },
  long: { enabled: false, top_k: 4, min_similarity: 0.75, max_facts: 300, extract_prompt: '' },
});
interface Tools { enabled: boolean; roll_dice: boolean; draw_deck: boolean; get_attr: boolean; set_attr: boolean; run_command: boolean; search_help: boolean; max_rounds: number; }
const emptyTools = (): Tools => ({ enabled: false, roll_dice: true, draw_deck: true, get_attr: true, set_attr: false, run_command: true, search_help: true, max_rounds: 3 });
interface Vision { enabled: boolean; prompt: string; max_images: number; max_image_kb: number; pass_url: boolean; }
const emptyVision = (): Vision => ({ enabled: false, prompt: '', max_images: 2, max_image_kb: 1024, pass_url: false });
interface WlEntry { platform: string; id: string; is_group: boolean; name?: string; }
interface Whitelist { enabled: boolean; list: WlEntry[]; }
const emptyWhitelist = (): Whitelist => ({ enabled: false, list: [] });
interface PickGroup { platform: string; groupId: string; name: string; }
interface PickPlayer { platform: string; userId: string; nickname: string; }
interface Npc { id: string; name: string; persona: string; knowledge: string; triggers: string[]; model_id: string; group: string; enabled: boolean; mood_enabled: boolean; }
interface NpcConf { enabled: boolean; list: Npc[]; }
const emptyNpcConf = (): NpcConf => ({ enabled: false, list: [] });
const emptyNpc = (): Npc => ({ id: 'npc' + Math.random().toString(36).slice(2, 10), name: '', persona: '', knowledge: '', triggers: [], model_id: '', group: '', enabled: true, mood_enabled: false });
const emptyModel = (provider_id = ''): AiModel => ({
  id: 'm' + Math.random().toString(36).slice(2, 10), name: '', provider_id, model: '', kind: 'chat', vision: false,
  enabled: true, price_in: 0, price_out: 0, token_limit: 0, cost_limit: 0,
  used_tokens: 0, used_cost: 0,
});
const emptyProvider = (): AiProvider => ({ id: 'p' + Math.random().toString(36).slice(2, 10), name: '', base_url: 'https://api.openai.com/v1', api_key: '', enabled: true });

async function jget(path: string) { const r = await fetch('/api' + path); const j = await r.json(); if (j.code !== 0) throw new Error(j.message); return j.data; }
async function jput(path: string, body: unknown) { const r = await fetch('/api' + path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (j.code !== 0) throw new Error(j.message); return j.data; }
async function jpost(path: string, body: unknown) { const r = await fetch('/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (j.code !== 0) throw new Error(j.message); return j.data; }

function sectionFromHash(): 'models' | 'polish' | 'translate' | 'chat' | 'npc' {
  const h = window.location.hash;
  if (h.includes('/ai/polish')) return 'polish';
  if (h.includes('/ai/translate')) return 'translate';
  if (h.includes('/ai/npc')) return 'npc';
  if (h.includes('/ai/chat')) return 'chat';
  return 'models';
}

export const AiPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [section, setSection] = useState<'models' | 'polish' | 'translate' | 'chat' | 'npc'>(sectionFromHash());
  const [enabled, setEnabled] = useTourState(false, true);
  const [providers, setProviders] = useTourState<AiProvider[]>([], tourSamples.aiProviders);
  const [models, setModels] = useTourState<AiModel[]>([], tourSamples.models);
  const [usages, setUsages] = useTourState<Usages>(emptyUsages(), { ...emptyUsages(), reply: { models: [{ id: 'demo-model', weight: 1 }], strategy: 'balance' } });
  const [speech, setSpeech] = useTourState<Speech>({ enabled: false }, { enabled: false });
  const [modelTab, setModelTab] = useState<'providers' | 'models' | 'usages'>('providers');
  const [params, setParams] = useTourState<Params>(emptyParams(), emptyParams());
  const [polish, setPolish] = useTourState<Polish>(emptyPolish(), { ...emptyPolish(), enabled: true, persona: '星灯：温柔、简洁的故事旁白。' });
  const [trans, setTrans] = useTourState<Translate>(emptyTranslate(), { ...emptyTranslate(), enabled: true, langs: [{ name: '英语', keywords: ['英语', 'English'] }] });
  const [chat, setChat] = useTourState<Chat>(emptyChat(), { ...emptyChat(), enabled: true, persona: '你是星灯，陪伴调查员冒险的骰子助手。', keywords: ['星灯'] });
  const [memory, setMemory] = useTourState<Memory>(emptyMemory(), { ...emptyMemory(), short: { ...emptyMemory().short, enabled: true } });
  const [tools, setTools] = useTourState<Tools>(emptyTools(), { ...emptyTools(), enabled: true });
  const [vision, setVision] = useTourState<Vision>(emptyVision(), emptyVision());
  const [npc, setNpc] = useTourState<NpcConf>(emptyNpcConf(), { enabled: true, list: [{ id: 'demo-npc', name: '灯塔守望者 · 示例', persona: '一位熟悉雾港旧事的守塔人。', knowledge: '每到深夜，旧港口会传来钟声。', triggers: ['守塔人'], model_id: 'demo-model', group: 'demo-group', enabled: true, mood_enabled: true }] });
  const [wl, setWl] = useTourState<Whitelist>(emptyWhitelist(), { enabled: true, list: [{ platform: 'onebot_v11', id: 'demo-group', is_group: true, name: '周末调查团 · 示例' }] });
  const [wlPick, setWlPick] = useState('');
  const [wlPicking, setWlPicking] = useState(false);
  const [pickGroups, setPickGroups] = useTourState<PickGroup[]>([], tourSamples.groups);
  const [pickPlayers, setPickPlayers] = useTourState<PickPlayer[]>([], tourSamples.players);
  const [saving, setSaving] = useState(false);
  const writeBusy = useRef(false);
  const [providerDraft, setProviderDraft] = useState<AiProvider | null>(null);
  const [modelDraft, setModelDraft] = useState<AiModel | null>(null);
  const [advancedUsages, setAdvancedUsages] = useState(false);
  const autoSave = async (body: unknown, apply: () => void) => {
    if (writeBusy.current) return;
    writeBusy.current = true; setSaving(true);
    try { await jput('/system/ai', body); apply(); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { writeBusy.current = false; setSaving(false); }
  };
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [defaults, setDefaults] = useState<{ polish_text: string; polish_rp: string; translate: string; chat: string; summary: string; extract: string; vision: string; decision?: string }>({ polish_text: '', polish_rp: '', translate: '', chat: '', summary: '', extract: '', vision: '' });

  useEffect(() => {
    // 设置搜索带 ?focus= 跳到模型页某个选项卡时，先切到对应选项卡（未显示的锚点找不到）。
    const syncTab = () => {
      const focus = new URLSearchParams(window.location.hash.split('?')[1] || '').get('focus') || '';
      if (focus.startsWith('ai-usage-') && !primaryAiUsages.includes(focus.slice(9))) setAdvancedUsages(true);
      if (focus === 'ai-providers') setModelTab('providers');
      else if (focus === 'ai-models') setModelTab('models');
      else if (focus === 'ai-usages' || focus.startsWith('ai-usage-')) setModelTab('usages');
    };
    syncTab();
    window.addEventListener('hashchange', syncTab);
    return () => window.removeEventListener('hashchange', syncTab);
  }, []);

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const applyData = (d: { enabled?: boolean; providers?: AiProvider[]; models?: AiModel[]; usages?: Partial<Usages>; speech?: Partial<Speech>; params?: Partial<Params>; polish?: Partial<Polish>; translate?: Partial<Translate>; chat?: Partial<Chat>; memory?: { short?: Partial<MemoryShort>; long?: Partial<MemoryLong> }; tools?: Partial<Tools>; vision?: Partial<Vision>; npc?: Partial<NpcConf>; whitelist?: Partial<Whitelist>; defaults?: { polish_text: string; polish_rp: string; translate: string; chat: string; summary: string; extract: string; vision: string } }) => {
    setEnabled(!!d.enabled);
    setProviders((d.providers || []).map((p: AiProvider) => ({ ...emptyProvider(), ...p })));
    setModels((d.models || []).map((m: AiModel) => ({ ...emptyModel(), ...m })));
    setUsages(Object.fromEntries(USAGES.map((u) => [u.key, { ...emptyUsages()[u.key], ...(d.usages?.[u.key] || {}) }])));
    setSpeech({ enabled: !!d.speech?.enabled });
    setParams({ ...emptyParams(), ...(d.params || {}) });
    setPolish({ ...emptyPolish(), ...(d.polish || {}), cov: { ...emptyCov(true, false), ...(d.polish?.cov || {}) } });
    setTrans({ ...emptyTranslate(), ...(d.translate || {}), cov: { ...emptyCov(true, true), ...(d.translate?.cov || {}) } });
    setChat({ ...emptyChat(), ...(d.chat || {}) });
    setMemory({ short: { ...emptyMemory().short, ...(d.memory?.short || {}) }, long: { ...emptyMemory().long, ...(d.memory?.long || {}) } });
    setTools({ ...emptyTools(), ...(d.tools || {}) });
    setVision({ ...emptyVision(), ...(d.vision || {}) });
    setNpc({ enabled: !!d.npc?.enabled, list: (d.npc?.list || []).map((n) => ({ ...emptyNpc(), ...n })) });
    setWl({ enabled: !!d.whitelist?.enabled, list: d.whitelist?.list || [] });
    if (d.defaults) setDefaults(d.defaults);
  };
  useEffect(() => { (async () => { try { applyData(await jget('/system/ai')); } catch { /* ignore */ } })(); }, []);
  // 白名单选择器数据源（首次展开时懒加载群/玩家列表）。
  useEffect(() => {
    if (!wlPicking || pickGroups.length || pickPlayers.length) return;
    (async () => {
      try { const g = await jget('/groups'); if (Array.isArray(g)) setPickGroups(g as PickGroup[]); } catch { /* ignore */ }
      try { const p = await jget('/players'); if (Array.isArray(p)) setPickPlayers(p as PickPlayer[]); } catch { /* ignore */ }
    })();
  }, [wlPicking, pickGroups.length, pickPlayers.length]);

  // 阶段E：NPC 列表增删改。
  const patchNpc = (i: number, p: Partial<Npc>) => setNpc((c) => ({ ...c, list: c.list.map((n, idx) => (idx === i ? { ...n, ...p } : n)) }));
  const addNpc = () => setNpc((c) => ({ ...c, list: [...c.list, emptyNpc()] }));
  const delNpc = (i: number) => setNpc((c) => ({ ...c, list: c.list.filter((_, idx) => idx !== i) }));

  const patch = (i: number, p: Partial<AiModel>) => setModels((ms) => ms.map((m, idx) => (idx === i ? { ...m, ...p } : m)));
  const addModel = () => setModelDraft(emptyModel(providers[0]?.id || ''));
  const delModel = (i: number) => {
    const id = models[i]?.id;
    setModels((ms) => ms.filter((_, idx) => idx !== i));
    setUsages((us) => Object.fromEntries(Object.entries(us).map(([k, u]) => [k, { ...u, models: u.models.filter((e) => e.id !== id) }])));
  };
  const patchProvider = (i: number, p: Partial<AiProvider>) => setProviders((ps) => ps.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  const addProvider = () => setProviderDraft(emptyProvider());
  const delProvider = (i: number) => {
    const id = providers[i]?.id;
    const used = models.filter((m) => m.provider_id === id).length;
    if (used > 0) { toast({ title: t('ai.provider_in_use', { count: used }), variant: 'destructive' }); return; }
    setProviders((ps) => ps.filter((_, idx) => idx !== i));
  };
  // 用途分配：增删模型、调整顺序/权重、切换策略。
  const patchUsage = (key: string, p: Partial<Usage>) => setUsages((us) => ({ ...us, [key]: { ...us[key], ...p } }));
  const addUsageModel = (key: string, id: string) => setUsages((us) => {
    const cur = us[key];
    if (cur.models.some((e) => e.id === id)) return us;
    const list = key === 'embed' ? [{ id, weight: 1 }] : [...cur.models, { id, weight: 1 }];
    return { ...us, [key]: { ...cur, models: list } };
  });
  const moveUsageModel = (key: string, i: number, dir: -1 | 1) => setUsages((us) => {
    const list = [...us[key].models];
    const j = i + dir;
    if (j < 0 || j >= list.length) return us;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...us, [key]: { ...us[key], models: list } };
  });
  const usageFits = (u: (typeof USAGES)[number], m: AiModel) => m.kind === u.kind && (!u.vision || m.vision);
  const modelLabel = (id: string) => { const m = models.find((x) => x.id === id); return m ? (m.name || m.model || m.id) : id; };
  // 各功能页里原先的模型下拉改成指向用途分配的提示。
  const usageHint = (key: string) => {
    const list = usages[key]?.models || [];
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Route className="h-3.5 w-3.5 shrink-0" />
        <span>{t('ai.usage_hint', { usage: t('ai.usage_' + key) })}</span>
        <span className="text-foreground">{list.length ? list.map((e) => modelLabel(e.id)).join(t('ai.usage_list_sep')) : t('ai.usage_unassigned_' + (USAGES.find((u) => u.key === key)?.fallback === 'none' ? 'none' : 'fallback'))}</span>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { window.location.hash = '#/ai?focus=ai-usage-' + key; setModelTab('usages'); }}>{t('ai.usage_goto')}</Button>
      </div>
    );
  };
  const num = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  const save = async () => {
    if (writeBusy.current) return;
    writeBusy.current = true; setSaving(true);
    try {
      const body = section === 'models' ? { enabled, providers, models, usages, params }
        : section === 'polish' ? { polish } : section === 'translate' ? { translate: trans }
        : section === 'npc' ? { npc } : { chat, memory, tools, vision, speech, whitelist: wl };
      await jput('/system/ai', body);
      toast({ title: t('common.save_success') });
    }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { writeBusy.current = false; setSaving(false); }
  };

  const [memoryKind, setMemoryKind] = useState<'summary' | 'fact' | null>(null);

  const test = async (m: AiModel) => {
    setTesting((s) => ({ ...s, [m.id]: true }));
    setResults((s) => { const c = { ...s }; delete c[m.id]; return c; });
    try { const r = await jpost('/system/ai/test', { model: m, provider: providers.find((p) => p.id === m.provider_id) }) as TestResult; setResults((s) => ({ ...s, [m.id]: r })); }
    catch (e) { setResults((s) => ({ ...s, [m.id]: { ok: false, reply: '', error: (e as Error).message, latencyMs: 0, totalTokens: 0, cost: 0 } })); }
    finally { setTesting((s) => ({ ...s, [m.id]: false })); }
  };

  // NPC 专属模型下拉
  const modelSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value || '__first__'} onValueChange={(v) => onChange(v === '__first__' ? '' : v)}>
      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__first__">{t('ai.npc_model_default')}</SelectItem>
        {models.filter((m) => m.enabled && m.kind === 'chat').map((m) => <SelectItem key={m.id} value={m.id}>{m.name || m.model}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  // 覆盖范围（5 类别复选）
  const coverage = (cov: Cov, set: (c: Cov) => void, key: 'polish' | 'translate') => (
    <div className="space-y-1">
      <HelpLabel title={t('ai.cov')} description={<p>{t('ai.cov_desc')}</p>} labelClassName="text-xs" />
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
        {(['roll', 'deck', 'fun', 'custom', 'plugin'] as const).map((k) => (
          <label key={k} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <input type="checkbox" className="accent-primary" checked={!!cov[k]} onChange={(e) => { const value = e.target.checked; void autoSave({ [key]: { cov: { [k]: value } } }, () => set({ ...cov, [k]: value })); }} />
            {t('ai.cov_' + k)}
          </label>
        ))}
      </div>
    </div>
  );

  const titleKey = section === 'polish' ? 'ai.sec_polish' : section === 'translate' ? 'ai.sec_translate' : section === 'chat' ? 'ai.sec_chat' : section === 'npc' ? 'ai.sec_npc' : 'ai.sec_models';
  const TitleIcon = section === 'polish' ? Wand2 : section === 'translate' ? Languages : section === 'chat' ? MessageCircle : section === 'npc' ? Drama : Sparkles;

  return (
    <div className="space-y-6">
      <PageHeader icon={TitleIcon} title={t(titleKey)} description={t('ai.desc')} help={`${t(`page_help.ai_${section}`)}\n\n${t('ai.stage_note')}`} />


      <AiMemoryDialog kind={memoryKind} onClose={() => setMemoryKind(null)} />
      <Dialog open={!!providerDraft} onOpenChange={(open) => { if (!open) setProviderDraft(null); }}>
        <DialogContent><DialogHeader><DialogTitle>{t(providers.some((p) => p.id === providerDraft?.id) ? 'ai.edit_provider' : 'ai.add_provider')}</DialogTitle></DialogHeader>
          {providerDraft && <div className="space-y-4">
            <Label>{t('ai.preset')}</Label><Select value="" onValueChange={(id) => { const preset = providerPresets.find((p) => p.id === id); if (preset) setProviderDraft({ ...providerDraft, name: preset.name, base_url: preset.base_url, api_key: '' }); }}><SelectTrigger><SelectValue placeholder={t('ai.preset_pick')} /></SelectTrigger><SelectContent>{providerPresets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            <div className="space-y-1"><Label>{t('ai.provider_name_ph')}</Label><Input value={providerDraft.name} onChange={(e) => setProviderDraft({ ...providerDraft, name: e.target.value })} /></div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1"><Label className="text-xs">{t('ai.base_url')}</Label>
                      <Input className="h-8 text-sm" value={providerDraft.base_url} onChange={(e) => setProviderDraft({ ...providerDraft, base_url: e.target.value })} placeholder="https://api.openai.com/v1" /></div>
                    <div className="space-y-1"><Label className="text-xs">{t('ai.api_key')}</Label>
                      <Input type="password" className="h-8 text-sm" value={providerDraft.api_key} onChange={(e) => setProviderDraft({ ...providerDraft, api_key: e.target.value })} placeholder={t('ai.api_key_ph')} /></div>
                  </div>
            <DialogFooter><Button variant="outline" onClick={() => setProviderDraft(null)}>{t('common.cancel')}</Button><Button disabled={!providerDraft.name.trim() || !/^https?:\/\//.test(providerDraft.base_url)} onClick={() => { setProviders((ps) => ps.some((p) => p.id === providerDraft.id) ? ps.map((p) => p.id === providerDraft.id ? providerDraft : p) : [...ps, providerDraft]); setProviderDraft(null); }}>{t('common.ok')}</Button></DialogFooter>
          </div>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!modelDraft} onOpenChange={(open) => { if (!open) setModelDraft(null); }}>
        <DialogContent layout="editor" className="max-w-2xl"><DialogHeader><DialogTitle>{t(models.some((m) => m.id === modelDraft?.id) ? 'ai.edit_model' : 'ai.add_model')}</DialogTitle></DialogHeader>
          {modelDraft && <><DialogBody className="space-y-4 pr-2">
            <div className="space-y-1"><Label>{t('ai.preset')}</Label><Select value="" onValueChange={(id) => { const preset = modelPresets.find((p) => p.model === id); if (preset) setModelDraft({ ...modelDraft, name: preset.name, model: preset.model, kind: preset.kind, vision: preset.vision, price_in: preset.price_in, price_out: preset.price_out }); }}><SelectTrigger><SelectValue placeholder={t('ai.preset_pick')} /></SelectTrigger><SelectContent>{modelPresets.filter((p) => p.provider === providerPresetId(providers.find((x) => x.id === modelDraft.provider_id)?.base_url || '')).map((p) => <SelectItem key={p.model} value={p.model}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <p className="text-xs text-muted-foreground">{t('ai.preset_pricing_note')}</p>
            <div className="space-y-1"><Label>{t('ai.name_ph')}</Label><Input value={modelDraft.name} onChange={(e) => setModelDraft({ ...modelDraft, name: e.target.value })} /></div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="space-y-1"><Label className="text-xs">{t('ai.provider')}</Label>
                        <Select value={modelDraft.provider_id || '__none__'} onValueChange={(v) => setModelDraft({ ...modelDraft, provider_id: v === '__none__' ? '' : v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {!modelDraft.provider_id && <SelectItem value="__none__">{t('ai.provider_pick')}</SelectItem>}
                            {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name || p.base_url}</SelectItem>)}
                          </SelectContent>
                        </Select></div>
                      <div className="space-y-1"><Label className="text-xs">{t('ai.model_id')}</Label>
                        <Input className="h-8 text-sm" value={modelDraft.model} onChange={(e) => setModelDraft({ ...modelDraft, model: e.target.value })} placeholder={modelDraft.kind === 'embedding' ? 'text-embedding-3-small / bge-m3 …' : 'gpt-4o-mini / qwen2.5 …'} /></div>
                      <div className="space-y-1"><HelpLabel title={t('ai.model_kind')} description={<p>{t('ai.model_kind_desc')}</p>} labelClassName="text-xs" />
                        <Select value={modelDraft.kind} onValueChange={(v) => {
                          setModelDraft({ ...modelDraft, kind: v as ModelKind, vision: v === 'chat' ? modelDraft.vision : false });

                        }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="chat">{t('ai.kind_chat')}</SelectItem>
                            <SelectItem value="embedding">{t('ai.kind_embedding')}</SelectItem>
                          </SelectContent>
                        </Select></div>
                      {modelDraft.kind === 'chat' && (
                        <div className="flex items-center justify-between rounded-md border px-2.5 py-1.5 sm:mt-5">
                          <HelpLabel title={t('ai.model_vision')} description={<p>{t('ai.model_vision_desc')}</p>} labelClassName="text-xs" />
                          <Switch checked={modelDraft.vision} onCheckedChange={(v) => {
                            setModelDraft({ ...modelDraft, vision: v });
                          }} />
                        </div>
                      )}
                      <div className="space-y-1"><Label className="text-xs">{t('ai.price_in')}</Label>
                        <Input type="number" className="h-8 text-sm" value={modelDraft.price_in} onChange={(e) => setModelDraft({ ...modelDraft, price_in: num(e.target.value) })} /></div>
                      {modelDraft.kind === 'chat' && <div className="space-y-1"><Label className="text-xs">{t('ai.price_out')}</Label>
                        <Input type="number" className="h-8 text-sm" value={modelDraft.price_out} onChange={(e) => setModelDraft({ ...modelDraft, price_out: num(e.target.value) })} /></div>}
                      <div className="space-y-1"><Label className="text-xs">{t('ai.token_limit')}</Label>
                        <Input type="number" className="h-8 text-sm" value={modelDraft.token_limit} onChange={(e) => setModelDraft({ ...modelDraft, token_limit: num(e.target.value) })} /></div>
                      <div className="space-y-1"><Label className="text-xs">{t('ai.cost_limit')}</Label>
                        <Input type="number" className="h-8 text-sm" value={modelDraft.cost_limit} onChange={(e) => setModelDraft({ ...modelDraft, cost_limit: num(e.target.value) })} /></div>
                    </div>
          </DialogBody><DialogFooter><Button variant="outline" onClick={() => setModelDraft(null)}>{t('common.cancel')}</Button><Button disabled={!modelDraft.provider_id || !modelDraft.model.trim()} onClick={() => {
            setModels((ms) => ms.some((m) => m.id === modelDraft.id) ? ms.map((m) => m.id === modelDraft.id ? modelDraft : m) : [...ms, modelDraft]);
            setUsages((us) => Object.fromEntries(Object.entries(us).map(([k, u]) => [k, { ...u, models: u.models.filter((e) => e.id !== modelDraft.id || usageFits(USAGES.find((x) => x.key === k)!, modelDraft)) }])));
            setModelDraft(null);
          }}>{t('common.ok')}</Button></DialogFooter></>}
        </DialogContent>
      </Dialog>

      <fieldset disabled={saving} className="min-w-0 space-y-6">
      {section !== 'models' && <p className="text-xs text-muted-foreground">{t('ai.switch_autosave')}</p>}
      {/* ══ 模型 section ══ */}
      {section === 'models' && (<>
        <Card data-setting-anchor="ai-master">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <HelpLabel title={t('ai.master')} description={<p>{t('ai.master_desc')}</p>} labelClassName="text-sm font-medium" />
                <p className="text-xs text-muted-foreground mt-0.5">{t('ai.master_desc')}</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            {enabled && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">{t('ai.warn')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 全局请求参数 */}
        <Card data-setting-anchor="ai-params">
          <CardContent className="py-4 space-y-2">
            <HelpLabel title={t('ai.params')} description={<p>{t('ai.params_desc')}</p>} labelClassName="text-sm font-medium" />
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
              {([['temperature', 'ai.temperature'], ['top_p', 'ai.top_p'], ['max_tokens', 'ai.max_tokens'], ['frequency_penalty', 'ai.freq_penalty'], ['presence_penalty', 'ai.pres_penalty']] as const).map(([k, lk]) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs">{t(lk)}</Label>
                  <Input type="number" className="h-8 text-sm" value={params[k]} onChange={(e) => setParams((p) => ({ ...p, [k]: num(e.target.value) }))} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs value={modelTab} onValueChange={(v) => setModelTab(v as typeof modelTab)} className="space-y-4">
          <TabsList variant="page" aria-label={t('ai.models')}>
            <TabsTrigger value="providers">{t('ai.tab_providers')}</TabsTrigger>
            <TabsTrigger value="models">{t('ai.tab_models')}</TabsTrigger>
            <TabsTrigger value="usages">{t('ai.tab_usages')}</TabsTrigger>
          </TabsList>

          {/* 提供商 */}
          <TabsContent value="providers" className="mt-0 space-y-3" data-setting-anchor="ai-providers">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{t('ai.providers_desc')}</p>
              <Button size="sm" variant="outline" onClick={addProvider}><Plus className="mr-1 h-4 w-4" />{t('ai.add_provider')}</Button>
            </div>
            {providers.length === 0 && <p className="text-xs text-muted-foreground italic py-4 text-center">{t('ai.no_providers')}</p>}
            {providers.map((p, i) => (
              <Card key={p.id}><CardContent className="flex items-center gap-3 p-4">
                <Switch aria-label={t('common.enabled') + ' ' + p.name} checked={p.enabled} onCheckedChange={(v) => patchProvider(i, { enabled: v })} />
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{p.name || p.base_url}</p><p className="truncate text-xs text-muted-foreground">{p.base_url}</p><p className="text-xs text-muted-foreground">{t('ai.provider_models', { count: models.filter((m) => m.provider_id === p.id).length })}</p></div>
                <Button size="icon" variant="ghost" aria-label={t('common.edit') + ' ' + p.name} onClick={() => setProviderDraft({ ...p })}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label={t('common.delete') + ' ' + p.name} onClick={() => delProvider(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardContent></Card>
            ))}
          </TabsContent>

          {/* 模型 */}
          <TabsContent value="models" className="mt-0 space-y-3" data-setting-anchor="ai-models">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{t('ai.models_desc')}</p>
              <Button size="sm" variant="outline" onClick={addModel} disabled={providers.length === 0}><Plus className="mr-1 h-4 w-4" />{t('ai.add_model')}</Button>
            </div>
            {providers.length === 0 && <p className="text-xs text-muted-foreground italic py-4 text-center">{t('ai.provider_none')}</p>}
            {providers.length > 0 && models.length === 0 && <p className="text-xs text-muted-foreground italic py-4 text-center">{t('ai.no_models')}</p>}
            {models.map((m, i) => {
              const res = results[m.id];
              return <Card key={m.id}><CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <Switch aria-label={t('common.enabled') + ' ' + (m.name || m.model)} checked={m.enabled} onCheckedChange={(v) => patch(i, { enabled: v })} />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{m.name || m.model}</p><p className="truncate text-xs text-muted-foreground">{providers.find((p) => p.id === m.provider_id)?.name} · {m.model}</p></div>
                  <Badge variant="secondary">{t('ai.kind_' + m.kind)}</Badge>
                  <Button size="icon" variant="ghost" aria-label={t('common.edit') + ' ' + m.name} onClick={() => setModelDraft({ ...m })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={t('common.delete') + ' ' + m.name} onClick={() => delModel(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div><p>{t('ai.preset_cost', { input: m.price_in, output: m.price_out })}</p><p>{t('ai.usage', { tokens: m.used_tokens, cost: m.used_cost.toFixed(4) })}</p></div>
                  <Button size="sm" variant="outline" disabled={!!testing[m.id]} onClick={() => test(m)}>{testing[m.id] && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}{t('ai.test')}</Button>
                </div>
                    {res && (
                      <div className={`rounded-md border p-2 text-xs ${res.ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-destructive/40 bg-destructive/5'}`}>
                        {res.ok ? (<>
                          <div className="text-muted-foreground mb-1">{t('ai.test_ok', { ms: res.latencyMs, tokens: res.totalTokens, cost: res.cost.toFixed(5) })}</div>
                          <div className="whitespace-pre-wrap break-words">{res.reply}</div>
                        </>) : (<div className="text-destructive break-words">{t('ai.test_fail')}: {res.error}</div>)}
                      </div>
                    )}
              </CardContent></Card>;
            })}
          </TabsContent>

          {/* 用途分配 */}
          <TabsContent value="usages" className="mt-0 space-y-3" data-setting-anchor="ai-usages">
            <p className="text-xs text-muted-foreground">{t('ai.usages_desc')}</p>
            <Button variant="outline" aria-expanded={advancedUsages} onClick={() => setAdvancedUsages(!advancedUsages)}>{t('ai.advanced_usages')}</Button>
            {USAGES.filter((u) => advancedUsages || primaryAiUsages.includes(u.key)).sort((a, b) => Number(!primaryAiUsages.includes(a.key)) - Number(!primaryAiUsages.includes(b.key))).map((u) => {
              const cur = usages[u.key] || emptyUsages()[u.key];
              const candidates = models.filter((m) => usageFits(u, m) && !cur.models.some((e) => e.id === m.id));
              const single = u.key === 'embed';
              return (
                <Card key={u.key} data-setting-anchor={'ai-usage-' + u.key}>
                  <CardContent className="py-3 space-y-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <HelpLabel title={t('ai.usage_' + u.key)} description={<p>{t('ai.usage_' + u.key + '_desc')}</p>} labelClassName="text-sm font-medium" />
                        <p className="text-[11px] text-muted-foreground mt-0.5">{cur.models.length ? '' : t('ai.usage_fallback_' + u.fallback)}</p>
                      </div>
                      {!single && (
                        <div className="w-40 shrink-0">
                          <Select value={cur.strategy} onValueChange={(v) => patchUsage(u.key, { strategy: v as Strategy })}>
                            <SelectTrigger className="h-8 text-xs" aria-label={t('ai.strategy')}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STRATEGIES.map((st) => <SelectItem key={st} value={st}>{t('ai.strategy_' + st)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    {single && <p className="text-[11px] text-muted-foreground">{t('ai.usage_embed_single')}</p>}
                    {!single && cur.models.length > 1 && <p className="text-[11px] text-muted-foreground">{t('ai.strategy_' + cur.strategy + '_desc')}</p>}
                    <div className="space-y-1.5">
                      {cur.models.map((e, i) => (
                        <div key={e.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                          {!single && cur.strategy === 'priority' && <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>}
                          <span className="min-w-0 flex-1 truncate text-sm">{modelLabel(e.id)}</span>
                          {cur.strategy === 'weight' && !single && (
                            <Input type="number" className="h-7 w-20 text-xs" aria-label={t('ai.weight')} value={e.weight}
                              onChange={(ev) => patchUsage(u.key, { models: cur.models.map((x, idx) => (idx === i ? { ...x, weight: Math.max(1, Math.min(100, num(ev.target.value))) } : x)) })} />
                          )}
                          {!single && cur.strategy === 'priority' && (<>
                            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t('ai.move_up')} disabled={i === 0} onClick={() => moveUsageModel(u.key, i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t('ai.move_down')} disabled={i === cur.models.length - 1} onClick={() => moveUsageModel(u.key, i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                          </>)}
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label={t('common.delete')} onClick={() => patchUsage(u.key, { models: cur.models.filter((_, idx) => idx !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      ))}
                    </div>
                    {candidates.length > 0 && (!single || cur.models.length === 0) && (
                      <Select value="" onValueChange={(v) => addUsageModel(u.key, v)}>
                        <SelectTrigger className="h-8 text-xs max-w-xs"><SelectValue placeholder={t('ai.usage_add')} /></SelectTrigger>
                        <SelectContent>
                          {candidates.map((m) => <SelectItem key={m.id} value={m.id}>{m.name || m.model}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    {candidates.length === 0 && cur.models.length === 0 && <p className="text-[11px] text-muted-foreground italic">{t(u.kind === 'embedding' ? 'ai.usage_no_embedding' : u.vision ? 'ai.usage_no_vision' : 'ai.usage_no_chat')}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </>)}

      {/* ══ 润色 section ══ */}
      {section === 'polish' && (
        <Card data-setting-anchor="ai-polish">
          <CardContent className="py-4 space-y-3">
            {!enabled && (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />{t('ai.master_off_hint')}
              </div>
            )}
            <div className={enabled ? '' : 'opacity-50 pointer-events-none select-none'}>
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium">{t('ai.polish')}</Label>
                  <FeatureHelp title={t('ai.polish')} description={<>
                    <p>{t('ai.polish_desc')}</p>
                    <p>{t('ai.polish_note')}</p>
                  </>} />
                </div>
              </div>
              <Switch checked={polish.enabled} onCheckedChange={(v) => void autoSave({ polish: { enabled: v } }, () => setPolish((p) => ({ ...p, enabled: v })))} />
            </div>
            {polish.enabled && (
              <div className="space-y-2.5 border-t pt-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">{usageHint('polish')}</div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('ai.polish_mode')}</Label>
                    <Select value={polish.mode} onValueChange={(v) => setPolish((p) => ({ ...p, mode: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">{t('ai.polish_mode_text')}</SelectItem>
                        <SelectItem value="rp">{t('ai.polish_mode_rp')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {coverage(polish.cov, (c) => setPolish((p) => ({ ...p, cov: c })), 'polish')}
                <div className="space-y-1">
                  <Label className="text-xs">{t('ai.polish_persona')}</Label>
                  <Textarea className="text-sm min-h-[60px]" value={polish.persona} onChange={(e) => setPolish((p) => ({ ...p, persona: e.target.value }))} placeholder={t('ai.polish_persona_ph')} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <HelpLabel title={t('ai.polish_prompt')} description={<p>{t('ai.polish_prompt_note')}</p>} labelClassName="text-xs" />
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPolish((p) => ({ ...p, prompt: p.mode === 'rp' ? defaults.polish_rp : defaults.polish_text }))}>
                      <Wand2 className="mr-1 h-3 w-3" />{t('ai.load_default')}
                    </Button>
                  </div>
                  <Textarea className="text-sm min-h-[100px]" value={polish.prompt} onChange={(e) => setPolish((p) => ({ ...p, prompt: e.target.value }))} placeholder={t('ai.polish_prompt_ph')} />
                </div>
                <p className="text-[11px] text-muted-foreground">{t('ai.polish_note')}</p>
              </div>
            )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ 翻译 section ══ */}
      {section === 'translate' && (
        <Card data-setting-anchor="ai-translate">
          <CardContent className="py-4 space-y-3">
            {!enabled && (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />{t('ai.master_off_hint')}
              </div>
            )}
            <div className={enabled ? '' : 'opacity-50 pointer-events-none select-none'}>
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium">{t('ai.trans')}</Label>
                  <FeatureHelp title={t('ai.trans')} description={<>
                    <p>{t('ai.trans_desc')}</p>
                    <p>{t('ai.trans_note')}</p>
                  </>} />
                </div>
              </div>
              <Switch checked={trans.enabled} onCheckedChange={(v) => void autoSave({ translate: { enabled: v } }, () => setTrans((p) => ({ ...p, enabled: v })))} />
            </div>
            {trans.enabled && (
              <div className="space-y-2.5 border-t pt-3">
                {usageHint('translate')}
                {coverage(trans.cov, (c) => setTrans((p) => ({ ...p, cov: c })), 'translate')}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{t('ai.trans_langs')}</Label>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTrans((p) => ({ ...p, langs: [...p.langs, { name: '', keywords: [] }] }))}>
                      <Plus className="mr-1 h-3 w-3" />{t('common.add')}
                    </Button>
                  </div>
                  {trans.langs.length === 0 && <p className="text-[11px] text-muted-foreground italic">{t('ai.trans_no_langs')}</p>}
                  {trans.langs.map((l, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input className="h-8 text-sm w-32" value={l.name} placeholder={t('ai.trans_lang_name')}
                        onChange={(e) => setTrans((p) => ({ ...p, langs: p.langs.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x) }))} />
                      <Input className="h-8 text-sm flex-1" value={l.keywords.join(', ')} placeholder={t('ai.trans_lang_kw')}
                        onChange={(e) => setTrans((p) => ({ ...p, langs: p.langs.map((x, idx) => idx === i ? { ...x, keywords: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) } : x) }))} />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => setTrans((p) => ({ ...p, langs: p.langs.filter((_, idx) => idx !== i) }))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <HelpLabel title={t('ai.trans_prompt')} description={<p>{t('ai.trans_prompt_note')}</p>} labelClassName="text-xs" />
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTrans((p) => ({ ...p, prompt: defaults.translate }))}>
                      <Wand2 className="mr-1 h-3 w-3" />{t('ai.load_default')}
                    </Button>
                  </div>
                  <Textarea className="text-sm min-h-[100px]" value={trans.prompt} onChange={(e) => setTrans((p) => ({ ...p, prompt: e.target.value }))} placeholder={t('ai.trans_prompt_ph')} />
                </div>
                <p className="text-[11px] text-muted-foreground">{t('ai.trans_note')}</p>
              </div>
            )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ 对话 section（智能化阶段A） ══ */}
      {section === 'chat' && (<>
        <Card data-setting-anchor="ai-chat">
          <CardContent className="py-4 space-y-3">
            {!enabled && (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />{t('ai.master_off_hint')}
              </div>
            )}
            <div className={enabled ? '' : 'opacity-50 pointer-events-none select-none'}>
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-medium">{t('ai.chat')}</Label>
                    <FeatureHelp title={t('ai.chat')} description={<>
                      <p>{t('ai.chat_desc')}</p>
                      <p>{t('ai.chat_note')}</p>
                    </>} />
                  </div>
                </div>
                <Switch checked={chat.enabled} onCheckedChange={(v) => void autoSave({ chat: { enabled: v } }, () => setChat((p) => ({ ...p, enabled: v })))} />
              </div>
              {chat.enabled && (
                <div className="space-y-2.5 border-t pt-3">
                  {usageHint('reply')}

                  <div className="space-y-1.5 rounded-md border p-2.5">
                    <HelpLabel title={t('ai.chat_trigger')} description={<p>{t('ai.chat_trigger_desc')}</p>} labelClassName="text-xs font-medium" />
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                      <input type="checkbox" className="accent-primary" checked={chat.at_bot} onChange={(e) => { const checked = e.target.checked; void autoSave({ chat: { at_bot: checked } }, () => setChat((p) => ({ ...p, at_bot: checked }))) }} />
                      {t('ai.chat_at_bot')}
                    </label>
                    <div className="space-y-1"><Label className="text-xs">{t('ai.chat_keywords')}</Label>
                      <Input className="h-8 text-sm" value={chat.keywords.join(', ')} placeholder={t('ai.chat_keywords_ph')}
                        onChange={(e) => setChat((p) => ({ ...p, keywords: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">{t('ai.chat_standby')}</Label>
                      <Input type="number" className="h-8 text-sm w-28" value={chat.standby_prob} onChange={(e) => setChat((p) => ({ ...p, standby_prob: num(e.target.value) }))} /></div>
                    <div className="flex items-center gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                        <input type="checkbox" className="accent-primary" checked={chat.decision} onChange={(e) => { const checked = e.target.checked; void autoSave({ chat: { decision: checked } }, () => setChat((p) => ({ ...p, decision: checked }))) }} />
                        {t('ai.chat_decision')}
                      </label>
                      <FeatureHelp title={t('ai.chat_decision')} description={<p>{t('ai.chat_decision_desc')}</p>} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="space-y-1"><Label className="text-xs">{t('ai.chat_rounds')}</Label>
                      <Input type="number" className="h-8 text-sm" value={chat.context_rounds} onChange={(e) => setChat((p) => ({ ...p, context_rounds: num(e.target.value) }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">{t('ai.chat_maxchars')}</Label>
                      <Input type="number" className="h-8 text-sm" value={chat.max_chars} onChange={(e) => setChat((p) => ({ ...p, max_chars: num(e.target.value) }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">{t('ai.chat_cooldown')}</Label>
                      <Input type="number" className="h-8 text-sm" value={chat.cooldown_sec} onChange={(e) => setChat((p) => ({ ...p, cooldown_sec: num(e.target.value) }))} /></div>
                  </div>

                  <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input type="checkbox" className="accent-primary" checked={chat.reply_at} onChange={(e) => { const checked = e.target.checked; void autoSave({ chat: { reply_at: checked } }, () => setChat((p) => ({ ...p, reply_at: checked }))) }} />
                    {t('ai.chat_reply_at')}
                  </label>

                  <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input type="checkbox" className="accent-primary" checked={chat.no_emoji} onChange={(e) => { const checked = e.target.checked; void autoSave({ chat: { no_emoji: checked } }, () => setChat((p) => ({ ...p, no_emoji: checked }))) }} />
                    {t('ai.chat_no_emoji')}
                  </label>

                  <div className="space-y-1">
                    <HelpLabel title={t('ai.chat_filters')} description={<p>{t('ai.chat_filters_note')}</p>} labelClassName="text-xs" />
                    <Textarea className="text-sm min-h-[60px] font-mono" value={chat.filters.join('\n')}
                      placeholder={t('ai.chat_filters_ph')}
                      onChange={(e) => setChat((p) => ({ ...p, filters: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) }))} />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">{t('ai.chat_persona')}</Label>
                    <Textarea className="text-sm min-h-[60px]" value={chat.persona} onChange={(e) => setChat((p) => ({ ...p, persona: e.target.value }))} placeholder={t('ai.chat_persona_ph')} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t('ai.chat_prompt')}</Label>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setChat((p) => ({ ...p, prompt: defaults.chat }))}>
                        <Wand2 className="mr-1 h-3 w-3" />{t('ai.load_default')}
                      </Button>
                    </div>
                    <Textarea className="text-sm min-h-[100px]" value={chat.prompt} onChange={(e) => setChat((p) => ({ ...p, prompt: e.target.value }))} placeholder={t('ai.chat_prompt_ph')} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t('ai.chat_note')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ══ 记忆（短期滚动摘要，智能化阶段B） ══ */}
        <Card data-setting-anchor="ai-memory-short">
          <CardContent className="py-4 space-y-3">
            <div className={enabled ? '' : 'opacity-50 pointer-events-none select-none'}>
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-medium">{t('ai.mem')}</Label>
                    <FeatureHelp title={t('ai.mem')} description={<>
                      <p>{t('ai.mem_desc')}</p>
                      <p>{t('ai.mem_note')}</p>
                    </>} />
                  </div>
                </div>
                <Switch checked={memory.short.enabled} onCheckedChange={(v) => void autoSave({ memory: { short: { enabled: v } } }, () => setMemory((p) => ({ ...p, short: { ...p.short, enabled: v } })))} />
              </div>
              {memory.short.enabled && (
                <div className="mt-3 space-y-3">
                  {usageHint('summary')}
                  <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><Label className="text-xs">{t('ai.mem_rounds')}</Label>
                      <Input type="number" className="h-8 text-sm" value={memory.short.rounds} onChange={(e) => setMemory((p) => ({ ...p, short: { ...p.short, rounds: num(e.target.value) } }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">{t('ai.mem_maxchars')}</Label>
                      <Input type="number" className="h-8 text-sm" value={memory.short.max_chars} onChange={(e) => setMemory((p) => ({ ...p, short: { ...p.short, max_chars: num(e.target.value) } }))} /></div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t('ai.mem_prompt')}</Label>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMemory((p) => ({ ...p, short: { ...p.short, summary_prompt: defaults.summary } }))}>
                        <Wand2 className="mr-1 h-3 w-3" />{t('ai.load_default')}
                      </Button>
                    </div>
                    <Textarea className="text-sm min-h-[80px]" value={memory.short.summary_prompt} onChange={(e) => setMemory((p) => ({ ...p, short: { ...p.short, summary_prompt: e.target.value } }))} placeholder={t('ai.mem_prompt_ph')} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t('ai.mem_note')}</p>

                  <div className="flex items-center justify-between rounded-md border p-3"><Label>{t('ai.mem_stored')}</Label><Button size="sm" variant="outline" onClick={() => setMemoryKind('summary')}>{t('ai.mem_view')}</Button></div>
                </div>
              )}

              {/* ── 长期记忆（向量检索，阶段C）── */}
              <div data-setting-anchor="ai-memory-long" className="mt-4 border-t pt-3">
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-sm font-medium">{t('ai.mlong')}</Label>
                      <FeatureHelp title={t('ai.mlong')} description={<>
                        <p>{t('ai.mlong_desc')}</p>
                        <p>{t('ai.mlong_note')}</p>
                      </>} />
                    </div>
                  </div>
                  <Switch checked={memory.long.enabled} onCheckedChange={(v) => void autoSave({ memory: { long: { enabled: v } } }, () => setMemory((p) => ({ ...p, long: { ...p.long, enabled: v } })))} />
                </div>
                {memory.long.enabled && (
                  <div className="mt-3 space-y-3">
                    {usageHint('embed')}
                    {usageHint('extract')}
                    <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="space-y-1"><Label className="text-xs">{t('ai.mlong_topk')}</Label>
                        <Input type="number" className="h-8 text-sm" value={memory.long.top_k} onChange={(e) => setMemory((p) => ({ ...p, long: { ...p.long, top_k: num(e.target.value) } }))} /></div>
                      <div className="space-y-1"><Label className="text-xs">{t('ai.mlong_minsim')}</Label>
                        <Input type="number" step="0.05" className="h-8 text-sm" value={memory.long.min_similarity} onChange={(e) => setMemory((p) => ({ ...p, long: { ...p.long, min_similarity: num(e.target.value) } }))} /></div>
                      <div className="space-y-1"><Label className="text-xs">{t('ai.mlong_maxfacts')}</Label>
                        <Input type="number" className="h-8 text-sm" value={memory.long.max_facts} onChange={(e) => setMemory((p) => ({ ...p, long: { ...p.long, max_facts: num(e.target.value) } }))} /></div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">{t('ai.mlong_prompt')}</Label>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMemory((p) => ({ ...p, long: { ...p.long, extract_prompt: defaults.extract } }))}>
                          <Wand2 className="mr-1 h-3 w-3" />{t('ai.load_default')}
                        </Button>
                      </div>
                      <Textarea className="text-sm min-h-[80px]" value={memory.long.extract_prompt} onChange={(e) => setMemory((p) => ({ ...p, long: { ...p.long, extract_prompt: e.target.value } }))} placeholder={t('ai.mlong_prompt_ph')} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t('ai.mlong_note')}</p>

                  <div className="flex items-center justify-between rounded-md border p-3"><Label>{t('ai.mlong_stored')}</Label><Button size="sm" variant="outline" onClick={() => setMemoryKind('fact')}>{t('ai.mem_view')}</Button></div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ══ 工具调用（智能化阶段D） ══ */}
        <Card data-setting-anchor="ai-tools">
          <CardContent className="py-4 space-y-3">
            <div className={enabled ? '' : 'opacity-50 pointer-events-none select-none'}>
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-medium">{t('ai.tools')}</Label>
                    <FeatureHelp title={t('ai.tools')} description={<>
                      <p>{t('ai.tools_desc')}</p>
                      <p>{t('ai.tools_note')}</p>
                    </>} />
                  </div>
                </div>
                <Switch checked={tools.enabled} onCheckedChange={(v) => void autoSave({ tools: { enabled: v } }, () => setTools((p) => ({ ...p, enabled: v })))} />
              </div>
              {tools.enabled && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">{t('ai.tools_enabled_list')}</Label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-primary" checked={tools.roll_dice} onChange={(e) => { const checked = e.target.checked; void autoSave({ tools: { roll_dice: checked } }, () => setTools((p) => ({ ...p, roll_dice: checked }))) }} />
                      {t('ai.tools_roll_dice')}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-primary" checked={tools.draw_deck} onChange={(e) => { const checked = e.target.checked; void autoSave({ tools: { draw_deck: checked } }, () => setTools((p) => ({ ...p, draw_deck: checked }))) }} />
                      {t('ai.tools_draw_deck')}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-primary" checked={tools.get_attr} onChange={(e) => { const checked = e.target.checked; void autoSave({ tools: { get_attr: checked } }, () => setTools((p) => ({ ...p, get_attr: checked }))) }} />
                      {t('ai.tools_get_attr')}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-primary" checked={tools.set_attr} onChange={(e) => { const checked = e.target.checked; void autoSave({ tools: { set_attr: checked } }, () => setTools((p) => ({ ...p, set_attr: checked }))) }} />
                      {t('ai.tools_set_attr')}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-primary" checked={tools.run_command} onChange={(e) => { const checked = e.target.checked; void autoSave({ tools: { run_command: checked } }, () => setTools((p) => ({ ...p, run_command: checked }))) }} />
                      {t('ai.tools_run_command')}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-primary" checked={tools.search_help} onChange={(e) => { const checked = e.target.checked; void autoSave({ tools: { search_help: checked } }, () => setTools((p) => ({ ...p, search_help: checked }))) }} />
                      {t('ai.tools_search_help')}
                    </label>
                  </div>
                  <div className="space-y-1 max-w-[12rem]">
                    <Label className="text-xs">{t('ai.tools_max_rounds')}</Label>
                    <Input type="number" className="h-8 text-sm" value={tools.max_rounds} onChange={(e) => setTools((p) => ({ ...p, max_rounds: num(e.target.value) }))} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t('ai.tools_note')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ══ AI 白名单（访问控制：仅白名单群/私聊可用 AI，非白名单群 .ai on 也拒绝） ══ */}
        <Card data-setting-anchor="ai-whitelist">
          <CardContent className="py-4 space-y-3">
            <div className={enabled ? '' : 'opacity-50 pointer-events-none select-none'}>
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-medium">{t('ai.wl')}</Label>
                    <FeatureHelp title={t('ai.wl')} description={<>
                      <p>{t('ai.wl_desc')}</p>
                      <p>{t('ai.wl_note')}</p>
                    </>} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('ai.wl_desc')}</p>
                </div>
                <Switch checked={wl.enabled} onCheckedChange={(v) => void autoSave({ whitelist: { enabled: v } }, () => setWl((p) => ({ ...p, enabled: v })))} />
              </div>
              {wl.enabled && (
                <div className="mt-3 space-y-2">
                  {wl.list.length === 0 && <p className="text-xs text-muted-foreground">{t('ai.wl_empty')}</p>}
                  {wl.list.map((e, i) => (
                    <div key={e.platform + e.id + i} className="flex items-center gap-2 rounded border px-2 py-1.5 text-sm">
                      <Badge variant="secondary" className="shrink-0">{e.is_group ? t('ai.wl_group') : t('ai.wl_user')}</Badge>
                      <span>{e.name || e.id}</span>
                      <span className="font-mono text-xs text-muted-foreground">{e.id}</span>
                      <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0 text-destructive"
                        onClick={() => setWl((p) => ({ ...p, list: p.list.filter((_, idx) => idx !== i) }))}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                  {wlPicking ? (
                    <div className="rounded border p-2 space-y-1">
                      <Input autoFocus className="h-8 text-sm" value={wlPick} placeholder={t('ai.wl_pick_ph')} onChange={(e) => setWlPick(e.target.value)} />
                      {(() => {
                        const s = wlPick.trim().toLowerCase();
                        const add = (platform: string, id: string, isGroup: boolean, name: string) => {
                          if (wl.list.some((x) => x.platform === platform && x.id === id && x.is_group === isGroup)) return;
                          setWl((p) => ({ ...p, list: [...p.list, { platform, id, is_group: isGroup, name }] }));
                          setWlPicking(false); setWlPick('');
                        };
                        const gs = pickGroups.filter((g) => !s || g.groupId.toLowerCase().includes(s) || (g.name || '').toLowerCase().includes(s)).slice(0, 5);
                        const ps = pickPlayers.filter((p) => !s || p.userId.toLowerCase().includes(s) || (p.nickname || '').toLowerCase().includes(s)).slice(0, 5);
                        if (gs.length === 0 && ps.length === 0) return <p className="text-xs text-muted-foreground py-1 text-center">{t('ai.wl_pick_none')}</p>;
                        return (<>
                          {gs.map((g) => (
                            <button key={'g' + g.platform + g.groupId} className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted text-left"
                              onClick={() => add(g.platform, g.groupId, true, g.name)}>
                              <PlatformIcon platform={g.platform} />
                              <Badge variant="secondary" className="shrink-0">{t('ai.wl_group')}</Badge>
                              <span>{g.name}</span><span className="font-mono text-xs text-muted-foreground">{g.groupId}</span>
                            </button>
                          ))}
                          {ps.map((p) => (
                            <button key={'p' + p.platform + p.userId} className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted text-left"
                              onClick={() => add(p.platform, p.userId, false, p.nickname)}>
                              <PlatformIcon platform={p.platform} />
                              <Badge variant="secondary" className="shrink-0">{t('ai.wl_user')}</Badge>
                              <span>{p.nickname || p.userId}</span><span className="font-mono text-xs text-muted-foreground">{p.userId}</span>
                            </button>
                          ))}
                        </>);
                      })()}
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setWlPicking(false); setWlPick(''); }}>{t('common.cancel')}</Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setWlPicking(true)}><Plus className="mr-1 h-3 w-3" />{t('ai.wl_add')}</Button>
                  )}
                  <p className="text-[11px] text-muted-foreground">{t('ai.wl_note')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ══ 图像识别（多模态，C#85） ══ */}
        <Card data-setting-anchor="ai-vision">
          <CardContent className="py-4 space-y-3">
            <div className={enabled ? '' : 'opacity-50 pointer-events-none select-none'}>
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-medium">{t('ai.vision')}</Label>
                    <FeatureHelp title={t('ai.vision')} description={<>
                      <p>{t('ai.vision_desc')}</p>
                      <p>{t('ai.vision_note')}</p>
                    </>} />
                  </div>
                </div>
                <Switch checked={vision.enabled} onCheckedChange={(v) => void autoSave({ vision: { enabled: v } }, () => setVision((p) => ({ ...p, enabled: v })))} />
              </div>
              {vision.enabled && (
                <div className="mt-3 space-y-3">
                  <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">{usageHint('vision')}</div>
                    <div className="space-y-1"><Label className="text-xs">{t('ai.vision_max_images')}</Label>
                      <Input type="number" className="h-8 text-sm" value={vision.max_images} onChange={(e) => setVision((p) => ({ ...p, max_images: num(e.target.value) }))} /></div>
                  </div>
                  <div className="space-y-1"><HelpLabel title={t('ai.vision_size_limit')} description={<p>{t('ai.vision_size_desc')}</p>} labelClassName="text-xs" /><Input type="number" min={1} max={8192} value={vision.max_image_kb} onChange={(e) => setVision((p) => ({ ...p, max_image_kb: num(e.target.value) }))} /></div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{t('ai.vision_prompt')}</Label>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setVision((p) => ({ ...p, prompt: defaults.vision }))}>
                        <Wand2 className="mr-1 h-3 w-3" />{t('ai.load_default')}
                      </Button>
                    </div>
                    <Textarea className="text-sm min-h-[60px]" value={vision.prompt} onChange={(e) => setVision((p) => ({ ...p, prompt: e.target.value }))} placeholder={t('ai.vision_prompt_ph')} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t('ai.vision_note')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ══ 语音识别 ══ */}
        <Card data-setting-anchor="ai-speech">
          <CardContent className="py-4 space-y-3">
            <div className={enabled ? '' : 'opacity-50 pointer-events-none select-none'}>
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-medium">{t('ai.speech')}</Label>
                    <FeatureHelp title={t('ai.speech')} description={<>
                      <p>{t('ai.speech_desc')}</p>
                      <p>{t('ai.speech_note')}</p>
                    </>} />
                  </div>
                </div>
                <Switch checked={speech.enabled} onCheckedChange={(v) => void autoSave({ speech: { enabled: v } }, () => setSpeech({ enabled: v }))} />
              </div>
              {speech.enabled && (
                <div className="mt-3 space-y-2">
                  {usageHint('speech')}
                  <p className="text-[11px] text-muted-foreground">{t('ai.speech_note')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </>)}

      {/* ══ NPC 扮演 section（智能化阶段E） ══ */}
      {section === 'npc' && (
        <Card data-setting-anchor="ai-npc">
          <CardContent className="py-4 space-y-3">
            {!enabled && (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />{t('ai.master_off_hint')}
              </div>
            )}
            <div className={enabled ? '' : 'opacity-50 pointer-events-none select-none'}>
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-medium">{t('ai.npc')}</Label>
                    <FeatureHelp title={t('ai.npc')} description={<>
                      <p>{t('ai.npc_desc')}</p>
                      <p>{t('ai.npc_note')}</p>
                    </>} />
                  </div>
                </div>
                <Switch checked={npc.enabled} onCheckedChange={(v) => void autoSave({ npc: { enabled: v } }, () => setNpc((p) => ({ ...p, enabled: v })))} />
              </div>
              {npc.enabled && (
                <div className="mt-3 space-y-3">
                  {npc.list.length === 0 && <p className="text-xs text-muted-foreground">{t('ai.npc_empty')}</p>}
                  {npc.list.map((n, i) => (
                    <div key={n.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input className="h-8 text-sm max-w-[12rem]" placeholder={t('ai.npc_name')} value={n.name} onChange={(e) => patchNpc(i, { name: e.target.value })} />
                        <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                          <input type="checkbox" className="accent-primary" checked={n.enabled} onChange={(e) => { const value = e.target.checked; if (!n.name.trim()) { toast({ title: t('ai.npc_name_required'), variant: 'destructive' }); return; } void autoSave({ npc: { list: npc.list.map((x, idx) => idx === i ? { ...x, enabled: value } : x) } }, () => patchNpc(i, { enabled: value })); }} />
                          {t('ai.npc_on')}
                        </label>
                        <div className="flex items-center gap-1">
                          <input id={`npc-mood-${n.id}`} type="checkbox" className="accent-primary" checked={n.mood_enabled} onChange={(e) => { const value = e.target.checked; if (!n.name.trim()) { toast({ title: t('ai.npc_name_required'), variant: 'destructive' }); return; } void autoSave({ npc: { list: npc.list.map((x, idx) => idx === i ? { ...x, mood_enabled: value } : x) } }, () => patchNpc(i, { mood_enabled: value })); }} />
                          <HelpLabel htmlFor={`npc-mood-${n.id}`} title={t('ai.npc_mood')} description={<p>{t('ai.npc_mood_tip')}</p>} labelClassName="text-xs whitespace-nowrap" />
                        </div>
                        <Button variant="ghost" size="sm" className="ml-auto h-7 w-7 p-0 text-destructive" onClick={() => delNpc(i)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1"><Label className="text-xs">{t('ai.npc_triggers')}</Label>
                          <Input className="h-8 text-sm" placeholder={t('ai.npc_triggers_ph')} value={n.triggers.join(', ')} onChange={(e) => patchNpc(i, { triggers: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })} /></div>
                        <div className="space-y-1"><Label className="text-xs">{t('ai.npc_model')}</Label>{modelSelect(n.model_id, (v) => patchNpc(i, { model_id: v }))}</div>
                      </div>
                      <div className="space-y-1"><Label className="text-xs">{t('ai.npc_group')}</Label>
                        <Input className="h-8 text-sm" placeholder={t('ai.npc_group_ph')} value={n.group} onChange={(e) => patchNpc(i, { group: e.target.value })} /></div>
                      <div className="space-y-1"><Label className="text-xs">{t('ai.npc_persona')}</Label>
                        <Textarea className="text-sm min-h-[50px]" placeholder={t('ai.npc_persona_ph')} value={n.persona} onChange={(e) => patchNpc(i, { persona: e.target.value })} /></div>
                      <div className="space-y-1"><Label className="text-xs">{t('ai.npc_knowledge')}</Label>
                        <Textarea className="text-sm min-h-[50px]" placeholder={t('ai.npc_knowledge_ph')} value={n.knowledge} onChange={(e) => patchNpc(i, { knowledge: e.target.value })} /></div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={addNpc}><Plus className="mr-1 h-3 w-3" />{t('ai.npc_add')}</Button>
                  <p className="text-[11px] text-muted-foreground">{t('ai.npc_note')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div data-tour="ai-save" className="flex justify-end pt-2">
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('common.save')}</Button>
      </div>
      </fieldset>
    </div>
  );
};

export default AiPage;
