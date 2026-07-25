/**
 * C#29 + C#66: Causal Rule Editor — 重做为「更贴近真人操作」的向导式编辑器。
 * 设计要点：①模板库一键套用（解决「没实例」）；②自然语言「当…就…」句式行；
 * ③大白话下拉映射到正确后端类型（修掉 keyword=完全等于 的误导）；④每类型专属输入 +
 * 行内范例提示；⑤回复变量膠囊一键插入。后端数据模型不变。
 */
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, FlaskConical, Sparkles } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { CausalRule, CausalCondition, CausalAction, CausalCondType, CausalActionType } from '@/types/causal';
import type { CausalMatchResult } from '@/types/causal';
import { emptyCausalRule } from '@/types/causal';

interface Props {
  rule: CausalRule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (rule: CausalRule) => void;
}

// ── 条件「白话操作符」→ 后端类型映射（修掉 keyword=完全等于 的误导）──
interface CondOp {
  id: string;
  type: CausalCondType;
  filter?: 'whitelist' | 'blacklist';   // user_filter/group_filter 的前缀模式
}
const COND_OPS: CondOp[] = [
  { id: 'contains',   type: 'search' },
  { id: 'equals',     type: 'keyword' },
  { id: 'starts',     type: 'prefix' },
  { id: 'regex',      type: 'regex' },
  { id: 'sender_is',  type: 'user_filter',  filter: 'whitelist' },
  { id: 'sender_not', type: 'user_filter',  filter: 'blacklist' },
  { id: 'in_groups',  type: 'group_filter', filter: 'whitelist' },
  { id: 'counter',    type: 'counter_check' },
];
// 从后端 condition 反推白话操作符 id
function opIdOf(c: CausalCondition): string {
  if (c.type === 'user_filter') return (c.content || '').startsWith('blacklist:') ? 'sender_not' : 'sender_is';
  if (c.type === 'group_filter') return 'in_groups';
  const m = COND_OPS.find((o) => o.type === c.type && !o.filter);
  return m ? m.id : 'contains';
}
// 取用户可见的「值」（过滤器去掉 whitelist:/blacklist: 前缀）
function valueOf(c: CausalCondition): string {
  if (c.type === 'user_filter' || c.type === 'group_filter')
    return (c.content || '').replace(/^(whitelist|blacklist):/, '');
  return c.content || '';
}
// 应用「白话操作符」到 condition（重置 type + 重排 content 前缀）
function applyOp(c: CausalCondition, opId: string): CausalCondition {
  const op = COND_OPS.find((o) => o.id === opId)!;
  const raw = valueOf(c);
  const next: CausalCondition = { ...c, type: op.type };
  if (op.filter) next.content = op.filter + ':' + raw;
  else next.content = raw;
  return next;
}
function setValue(c: CausalCondition, opId: string, val: string): CausalCondition {
  const op = COND_OPS.find((o) => o.id === opId)!;
  if (op.filter) return { ...c, content: op.filter + ':' + val };
  return { ...c, content: val };
}

const ACT_OPS: { id: string; type: CausalActionType }[] = [
  { id: 'reply', type: 'reply' },
  { id: 'counter_add', type: 'counter_add' },
  { id: 'counter_set', type: 'counter_set' },
  { id: 'counter_reset', type: 'counter_reset' },
  { id: 'api', type: 'api_call' },
];

// 回复可用变量（点击插入）
const REPLY_VARS = ['{nick}', '{at}', '{counter:名字}', '{$1}', '{date}', '{time}', '{a|b|c}'];

// ── 模板库：一键套用现成规则 ──
function templates(): { key: string; rule: Partial<CausalRule> }[] {
  return [
    { key: 'greet', rule: { name: '早安问候', logic: 'or',
      conditions: [{ type: 'search', content: '早安' }],
      actions: [{ type: 'reply', replies: ['早上好呀，{nick}！☀️'] }] } },
    { key: 'checkin', rule: { name: '每日打卡',
      conditions: [{ type: 'keyword', content: '打卡' }],
      actions: [
        { type: 'counter_add', counterName: '打卡', counterScope: 'per-user', counterDelta: 1 },
        { type: 'reply', replies: ['{nick} 打卡成功！这是第 {counter:打卡} 次 📅'] }] } },
    { key: 'gacha', rule: { name: '每分钟抽卡', cooldownMs: 60000, cooldownKey: 'per-user',
      conditions: [{ type: 'search', content: '抽卡' }],
      actions: [{ type: 'reply', replies: ['🎴 你抽到了：{a|SSR|SR|R|N}'] }] } },
    { key: 'song', rule: { name: '点歌', logic: 'or',
      conditions: [{ type: 'regex', content: '^点歌 (.+)$' }],
      actions: [{ type: 'reply', replies: ['🎵 已为你点播《{$1}》'] }] } },
    { key: 'vip', rule: { name: '专属回应', logic: 'and',
      conditions: [{ type: 'user_filter', content: 'whitelist:' }, { type: 'search', content: '在吗' }],
      actions: [{ type: 'reply', replies: ['老板好！我一直在~'] }] } },
  ];
}

