import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Image as ImageIcon, Plus, X } from 'lucide-react';
import type { ReplyRule, ReplyFormData, MatchType, ReplyLogic, ReplyCondition, ReplyScopeMode } from '@/types/reply';
import { DEFAULT_REPLY_PRIORITY } from '@/types/reply';

// 下拉顺序按「日常最常用」排：包含 → 完全等于 → 前缀 → 正则。
// （keyword 的语义是整条消息完全相等，别再叫它「关键词」误导人。）
const MATCH_TYPES: MatchType[] = ['search', 'keyword', 'prefix', 'regex'];

// 客户端先粗验正则（服务端保存时还会用真引擎再验一次）。
const regexError = (pattern: string): string | null => {
  if (pattern.length > 400) return 'too long';
  try { new RegExp(pattern); return null; } catch (e) { return String(e); }
};

interface ReplyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ReplyFormData) => Promise<void>;
  reply?: ReplyRule | null;
}

export const ReplyForm: React.FC<ReplyFormProps> = ({ open, onOpenChange, onSubmit, reply }) => {
  const { t } = useTranslation();
  const isEdit = !!reply;
  const [conditions, setConditions] = React.useState<ReplyCondition[]>([{ type: 'keyword', content: '' }]);
  const [logic, setLogic] = React.useState<ReplyLogic>('or');
  const [results, setResults] = React.useState<string[]>(['']);
  const [priority, setPriority] = React.useState<number>(DEFAULT_REPLY_PRIORITY);
  const [prob, setProb] = React.useState<number>(100);
  const [cooldownSec, setCooldownSec] = React.useState<number>(0);
  const [scopeMode, setScopeMode] = React.useState<ReplyScopeMode>('');
  const [scopeIds, setScopeIds] = React.useState<string>('');
  const [cooldownNotice, setCooldownNotice] = React.useState<string>('');
  const [dayLimit, setDayLimit] = React.useState<number>(0);
  const [dayLimitNotice, setDayLimitNotice] = React.useState<string>('');
  const [scopeUsersMode, setScopeUsersMode] = React.useState<ReplyScopeMode>('');
  const [scopeUsers, setScopeUsers] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    const conds = reply?.conditions && reply.conditions.length
      ? reply.conditions.map((c) => ({ ...c }))
      : [{ type: (reply?.matchType ?? 'keyword') as MatchType, content: reply?.matchContent ?? '' }];
    const res = reply?.results && reply.results.length ? [...reply.results] : [reply?.replyContent ?? ''];
    setConditions(conds);
    setLogic(reply?.logic ?? 'or');
    setResults(res);
    setPriority(reply?.priority ?? DEFAULT_REPLY_PRIORITY);
    setProb(reply?.prob ?? 100);
    setCooldownSec(reply?.cooldownSec ?? 0);
    setScopeMode((reply?.scopeMode ?? '') as ReplyScopeMode);
    setScopeIds(reply?.scopeIds ?? '');
    setCooldownNotice(reply?.cooldownNotice ?? '');
    setDayLimit(reply?.dayLimit ?? 0);
    setDayLimitNotice(reply?.dayLimitNotice ?? '');
    setScopeUsersMode((reply?.scopeUsersMode ?? '') as ReplyScopeMode);
    setScopeUsers(reply?.scopeUsers ?? '');
    setError('');
  }, [open, reply]);

  const setCond = (i: number, patch: Partial<ReplyCondition>) =>
    setConditions((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addCond = () => setConditions((cs) => [...cs, { type: 'keyword', content: '' }]);
  const delCond = (i: number) => setConditions((cs) => cs.filter((_, idx) => idx !== i));

  const setResult = (i: number, v: string) => setResults((rs) => rs.map((r, idx) => (idx === i ? v : r)));
  const addResult = () => setResults((rs) => [...rs, '']);
  const delResult = (i: number) => setResults((rs) => rs.filter((_, idx) => idx !== i));

  // Image upload → append the CQ code to a specific result.
  const imgRef = React.useRef<HTMLInputElement>(null);
  const imgTarget = React.useRef<number>(0);
  const pickImage = (idx: number) => { imgTarget.current = idx; imgRef.current?.click(); };
  const uploadImage = async (file: File) => {
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file);
      });
      const r = await fetch('/api/assets/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data: dataUrl }) });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      const i = imgTarget.current;
      setResults((rs) => rs.map((x, idx) => (idx === i ? x + j.data.code : x)));
    } catch { /* ignore — empty-content validation will catch issues */ }
  };

  const submit = async () => {
    const conds = conditions.filter((c) => c.content.trim());
    const res = results.map((r) => r).filter((r) => r.trim());
    if (conds.length === 0) { setError(t('replies.err_need_cond')); return; }
    if (res.length === 0) { setError(t('replies.err_need_result')); return; }
    for (const c of conds) {
      if (c.type === 'regex') {
        const re = regexError(c.content);
        if (re) { setError(t('replies.err_bad_regex', { err: re })); return; }
      }
    }
    if (scopeMode && !scopeIds.trim()) { setError(t('replies.err_need_scope_ids')); return; }
    if (scopeUsersMode && !scopeUsers.trim()) { setError(t('replies.err_need_scope_users')); return; }
    setSubmitting(true);
    try {
      await onSubmit({
        conditions: conds, logic, results: res, priority,
        prob: Math.min(100, Math.max(0, prob)),
        cooldownSec: Math.max(0, cooldownSec),
        scopeMode, scopeIds: scopeMode ? scopeIds.trim() : '',
        cooldownNotice: cooldownSec > 0 ? cooldownNotice : '',
        dayLimit: Math.max(0, dayLimit),
        dayLimitNotice: dayLimit > 0 ? dayLimitNotice : '',
        scopeUsersMode, scopeUsers: scopeUsersMode ? scopeUsers.trim() : '',
      });
      onOpenChange(false);
    } catch (e) { setError(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('replies.edit_title') : t('replies.add_title')}</DialogTitle>
          <DialogDescription>{t('replies.form_desc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('replies.cond_label')}</Label>
              {conditions.length > 1 && (
                <div className="flex items-center gap-1 text-xs">
                  <button type="button" onClick={() => setLogic('and')}
                    className={`rounded px-2 py-0.5 border ${logic === 'and' ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground'}`}>{t('replies.logic_and')}</button>
                  <button type="button" onClick={() => setLogic('or')}
                    className={`rounded px-2 py-0.5 border ${logic === 'or' ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground'}`}>{t('replies.logic_or')}</button>
                </div>
              )}
            </div>
            {conditions.map((c, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-start gap-1.5">
                  <Select value={c.type} onValueChange={(v) => setCond(i, { type: v as MatchType })}>
                    <SelectTrigger className="w-28 shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MATCH_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>{t('replies.mt_' + value, value)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input value={c.content} onChange={(e) => setCond(i, { content: e.target.value })}
                    placeholder={t('replies.ph_' + c.type)} className="flex-1" />
                  {conditions.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => delCond(i)}><X className="h-4 w-4" /></Button>
                  )}
                </div>
                {c.type === 'regex' && c.content.trim() && regexError(c.content) && (
                  <p className="text-xs text-destructive pl-28 ml-1.5">{t('replies.regex_invalid')}</p>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addCond}><Plus className="mr-1 h-3.5 w-3.5" />{t('replies.add_cond')}</Button>
          </div>

          {/* Results */}
          <div className="space-y-2">
            <Label>{t('replies.result_label')}{results.length > 1 && <span className="ml-1 text-xs text-muted-foreground">{t('replies.result_random')}</span>}</Label>
            {results.map((r, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('replies.result_n', { n: i + 1 })}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => pickImage(i)}
                      className="inline-flex items-center gap-1 rounded border border-dashed px-2 py-0.5 text-xs hover:bg-muted transition-colors">
                      <ImageIcon className="h-3.5 w-3.5 text-primary" />{t('replies.insert_image')}
                    </button>
                    {results.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => delResult(i)}><X className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                </div>
                <Textarea rows={3} value={r} onChange={(e) => setResult(i, e.target.value)}
                  placeholder={t('replies.result_ph')} />
              </div>
            ))}
            <input ref={imgRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ''; }} />
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addResult}><Plus className="mr-1 h-3.5 w-3.5" />{t('replies.add_result')}</Button>
            <p className="text-xs text-muted-foreground leading-relaxed">{t('replies.var_hint')}</p>
          </div>

          {/* 触发限制（原版每条规则自带：概率 / 冷却 / 生效范围） */}
          <div className="space-y-2">
            <Label>{t('replies.limits_label')}</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t('replies.limit_prob')}</span>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={0} max={100} className="w-20"
                    value={prob} onChange={(e) => setProb(parseInt(e.target.value) || 0)} />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t('replies.limit_cd')}</span>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={0} className="w-24"
                    value={cooldownSec} onChange={(e) => setCooldownSec(parseInt(e.target.value) || 0)} />
                  <span className="text-sm text-muted-foreground">{t('replies.limit_cd_unit')}</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t('replies.limit_daylimit')}</span>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={0} className="w-24"
                    value={dayLimit} onChange={(e) => setDayLimit(parseInt(e.target.value) || 0)} />
                  <span className="text-sm text-muted-foreground">{t('replies.limit_daylimit_unit')}</span>
                </div>
              </div>
            </div>
            {cooldownSec > 0 && (
              <Input value={cooldownNotice} onChange={(e) => setCooldownNotice(e.target.value)}
                placeholder={t('replies.limit_cd_notice_ph')} />
            )}
            {dayLimit > 0 && (
              <Input value={dayLimitNotice} onChange={(e) => setDayLimitNotice(e.target.value)}
                placeholder={t('replies.limit_daylimit_notice_ph')} />
            )}
            <div className="flex items-start gap-1.5">
              <Select value={scopeMode || 'all'} onValueChange={(v) => setScopeMode((v === 'all' ? '' : v) as ReplyScopeMode)}>
                <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('replies.scope_all')}</SelectItem>
                  <SelectItem value="allow">{t('replies.scope_allow')}</SelectItem>
                  <SelectItem value="deny">{t('replies.scope_deny')}</SelectItem>
                </SelectContent>
              </Select>
              {scopeMode && (
                <Input value={scopeIds} onChange={(e) => setScopeIds(e.target.value)}
                  placeholder={t('replies.scope_ids_ph')} className="flex-1 font-mono" />
              )}
            </div>
            <div className="flex items-start gap-1.5">
              <Select value={scopeUsersMode || 'all'} onValueChange={(v) => setScopeUsersMode((v === 'all' ? '' : v) as ReplyScopeMode)}>
                <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('replies.scope_users_all')}</SelectItem>
                  <SelectItem value="allow">{t('replies.scope_users_allow')}</SelectItem>
                  <SelectItem value="deny">{t('replies.scope_users_deny')}</SelectItem>
                </SelectContent>
              </Select>
              {scopeUsersMode && (
                <Input value={scopeUsers} onChange={(e) => setScopeUsers(e.target.value)}
                  placeholder={t('replies.scope_users_ph')} className="flex-1 font-mono" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('replies.limits_hint')}</p>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label htmlFor="priority">{t('replies.priority')}</Label>
            <Input id="priority" type="number" min={0} max={9999} className="w-24"
              value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 0)} />
            <p className="text-xs text-muted-foreground">{t('replies.priority_hint')}</p>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{t('common.cancel')}</Button>
          <Button type="button" onClick={submit} disabled={submitting}>{submitting ? t('common.saving') : isEdit ? t('replies.save_edit') : t('common.add')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReplyForm;
