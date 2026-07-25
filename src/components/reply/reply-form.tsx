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
import type { ReplyRule, ReplyFormData, MatchType, ReplyLogic, ReplyCondition } from '@/types/reply';
import { DEFAULT_REPLY_PRIORITY } from '@/types/reply';

const MATCH_TYPES: MatchType[] = ['keyword', 'prefix', 'regex', 'search'];

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
    setSubmitting(true);
    try {
      await onSubmit({ conditions: conds, logic, results: res, priority });
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
              <div key={i} className="flex items-start gap-1.5">
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