export const CausalRuleEditor: React.FC<Props> = ({ rule, open, onOpenChange, onSave }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [editing, setEditing] = useState<CausalRule>({ ...rule });
  const [testMsg, setTestMsg] = useState('');
  const [testResult, setTestResult] = useState<CausalMatchResult | null>(null);
  const [testing, setTesting] = useState(false);
  const replyRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  React.useEffect(() => {
    if (open) { setEditing({ ...rule }); setTestResult(null); }
  }, [rule, open]);

  const isNew = rule.id <= 0;
  const isBlank = editing.conditions.length === 0 && editing.actions.length === 0 && !editing.name;

  const applyTemplate = (tpl: Partial<CausalRule>) => {
    setEditing({ ...emptyCausalRule, ...tpl,
      conditions: (tpl.conditions || []).map((c) => ({ ...c })),
      actions: (tpl.actions || []).map((a) => ({ ...a, replies: a.replies ? [...a.replies] : a.replies })) });
  };

  const patchCond = (i: number, p: Partial<CausalCondition>) =>
    setEditing((e) => ({ ...e, conditions: e.conditions.map((c, idx) => (idx === i ? { ...c, ...p } : c)) }));
  const addCond = () => setEditing((e) => ({ ...e, conditions: [...e.conditions, { type: 'search', content: '' }] }));
  const delCond = (i: number) => setEditing((e) => ({ ...e, conditions: e.conditions.filter((_, idx) => idx !== i) }));

  const patchAct = (i: number, p: Partial<CausalAction>) =>
    setEditing((e) => ({ ...e, actions: e.actions.map((a, idx) => (idx === i ? { ...a, ...p } : a)) }));
  const addAct = () => setEditing((e) => ({ ...e, actions: [...e.actions, { type: 'reply', replies: [''] }] }));
  const delAct = (i: number) => setEditing((e) => ({ ...e, actions: e.actions.filter((_, idx) => idx !== i) }));

  const insertVar = (ai: number, tok: string) => {
    const ta = replyRefs.current[ai];
    const cur = (editing.actions[ai].replies || ['']).join('\n');
    if (!ta) { patchAct(ai, { replies: (cur + tok).split('\n') }); return; }
    const s = ta.selectionStart, en = ta.selectionEnd;
    const next = cur.slice(0, s) + tok + cur.slice(en);
    patchAct(ai, { replies: next.split('\n') });
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + tok.length; }, 0);
  };

  const handleTest = async () => {
    if (!testMsg.trim()) return;
    setTesting(true); setTestResult(null);
    try {
      const res = await apiClient.post<CausalMatchResult>('/causal/rules/test', {
        msg: testMsg, userId: 'test-user', groupId: 'test-group', nick: 'TestUser',
      });
      setTestResult(res.data);
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setTesting(false); }
  };

  const handleSave = () => {
    if (!editing.name.trim()) { toast({ title: t('causal.ed.need_name'), variant: 'destructive' }); return; }
    onSave(editing);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? t('causal.ed.new_title') : t('causal.ed.edit_title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ── 模板库（新建且空白时显示）── */}
          {isNew && isBlank && (
            <div className="rounded-lg border border-dashed p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />{t('causal.v2.tpl_title')}
              </div>
              <p className="text-xs text-muted-foreground">{t('causal.v2.tpl_desc')}</p>
              <div className="flex flex-wrap gap-2">
                {templates().map((tp) => (
                  <button key={tp.key} type="button" onClick={() => applyTemplate(tp.rule)}
                    className="rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs hover:bg-muted transition-colors text-left">
                    <div className="font-medium">{t('causal.v2.tpl_' + tp.key)}</div>
                    <div className="text-[10px] text-muted-foreground">{t('causal.v2.tpl_' + tp.key + '_d')}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 规则名 + 生效范围 ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('causal.ed.name')}</Label>
              <Input value={editing.name} onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))} placeholder={t('causal.ed.name_ph')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('causal.ed.scope')}</Label>
              <Select value={editing.scope} onValueChange={(v) => setEditing((p) => ({ ...p, scope: v as CausalRule['scope'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">{t('causal.scope_global')}</SelectItem>
                  <SelectItem value="group">{t('causal.scope_group')}</SelectItem>
                  <SelectItem value="user">{t('causal.scope_user')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── 条件区：当 …… ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">{t('causal.v2.when')}</Label>
                {editing.conditions.length > 1 && (
                  <Select value={editing.logic} onValueChange={(v) => setEditing((p) => ({ ...p, logic: v as CausalRule['logic'] }))}>
                    <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="or">{t('causal.v2.logic_or')}</SelectItem>
                      <SelectItem value="and">{t('causal.v2.logic_and')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={addCond}><Plus className="mr-1 h-3 w-3" />{t('causal.ed.add_cond')}</Button>
            </div>

            {editing.conditions.map((cond, i) => {
              const opId = opIdOf(cond);
              return (
                <div key={i} className="rounded-md border p-2 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 text-xs text-muted-foreground shrink-0">{t('causal.v2.msg')}</span>
                    <Select value={opId} onValueChange={(v) => patchCond(i, applyOp(cond, v))}>
                      <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COND_OPS.map((o) => <SelectItem key={o.id} value={o.id}>{t('causal.v2.op_' + o.id)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {opId !== 'counter' ? (
                      <Input className="flex-1 h-8 text-sm" value={valueOf(cond)}
                        onChange={(e) => patchCond(i, setValue(cond, opId, e.target.value))}
                        placeholder={t('causal.v2.ph_' + opId)} />
                    ) : (
                      <div className="flex flex-1 gap-1.5">
                        <Input className="flex-1 h-8 text-xs" value={cond.counterName || ''} onChange={(e) => patchCond(i, { counterName: e.target.value })} placeholder={t('causal.ed.counter_name')} />
                        <Select value={cond.op || '>='} onValueChange={(v) => patchCond(i, { op: v })}>
                          <SelectTrigger className="w-16 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['>=', '<=', '==', '!='].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input className="w-16 h-8 text-xs" type="number" value={cond.value || 0} onChange={(e) => patchCond(i, { value: Number(e.target.value) })} />
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => delCond(i)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <p className="pl-12 text-[11px] text-muted-foreground">{t('causal.v2.hint_' + opId)}</p>
                </div>
              );
            })}
            {editing.conditions.length === 0 && (
              <p className="text-xs text-muted-foreground italic">{t('causal.v2.no_cond')}</p>
            )}
          </div>

          {/* ── 动作区：就 …… ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('causal.v2.then')}</Label>
              <Button size="sm" variant="outline" onClick={addAct}><Plus className="mr-1 h-3 w-3" />{t('causal.ed.add_action')}</Button>
            </div>
            {editing.actions.map((action, i) => {
              const aid = ACT_OPS.find((o) => o.type === action.type)?.id || 'reply';
              return (
                <div key={i} className="space-y-2 rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <Select value={aid} onValueChange={(v) => patchAct(i, { type: ACT_OPS.find((o) => o.id === v)!.type })}>
                      <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACT_OPS.map((o) => <SelectItem key={o.id} value={o.id}>{t('causal.v2.act_' + o.id)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={() => delAct(i)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  {action.type === 'reply' && (
                    <div className="space-y-1.5">
                      <Textarea
                        ref={(el) => { replyRefs.current[i] = el; }}
                        className="text-sm min-h-[60px]"
                        value={(action.replies || []).join('\n')}
                        onChange={(e) => patchAct(i, { replies: e.target.value.split('\n') })}
                        placeholder={t('causal.v2.reply_ph')}
                      />
                      <div className="flex flex-wrap gap-1">
                        {REPLY_VARS.map((v) => (
                          <button key={v} type="button" onClick={() => insertVar(i, v)}
                            className="rounded border bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono hover:bg-muted">{v}</button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t('causal.v2.reply_hint')}</p>
                    </div>
                  )}
                  {(action.type === 'counter_add' || action.type === 'counter_set' || action.type === 'counter_reset') && (
                    <>
                      <div className="flex gap-2">
                        <Input className="h-8 text-xs flex-1" value={action.counterName || ''} onChange={(e) => patchAct(i, { counterName: e.target.value })} placeholder={t('causal.ed.counter_name')} />
                        <Select value={action.counterScope || 'per-user'} onValueChange={(v) => patchAct(i, { counterScope: v })}>
                          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="per-user">{t('causal.per_user')}</SelectItem>
                            <SelectItem value="per-group">{t('causal.per_group')}</SelectItem>
                            <SelectItem value="global">{t('causal.scope_global')}</SelectItem>
                          </SelectContent>
                        </Select>
                        {action.type !== 'counter_reset' && (
                          <Input className="w-20 h-8 text-xs" type="number" value={action.counterDelta || 0} onChange={(e) => patchAct(i, { counterDelta: Number(e.target.value) })} placeholder={t('causal.ed.value')} />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t('causal.v2.counter_hint')}</p>
                    </>
                  )}
                  {action.type === 'api_call' && (
                    <>
                      <div className="flex gap-2">
                        <Input className="h-8 text-xs flex-1" value={action.apiUrl || ''} onChange={(e) => patchAct(i, { apiUrl: e.target.value })} placeholder="https://api.example.com/..." />
                        <Input className="w-24 h-8 text-xs" value={action.apiVar || ''} onChange={(e) => patchAct(i, { apiVar: e.target.value })} placeholder={t('causal.ed.var_name')} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t('causal.v2.api_hint')}</p>
                    </>
                  )}
                </div>
              );
            })}
            {editing.actions.length === 0 && (
              <p className="text-xs text-muted-foreground italic">{t('causal.v2.no_action')}</p>
            )}
          </div>

          {/* ── 高级：优先级 / 冷却 ── */}
          <details className="rounded-md border px-3 py-2">
            <summary className="cursor-pointer text-xs text-muted-foreground select-none">{t('causal.v2.advanced')}</summary>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('causal.ed.priority')}</Label>
                <Input type="number" className="h-8 text-sm" value={editing.priority} onChange={(e) => setEditing((p) => ({ ...p, priority: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('causal.v2.cooldown_sec')}</Label>
                <Input type="number" className="h-8 text-sm" value={Math.round((editing.cooldownMs || 0) / 1000)} onChange={(e) => setEditing((p) => ({ ...p, cooldownMs: Math.max(0, Number(e.target.value)) * 1000 }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('causal.ed.cooldown_key')}</Label>
                <Select value={editing.cooldownKey} onValueChange={(v) => setEditing((p) => ({ ...p, cooldownKey: v as CausalRule['cooldownKey'] }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per-user">{t('causal.per_user')}</SelectItem>
                    <SelectItem value="per-group">{t('causal.per_group')}</SelectItem>
                    <SelectItem value="global">{t('causal.scope_global')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="pt-1 text-[11px] text-muted-foreground">{t('causal.v2.cooldown_hint')}</p>
          </details>

          {/* ── 试一试 ── */}
          <div className="space-y-2 rounded-md bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">{t('causal.v2.test')}</Label>
            </div>
            <p className="text-[11px] text-muted-foreground">{t('causal.v2.test_hint')}</p>
            <div className="flex gap-2">
              <Input value={testMsg} onChange={(e) => setTestMsg(e.target.value)} placeholder={t('causal.ed.test_ph')} className="h-8 text-sm" />
              <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || !testMsg.trim()}>
                {testing ? t('causal.ed.testing') : t('causal.ed.test_btn')}
              </Button>
            </div>
            {testResult && (
              <div className="text-xs space-y-1">
                <Badge variant={testResult.matched ? 'default' : 'secondary'} className="text-xs">
                  {testResult.matched ? t('causal.ed.matched') : t('causal.ed.unmatched')}
                </Badge>
                {testResult.matched && (
                  <>
                    <p className="text-muted-foreground">{t('causal.ed.rule_label')}{testResult.ruleName}</p>
                    <p className="rounded bg-background p-2">{testResult.reply || t('causal.ed.no_reply')}</p>
                    {testResult.counterChanges.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {testResult.counterChanges.map((cc, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{cc.name}: {cc.oldValue} → {cc.newValue}</Badge>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CausalRuleEditor;
