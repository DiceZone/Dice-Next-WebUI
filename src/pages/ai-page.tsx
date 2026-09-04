/**
 * C#67/C#68/C#78：人工智能 —— 分「模型 / 润色 / 翻译」三个子页面（由路由 /ai、/ai/polish、
 * /ai/translate 决定，同一组件不重挂载，编辑状态共享，一次保存全部）。
 * 后端：/api/system/ai (GET/PUT)、/api/system/ai/test (POST)。
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PlatformIcon } from '@/components/platform-icon';
import { Sparkles, Plus, Trash2, FlaskConical, Loader2, AlertTriangle, Wand2, Languages, MessageCircle, Drama } from 'lucide-react';

interface AiModel {
  id: string; name: string; base_url: string; api_key: string; model: string;
  enabled: boolean; price_in: number; price_out: number;
  token_limit: number; cost_limit: number; used_tokens: number; used_cost: number;
}
interface TestResult { ok: boolean; reply: string; error: string; latencyMs: number; totalTokens: number; cost: number; }
type Cov = { roll: boolean; deck: boolean; fun: boolean; custom: boolean; plugin: boolean };
interface Params { temperature: number; top_p: number; max_tokens: number; frequency_penalty: number; presence_penalty: number; }
interface Polish { enabled: boolean; model_id: string; mode: string; persona: string; prompt: string; cov: Cov; }
interface AiLang { name: string; keywords: string[]; }
interface Translate { enabled: boolean; model_id: string; prompt: string; cov: Cov; langs: AiLang[]; }

const emptyCov = (roll = true, others = false): Cov => ({ roll, deck: others, fun: others, custom: others, plugin: others });
const emptyParams = (): Params => ({ temperature: 0.7, top_p: 1, max_tokens: 1024, frequency_penalty: 0, presence_penalty: 0 });
const emptyPolish = (): Polish => ({ enabled: false, model_id: '', mode: 'text', persona: '', prompt: '', cov: emptyCov(true, false) });
const emptyTranslate = (): Translate => ({ enabled: false, model_id: '', prompt: '', cov: emptyCov(true, true), langs: [] });
interface Chat { enabled: boolean; model_id: string; persona: string; prompt: string; at_bot: boolean; keywords: string[]; standby_prob: number; context_rounds: number; max_chars: number; cooldown_sec: number; reply_at: boolean; no_emoji: boolean; filters: string[]; }
const emptyChat = (): Chat => ({ enabled: false, model_id: '', persona: '', prompt: '', at_bot: true, keywords: [], standby_prob: 0, context_rounds: 10, max_chars: 200, cooldown_sec: 5, reply_at: false, no_emoji: true, filters: [] });
interface MemoryShort { enabled: boolean; rounds: number; max_chars: number; summary_model_id: string; summary_prompt: string; }
interface MemoryLong { enabled: boolean; embed_model_id: string; embed_model: string; top_k: number; min_similarity: number; max_facts: number; extract_model_id: string; extract_prompt: string; }
interface Memory { short: MemoryShort; long: MemoryLong; }
const emptyMemory = (): Memory => ({
  short: { enabled: false, rounds: 20, max_chars: 400, summary_model_id: '', summary_prompt: '' },
  long: { enabled: false, embed_model_id: '', embed_model: '', top_k: 4, min_similarity: 0.75, max_facts: 300, extract_model_id: '', extract_prompt: '' },
});
interface MemItem { scope_id: string; content: string; ref_id: number; updated_at: number; hits: number; }
interface Tools { enabled: boolean; roll_dice: boolean; draw_deck: boolean; get_attr: boolean; set_attr: boolean; run_command: boolean; search_help: boolean; max_rounds: number; }
const emptyTools = (): Tools => ({ enabled: false, roll_dice: true, draw_deck: true, get_attr: true, set_attr: false, run_command: true, search_help: true, max_rounds: 3 });
interface Vision { enabled: boolean; model_id: string; prompt: string; max_images: number; pass_url: boolean; }
const emptyVision = (): Vision => ({ enabled: false, model_id: '', prompt: '', max_images: 2, pass_url: true });
interface WlEntry { platform: string; id: string; is_group: boolean; name?: string; }
interface Whitelist { enabled: boolean; list: WlEntry[]; }
const emptyWhitelist = (): Whitelist => ({ enabled: false, list: [] });
interface PickGroup { platform: string; groupId: string; name: string; }
interface PickPlayer { platform: string; userId: string; nickname: string; }
interface Npc { id: string; name: string; persona: string; knowledge: string; triggers: string[]; model_id: string; group: string; enabled: boolean; mood_enabled: boolean; }
interface NpcConf { enabled: boolean; list: Npc[]; }
const emptyNpcConf = (): NpcConf => ({ enabled: false, list: [] });
const emptyNpc = (): Npc => ({ id: 'npc' + Math.random().toString(36).slice(2, 10), name: '', persona: '', knowledge: '', triggers: [], model_id: '', group: '', enabled: true, mood_enabled: false });
const emptyModel = (): AiModel => ({
  id: 'm' + Math.random().toString(36).slice(2, 10), name: '', base_url: 'https://api.openai.com/v1',
  api_key: '', model: '', enabled: true, price_in: 0, price_out: 0, token_limit: 0, cost_limit: 0,
  used_tokens: 0, used_cost: 0,
});

async function jget(path: string) { const r = await fetch('/api' + path); const j = await r.json(); if (j.code !== 0) throw new Error(j.message); return j.data; }
async function jput(path: string, body: unknown) { const r = await fetch('/api' + path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (j.code !== 0) throw new Error(j.message); return j.data; }
async function jpost(path: string, body: unknown) { const r = await fetch('/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (j.code !== 0) throw new Error(j.message); return j.data; }
async function jdel(path: string) { const r = await fetch('/api' + path, { method: 'DELETE' }); const j = await r.json(); if (j.code !== 0) throw new Error(j.message); return j.data; }

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
  const [enabled, setEnabled] = useState(false);
  const [models, setModels] = useState<AiModel[]>([]);
  const [params, setParams] = useState<Params>(emptyParams());
  const [polish, setPolish] = useState<Polish>(emptyPolish());
  const [trans, setTrans] = useState<Translate>(emptyTranslate());
  const [chat, setChat] = useState<Chat>(emptyChat());
  const [memory, setMemory] = useState<Memory>(emptyMemory());
  const [tools, setTools] = useState<Tools>(emptyTools());
  const [vision, setVision] = useState<Vision>(emptyVision());
  const [npc, setNpc] = useState<NpcConf>(emptyNpcConf());
  const [wl, setWl] = useState<Whitelist>(emptyWhitelist());
  const [wlPick, setWlPick] = useState('');
  const [wlPicking, setWlPicking] = useState(false);
  const [pickGroups, setPickGroups] = useState<PickGroup[]>([]);
  const [pickPlayers, setPickPlayers] = useState<PickPlayer[]>([]);
  const [memItems, setMemItems] = useState<MemItem[]>([]);
  const [memBusy, setMemBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [memFacts, setMemFacts] = useState<MemItem[]>([]);
  const [defaults, setDefaults] = useState<{ polish_text: string; polish_rp: string; translate: string; chat: string; summary: string; extract: string; vision: string }>({ polish_text: '', polish_rp: '', translate: '', chat: '', summary: '', extract: '', vision: '' });

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const applyData = (d: { enabled?: boolean; models?: AiModel[]; params?: Partial<Params>; polish?: Partial<Polish>; translate?: Partial<Translate>; chat?: Partial<Chat>; memory?: { short?: Partial<MemoryShort>; long?: Partial<MemoryLong> }; tools?: Partial<Tools>; vision?: Partial<Vision>; npc?: Partial<NpcConf>; whitelist?: Partial<Whitelist>; defaults?: { polish_text: string; polish_rp: string; translate: string; chat: string; summary: string; extract: string; vision: string } }) => {
    setEnabled(!!d.enabled);
    setModels((d.models || []).map((m: AiModel) => ({ ...emptyModel(), ...m })));
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
  const addModel = () => setModels((ms) => [...ms, emptyModel()]);
  const delModel = (i: number) => setModels((ms) => ms.filter((_, idx) => idx !== i));
  const num = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  const save = async () => {
    setSaving(true);
    try { applyData(await jput('/system/ai', { enabled, models, params, polish, translate: trans, chat, memory, tools, vision, npc, whitelist: wl })); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  // 阶段B：记忆管理 —— 查看已存群摘要 / 清空。
  const loadMem = async () => {
    setMemBusy(true);
    try { const d = await jget('/system/ai/memory'); setMemItems((d?.items || []) as MemItem[]); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setMemBusy(false); }
  };
  const clearMem = async () => {
    setMemBusy(true);
    try { await jdel('/system/ai/memory?kind=summary'); setMemItems([]); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setMemBusy(false); }
  };
  // 阶段C：长期事实 —— 查看 / 清空。
  const loadFacts = async () => {
    setMemBusy(true);
    try { const d = await jget('/system/ai/memory?kind=fact'); setMemFacts((d?.items || []) as MemItem[]); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setMemBusy(false); }
  };
  const clearFacts = async () => {
    setMemBusy(true);
    try { await jdel('/system/ai/memory?kind=fact'); setMemFacts([]); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setMemBusy(false); }
  };

  const test = async (m: AiModel) => {
    setTesting((s) => ({ ...s, [m.id]: true }));
    setResults((s) => { const c = { ...s }; delete c[m.id]; return c; });
    try { const r = await jpost('/system/ai/test', { model: m }) as TestResult; setResults((s) => ({ ...s, [m.id]: r })); }
    catch (e) { setResults((s) => ({ ...s, [m.id]: { ok: false, reply: '', error: (e as Error).message, latencyMs: 0, totalTokens: 0, cost: 0 } })); }
    finally { setTesting((s) => ({ ...s, [m.id]: false })); }
  };

  // 模型下拉（润色/翻译共用）
  const modelSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value || '__first__'} onValueChange={(v) => onChange(v === '__first__' ? '' : v)}>
      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__first__">{t('ai.polish_model_first')}</SelectItem>
        {models.filter((m) => m.enabled && m.name).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  // 覆盖范围（5 类别复选）
  const coverage = (cov: Cov, set: (c: Cov) => void) => (
    <div className="space-y-1">
      <Label className="text-xs">{t('ai.cov')}</Label>
      <p className="text-[11px] text-muted-foreground">{t('ai.cov_desc')}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
        {(['roll', 'deck', 'fun', 'custom', 'plugin'] as const).map((k) => (
          <label key={k} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <input type="checkbox" className="accent-primary" checked={!!cov[k]} onChange={(e) => set({ ...cov, [k]: e.target.checked })} />
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
      <PageHeader icon={TitleIcon} title={t(titleKey)} description={t('ai.desc')} />

      {/* ══ 模型 section ══ */}
      {section === 'models' && (<>
        <Card data-setting-anchor="ai-master">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <Label className="text-sm font-medium">{t('ai.master')}</Label>
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
            <Label className="text-sm font-medium">{t('ai.params')}</Label>
            <p className="text-xs text-muted-foreground">{t('ai.params_desc')}</p>
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

        <div data-setting-anchor="ai-models" className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{t('ai.models')}</h2>
          <Button size="sm" variant="outline" onClick={addModel}><Plus className="mr-1 h-4 w-4" />{t('ai.add_model')}</Button>
        </div>
        {models.length === 0 && <p className="text-xs text-muted-foreground italic py-4 text-center">{t('ai.no_models')}</p>}
        {models.map((m, i) => {
          const res = results[m.id];
          return (
            <Card key={m.id}>
              <CardContent className="py-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Switch checked={m.enabled} onCheckedChange={(v) => patch(i, { enabled: v })} />
                  <Input className="h-8 text-sm font-medium flex-1" value={m.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder={t('ai.name_ph')} />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => delModel(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2"><Label className="text-xs">{t('ai.base_url')}</Label>
                    <Input className="h-8 text-sm" value={m.base_url} onChange={(e) => patch(i, { base_url: e.target.value })} placeholder="https://api.openai.com/v1" /></div>
                  <div className="space-y-1"><Label className="text-xs">{t('ai.model_id')}</Label>
                    <Input className="h-8 text-sm" value={m.model} onChange={(e) => patch(i, { model: e.target.value })} placeholder="gpt-4o-mini / qwen2.5 …" /></div>
                  <div className="space-y-1"><Label className="text-xs">{t('ai.api_key')}</Label>
                    <Input type="password" className="h-8 text-sm" value={m.api_key} onChange={(e) => patch(i, { api_key: e.target.value })} placeholder="sk-… （本地模型可留空）" /></div>
                  <div className="space-y-1"><Label className="text-xs">{t('ai.price_in')}</Label>
                    <Input type="number" className="h-8 text-sm" value={m.price_in} onChange={(e) => patch(i, { price_in: num(e.target.value) })} /></div>
                  <div className="space-y-1"><Label className="text-xs">{t('ai.price_out')}</Label>
                    <Input type="number" className="h-8 text-sm" value={m.price_out} onChange={(e) => patch(i, { price_out: num(e.target.value) })} /></div>
                  <div className="space-y-1"><Label className="text-xs">{t('ai.token_limit')}</Label>
                    <Input type="number" className="h-8 text-sm" value={m.token_limit} onChange={(e) => patch(i, { token_limit: num(e.target.value) })} /></div>
                  <div className="space-y-1"><Label className="text-xs">{t('ai.cost_limit')}</Label>
                    <Input type="number" className="h-8 text-sm" value={m.cost_limit} onChange={(e) => patch(i, { cost_limit: num(e.target.value) })} /></div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">{t('ai.usage', { tokens: m.used_tokens, cost: m.used_cost.toFixed(4) })}</p>
                  <Button size="sm" variant="outline" onClick={() => test(m)} disabled={!!testing[m.id]}>
                    {testing[m.id] ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="mr-1 h-3.5 w-3.5" />}{t('ai.test')}
                  </Button>
                </div>
                {res && (
                  <div className={`rounded-md border p-2 text-xs ${res.ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-destructive/40 bg-destructive/5'}`}>
                    {res.ok ? (<>
                      <div className="text-muted-foreground mb-1">{t('ai.test_ok', { ms: res.latencyMs, tokens: res.totalTokens, cost: res.cost.toFixed(5) })}</div>
                      <div className="whitespace-pre-wrap break-words">{res.reply}</div>
                    </>) : (<div className="text-destructive break-words">{t('ai.test_fail')}: {res.error}</div>)}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
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
                <Label className="text-sm font-medium">{t('ai.polish')}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t('ai.polish_desc')}</p>
              </div>
              <Switch checked={polish.enabled} onCheckedChange={(v) => setPolish((p) => ({ ...p, enabled: v }))} />
            </div>
            {polish.enabled && (
              <div className="space-y-2.5 border-t pt-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1"><Label className="text-xs">{t('ai.polish_model')}</Label>{modelSelect(polish.model_id, (v) => setPolish((p) => ({ ...p, model_id: v })))}</div>
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
                {coverage(polish.cov, (c) => setPolish((p) => ({ ...p, cov: c })))}
                <div className="space-y-1">
                  <Label className="text-xs">{t('ai.polish_persona')}</Label>
                  <Textarea className="text-sm min-h-[60px]" value={polish.persona} onChange={(e) => setPolish((p) => ({ ...p, persona: e.target.value }))} placeholder={t('ai.polish_persona_ph')} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{t('ai.polish_prompt')}</Label>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPolish((p) => ({ ...p, prompt: p.mode === 'rp' ? defaults.polish_rp : defaults.polish_text }))}>
                      <Wand2 className="mr-1 h-3 w-3" />{t('ai.load_default')}
                    </Button>
                  </div>
                  <Textarea className="text-sm min-h-[100px]" value={polish.prompt} onChange={(e) => setPolish((p) => ({ ...p, prompt: e.target.value }))} placeholder={t('ai.polish_prompt_ph')} />
                  <p className="text-[11px] text-muted-foreground">{t('ai.polish_prompt_note')}</p>
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
                <Label className="text-sm font-medium">{t('ai.trans')}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t('ai.trans_desc')}</p>
              </div>
              <Switch checked={trans.enabled} onCheckedChange={(v) => setTrans((p) => ({ ...p, enabled: v }))} />
            </div>
            {trans.enabled && (
              <div className="space-y-2.5 border-t pt-3">
                <div className="space-y-1 max-w-xs"><Label className="text-xs">{t('ai.trans_model')}</Label>{modelSelect(trans.model_id, (v) => setTrans((p) => ({ ...p, model_id: v })))}</div>
                {coverage(trans.cov, (c) => setTrans((p) => ({ ...p, cov: c })))}
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
                    <Label className="text-xs">{t('ai.trans_prompt')}</Label>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTrans((p) => ({ ...p, prompt: defaults.translate }))}>
                      <Wand2 className="mr-1 h-3 w-3" />{t('ai.load_default')}
                    </Button>
                  </div>
                  <Textarea className="text-sm min-h-[100px]" value={trans.prompt} onChange={(e) => setTrans((p) => ({ ...p, prompt: e.target.value }))} placeholder={t('ai.trans_prompt_ph')} />
                  <p className="text-[11px] text-muted-foreground">{t('ai.trans_prompt_note')}</p>
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
                  <Label className="text-sm font-medium">{t('ai.chat')}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('ai.chat_desc')}</p>
                </div>
                <Switch checked={chat.enabled} onCheckedChange={(v) => setChat((p) => ({ ...p, enabled: v }))} />
              </div>
              {chat.enabled && (
                <div className="space-y-2.5 border-t pt-3">
                  <div className="space-y-1 max-w-xs"><Label className="text-xs">{t('ai.chat_model')}</Label>{modelSelect(chat.model_id, (v) => setChat((p) => ({ ...p, model_id: v })))}</div>

                  <div className="space-y-1.5 rounded-md border p-2.5">
                    <Label className="text-xs font-medium">{t('ai.chat_trigger')}</Label>
                    <p className="text-[11px] text-muted-foreground">{t('ai.chat_trigger_desc')}</p>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                      <input type="checkbox" className="accent-primary" checked={chat.at_bot} onChange={(e) => setChat((p) => ({ ...p, at_bot: e.target.checked }))} />
                      {t('ai.chat_at_bot')}
                    </label>
                    <div className="space-y-1"><Label className="text-xs">{t('ai.chat_keywords')}</Label>
                      <Input className="h-8 text-sm" value={chat.keywords.join(', ')} placeholder={t('ai.chat_keywords_ph')}
                        onChange={(e) => setChat((p) => ({ ...p, keywords: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">{t('ai.chat_standby')}</Label>
                      <Input type="number" className="h-8 text-sm w-28" value={chat.standby_prob} onChange={(e) => setChat((p) => ({ ...p, standby_prob: num(e.target.value) }))} /></div>
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
                    <input type="checkbox" className="accent-primary" checked={chat.reply_at} onChange={(e) => setChat((p) => ({ ...p, reply_at: e.target.checked }))} />
                    {t('ai.chat_reply_at')}
                  </label>

                  <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input type="checkbox" className="accent-primary" checked={chat.no_emoji} onChange={(e) => setChat((p) => ({ ...p, no_emoji: e.target.checked }))} />
                    {t('ai.chat_no_emoji')}
                  </label>

                  <div className="space-y-1">
                    <Label className="text-xs">{t('ai.chat_filters')}</Label>
                    <Textarea className="text-sm min-h-[60px] font-mono" value={chat.filters.join('\n')}
                      placeholder={t('ai.chat_filters_ph')}
                      onChange={(e) => setChat((p) => ({ ...p, filters: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) }))} />
                    <p className="text-[11px] text-muted-foreground">{t('ai.chat_filters_note')}</p>
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
                  <Label className="text-sm font-medium">{t('ai.mem')}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('ai.mem_desc')}</p>
                </div>
                <Switch checked={memory.short.enabled} onCheckedChange={(v) => setMemory((p) => ({ ...p, short: { ...p.short, enabled: v } }))} />
              </div>
              {memory.short.enabled && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1 max-w-xs"><Label className="text-xs">{t('ai.mem_model')}</Label>{modelSelect(memory.short.summary_model_id, (v) => setMemory((p) => ({ ...p, short: { ...p.short, summary_model_id: v } })))}</div>
                  <div className="grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
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

                  {/* 已存群摘要：查看 / 清空 */}
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">{t('ai.mem_stored')}</Label>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={memBusy} onClick={loadMem}>{t('ai.mem_view')}</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" disabled={memBusy || memItems.length === 0} onClick={clearMem}>{t('ai.mem_clear')}</Button>
                      </div>
                    </div>
                    {memItems.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">{t('ai.mem_empty')}</p>
                    ) : (
                      <div className="space-y-2">
                        {memItems.map((it) => (
                          <div key={it.scope_id} className="rounded border bg-muted/40 p-2">
                            <div className="text-[11px] font-mono text-muted-foreground">{it.scope_id}</div>
                            <div className="text-xs mt-0.5 whitespace-pre-wrap">{it.content}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── 长期记忆（向量检索，阶段C）── */}
              <div data-setting-anchor="ai-memory-long" className="mt-4 border-t pt-3">
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <Label className="text-sm font-medium">{t('ai.mlong')}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('ai.mlong_desc')}</p>
                  </div>
                  <Switch checked={memory.long.enabled} onCheckedChange={(v) => setMemory((p) => ({ ...p, long: { ...p.long, enabled: v } }))} />
                </div>
                {memory.long.enabled && (
                  <div className="mt-3 space-y-3">
                    <div className="grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1"><Label className="text-xs">{t('ai.mlong_embed_model_conn')}</Label>{modelSelect(memory.long.embed_model_id, (v) => setMemory((p) => ({ ...p, long: { ...p.long, embed_model_id: v } })))}</div>
                      <div className="space-y-1"><Label className="text-xs">{t('ai.mlong_embed_model')}</Label>
                        <Input className="h-8 text-sm" value={memory.long.embed_model} placeholder="text-embedding-3-small" onChange={(e) => setMemory((p) => ({ ...p, long: { ...p.long, embed_model: e.target.value } }))} /></div>
                    </div>
                    <div className="space-y-1 max-w-xs"><Label className="text-xs">{t('ai.mlong_extract_model')}</Label>{modelSelect(memory.long.extract_model_id, (v) => setMemory((p) => ({ ...p, long: { ...p.long, extract_model_id: v } })))}</div>
                    <div className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-3">
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

                    {/* 已存事实：查看 / 清空 */}
                    <div className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">{t('ai.mlong_stored')}</Label>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={memBusy} onClick={loadFacts}>{t('ai.mem_view')}</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" disabled={memBusy || memFacts.length === 0} onClick={clearFacts}>{t('ai.mem_clear')}</Button>
                        </div>
                      </div>
                      {memFacts.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">{t('ai.mlong_empty')}</p>
                      ) : (
                        <div className="space-y-1.5">
                          {memFacts.map((it, i) => (
                            <div key={i} className="rounded border bg-muted/40 px-2 py-1.5 text-xs">
                              <span className="font-mono text-[10px] text-muted-foreground mr-2">{it.scope_id}</span>{it.content}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
                  <Label className="text-sm font-medium">{t('ai.tools')}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('ai.tools_desc')}</p>
                </div>
                <Switch checked={tools.enabled} onCheckedChange={(v) => setTools((p) => ({ ...p, enabled: v }))} />
              </div>
              {tools.enabled && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">{t('ai.tools_enabled_list')}</Label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-primary" checked={tools.roll_dice} onChange={(e) => setTools((p) => ({ ...p, roll_dice: e.target.checked }))} />
                      {t('ai.tools_roll_dice')}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-primary" checked={tools.draw_deck} onChange={(e) => setTools((p) => ({ ...p, draw_deck: e.target.checked }))} />
                      {t('ai.tools_draw_deck')}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-primary" checked={tools.get_attr} onChange={(e) => setTools((p) => ({ ...p, get_attr: e.target.checked }))} />
                      {t('ai.tools_get_attr')}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-primary" checked={tools.set_attr} onChange={(e) => setTools((p) => ({ ...p, set_attr: e.target.checked }))} />
                      {t('ai.tools_set_attr')}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-primary" checked={tools.run_command} onChange={(e) => setTools((p) => ({ ...p, run_command: e.target.checked }))} />
                      {t('ai.tools_run_command')}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-primary" checked={tools.search_help} onChange={(e) => setTools((p) => ({ ...p, search_help: e.target.checked }))} />
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
                  <Label className="text-sm font-medium">{t('ai.wl')}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('ai.wl_desc')}</p>
                </div>
                <Switch checked={wl.enabled} onCheckedChange={(v) => setWl((p) => ({ ...p, enabled: v }))} />
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
                  <Label className="text-sm font-medium">{t('ai.vision')}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('ai.vision_desc')}</p>
                </div>
                <Switch checked={vision.enabled} onCheckedChange={(v) => setVision((p) => ({ ...p, enabled: v }))} />
              </div>
              {vision.enabled && (
                <div className="mt-3 space-y-3">
                  <div className="grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><Label className="text-xs">{t('ai.vision_model')}</Label>{modelSelect(vision.model_id, (v) => setVision((p) => ({ ...p, model_id: v })))}</div>
                    <div className="space-y-1"><Label className="text-xs">{t('ai.vision_max_images')}</Label>
                      <Input type="number" className="h-8 text-sm" value={vision.max_images} onChange={(e) => setVision((p) => ({ ...p, max_images: num(e.target.value) }))} /></div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <Label className="text-sm font-medium">{t('ai.vision_pass_url')}</Label>
                      <p className="text-xs text-muted-foreground">{t('ai.vision_pass_url_desc')}</p>
                    </div>
                    <Switch checked={vision.pass_url !== false} onCheckedChange={(v) => setVision((p) => ({ ...p, pass_url: v }))} />
                  </div>
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
                  <Label className="text-sm font-medium">{t('ai.npc')}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('ai.npc_desc')}</p>
                </div>
                <Switch checked={npc.enabled} onCheckedChange={(v) => setNpc((p) => ({ ...p, enabled: v }))} />
              </div>
              {npc.enabled && (
                <div className="mt-3 space-y-3">
                  {npc.list.length === 0 && <p className="text-xs text-muted-foreground">{t('ai.npc_empty')}</p>}
                  {npc.list.map((n, i) => (
                    <div key={n.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input className="h-8 text-sm max-w-[12rem]" placeholder={t('ai.npc_name')} value={n.name} onChange={(e) => patchNpc(i, { name: e.target.value })} />
                        <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                          <input type="checkbox" className="accent-primary" checked={n.enabled} onChange={(e) => patchNpc(i, { enabled: e.target.checked })} />
                          {t('ai.npc_on')}
                        </label>
                        <label className="flex items-center gap-1 text-xs whitespace-nowrap" title={t('ai.npc_mood_tip')}>
                          <input type="checkbox" className="accent-primary" checked={n.mood_enabled} onChange={(e) => patchNpc(i, { mood_enabled: e.target.checked })} />
                          {t('ai.npc_mood')}
                        </label>
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
      <p className="text-[11px] text-muted-foreground">{t('ai.stage_note')}</p>
    </div>
  );
};

export default AiPage;
