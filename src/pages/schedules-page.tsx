import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlatformIcon, platformLabel } from '@/components/platform-icon';
import { Clock, Plus, Trash2, RefreshCw, Loader2, Pencil, Save, X, Play } from 'lucide-react';

interface Task {
  id: number; name: string; platform: string; targetType: string; targetId: string;
  cronTime: string; days: string; content: string; enabled: boolean; lastRun: string;
  action: string; condition: string;
  triggerType: string;   // daily | interval | once
  intervalMin: number;
  onceDate: string;
}

const blankForm = { name: '', platform: 'onebot_v11', targetType: 'group', targetId: '', cronTime: '09:00', days: '', content: '', action: 'send', condition: '', triggerType: 'daily', intervalMin: 30, onceDate: '' };

// 条件搭建器：把 condition 字符串拆成可视化选项（旧数据里非 inactive>=N 的串归入 custom 原样保留）。
type CondKind = 'none' | 'inactive' | 'custom';
const parseCond = (c: string): { kind: CondKind; n: number } => {
  const s = (c || '').trim();
  if (!s) return { kind: 'none', n: 7 };
  const m = /^inactive\s*>=\s*(\d+)$/i.exec(s);
  if (m) return { kind: 'inactive', n: Number(m[1]) };
  return { kind: 'custom', n: 7 };
};

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 估算下次执行时刻（与后端调度规则对齐；daily 补发窗口内的边缘情况按次日近似）。
const nextRunOf = (tk: Task): string => {
  if (!tk.enabled) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const type = tk.triggerType || 'daily';
  if (type === 'interval') {
    if (!tk.intervalMin) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(tk.lastRun || '');
    if (!m) return '—';
    const last = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return fmt(new Date(last.getTime() + tk.intervalMin * 60000));
  }
  if (type === 'once') {
    if (tk.lastRun) return '—';   // 已执行/已过期
    return `${tk.onceDate} ${tk.cronTime}`;
  }
  const [hh, mm] = tk.cronTime.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return '—';
  const daySet = (tk.days || '').split(',').filter(Boolean).map(Number);
  const okDay = (d: Date) => daySet.length === 0 || daySet.includes(d.getDay());
  const now = new Date();
  const cand = new Date(now);
  cand.setHours(hh, mm, 0, 0);
  if (tk.lastRun === localToday() || cand.getTime() <= now.getTime()) cand.setDate(cand.getDate() + 1);
  for (let i = 0; i < 8; i++) { if (okDay(cand)) break; cand.setDate(cand.getDate() + 1); }
  return fmt(cand);
};

export const SchedulesPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...blankForm });
  const [daySet, setDaySet] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [condKind, setCondKind] = useState<CondKind>('none');
  const [condN, setCondN] = useState(7);

  const WEEK = t('schedules.week_short').split(',');
  const WEEK_FULL = t('schedules.week_full').split(',');

  const load = async () => {
    setLoading(true);
    try { const r = await fetch('/api/schedules'); const j = await r.json(); if (j.code === 0) setTasks(j.data || []); }
    catch { toast({ title: t('common.load_fail'), variant: 'destructive' }); }
    finally { setLoading(false); }
  };
  // 平台下拉从已配置的适配器取（以前写死 onebot_v11，Discord/KOOK 任务没法建）。
  const loadPlatforms = async () => {
    try {
      const r = await fetch('/api/adapters'); const j = await r.json();
      if (j.code === 0 && Array.isArray(j.data)) {
        const ps = [...new Set((j.data as { type: string }[]).map((a) => a.type).filter(Boolean))];
        if (ps.length) setPlatforms(ps);
      }
    } catch { /* 拿不到就只显示当前值 */ }
  };
  useEffect(() => { void load(); void loadPlatforms(); }, []);

  const startEdit = (tk: Task) => {
    setEditingId(tk.id);
    setForm({ name: tk.name, platform: tk.platform, targetType: tk.targetType, targetId: tk.targetId,
              cronTime: tk.cronTime, days: tk.days, content: tk.content, action: tk.action || 'send', condition: tk.condition || '',
              triggerType: tk.triggerType || 'daily', intervalMin: tk.intervalMin || 30, onceDate: tk.onceDate || '' });
    setDaySet(new Set((tk.days || '').split(',').filter(Boolean).map(Number)));
    const pc = parseCond(tk.condition || '');
    setCondKind(pc.kind); setCondN(pc.n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelEdit = () => { setEditingId(null); setForm({ ...blankForm }); setDaySet(new Set()); setCondKind('none'); setCondN(7); };

  const save = async () => {
    if (!form.targetId.trim() || (form.action !== 'leave' && !form.content.trim())) {
      toast({ title: t('schedules.need_fields'), variant: 'destructive' }); return;
    }
    if (form.triggerType === 'once' && !form.onceDate) {
      toast({ title: t('schedules.need_once_date'), variant: 'destructive' }); return;
    }
    const days = form.triggerType === 'daily' ? [...daySet].sort().join(',') : '';
    const condition = form.targetType === 'private' || condKind === 'none' ? ''
      : condKind === 'inactive' ? `inactive>=${Math.max(1, condN)}`
      : form.condition;
    try {
      const body = JSON.stringify({ ...form, condition, days, ...(editingId == null ? { enabled: true } : {}) });
      const url = editingId == null ? '/api/schedules' : `/api/schedules/${editingId}`;
      const r = await fetch(url, { method: editingId == null ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      cancelEdit(); toast({ title: t('common.save_success') }); void load();
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  // 立即执行：无视时刻/条件真跑一次（leave 任务先确认，会真的退群）。
  const runNow = async (tk: Task) => {
    if (tk.action === 'leave' && !window.confirm(t('schedules.run_leave_confirm', { id: tk.targetId }))) return;
    try {
      const r = await fetch(`/api/schedules/${tk.id}/run`, { method: 'POST' });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      if (!j.data?.executed) toast({ title: t('schedules.run_fail'), variant: 'destructive' });
      else toast({ title: t('schedules.run_done'), description: j.data?.conditionMet === false ? t('schedules.run_cond_miss') : undefined });
      void load();
    } catch (e) { toast({ title: t('schedules.run_fail'), description: String(e), variant: 'destructive' }); }
  };
  const toggle = async (tk: Task) => {
    try {
      const r = await fetch(`/api/schedules/${tk.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !tk.enabled }) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message); void load();
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const remove = async (id: number) => {
    try {
      const r = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      toast({ title: t('common.delete_success') }); void load();
    } catch (e) { toast({ title: t('common.delete_fail'), description: String(e), variant: 'destructive' }); }
  };

  const daysLabel = (d: string) => !d ? t('schedules.everyday_label') : d.split(',').filter(Boolean).map((n) => WEEK_FULL[Number(n)] ?? n).join(' ');
  const today = localToday();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Clock className="h-5 w-5" />{t('nav.schedules')}</h1>
        <p className="text-sm text-muted-foreground">{t('schedules.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {editingId == null ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {editingId == null ? t('schedules.add') : t('schedules.editing')}
          </CardTitle>
          <CardDescription>{t('schedules.add_hint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="font-normal">{t('schedules.name')}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('schedules.name_ph')} /></div>
            <div className="space-y-1.5"><Label className="font-normal">{t('schedules.trigger_type')}</Label>
              <Select value={form.triggerType} onValueChange={(v) => setForm({ ...form, triggerType: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t('schedules.trig_daily')}</SelectItem>
                  <SelectItem value="interval">{t('schedules.trig_interval')}</SelectItem>
                  <SelectItem value="once">{t('schedules.trig_once')}</SelectItem>
                </SelectContent>
              </Select></div>
            {form.triggerType === 'once' && (
              <div className="space-y-1.5"><Label className="font-normal">{t('schedules.once_date')}</Label>
                <Input type="date" value={form.onceDate} onChange={(e) => setForm({ ...form, onceDate: e.target.value })} /></div>
            )}
            {form.triggerType === 'interval' ? (
              <div className="space-y-1.5"><Label className="font-normal">{t('schedules.interval_label')}</Label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={1} max={10080} className="w-24" value={form.intervalMin}
                    onChange={(e) => setForm({ ...form, intervalMin: parseInt(e.target.value) || 1 })} />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">{t('schedules.interval_unit')}</span>
                </div></div>
            ) : (
              <div className="space-y-1.5"><Label className="font-normal">{t('schedules.time')}</Label>
                <Input type="time" value={form.cronTime} onChange={(e) => setForm({ ...form, cronTime: e.target.value })} /></div>
            )}
            <div className="space-y-1.5"><Label className="font-normal">{t('schedules.platform')}</Label>
              <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[...new Set([...platforms, form.platform])].filter(Boolean).map((p) => (
                    <SelectItem key={p} value={p}><span className="flex items-center gap-2"><PlatformIcon platform={p} />{platformLabel(p)}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label className="font-normal">{t('schedules.target_type')}</Label>
              <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">{t('schedules.group')}</SelectItem>
                  <SelectItem value="private">{t('schedules.private')}</SelectItem>
                </SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label className="font-normal">{t('schedules.target_id')}</Label>
              <Input value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })} placeholder={t('schedules.target_id_ph')} /></div>
            <div className="space-y-1.5"><Label className="font-normal">{t('schedules.action')}</Label>
              <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="send">{t('schedules.action_send')}</SelectItem>
                  <SelectItem value="leave">{t('schedules.action_leave')}</SelectItem>
                </SelectContent>
              </Select></div>
            {form.targetType === 'group' && (
              <div className="space-y-1.5"><Label className="font-normal">{t('schedules.condition')}</Label>
                <div className="flex items-center gap-2">
                  <Select value={condKind} onValueChange={(v) => setCondKind(v as CondKind)}>
                    <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('schedules.cond_none')}</SelectItem>
                      <SelectItem value="inactive">{t('schedules.cond_inactive')}</SelectItem>
                      {parseCond(form.condition).kind === 'custom' && <SelectItem value="custom">{t('schedules.cond_custom')}</SelectItem>}
                    </SelectContent>
                  </Select>
                  {condKind === 'inactive' && (<>
                    <Input type="number" min={1} className="w-20" value={condN} onChange={(e) => setCondN(Number(e.target.value) || 1)} />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">{t('schedules.cond_days_suffix')}</span>
                  </>)}
                  {condKind === 'custom' && <Input className="flex-1 font-mono" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} />}
                </div>
              </div>
            )}
          </div>
          {form.targetType === 'group' && condKind !== 'none' && <p className="text-xs text-muted-foreground">{t('schedules.condition_hint')}</p>}
          {form.triggerType === 'daily' && (
            <div className="space-y-1.5">
              <Label className="font-normal">{t('schedules.days')}</Label>
              <div className="flex gap-1.5 flex-wrap">
                {WEEK.map((w, i) => (
                  <button key={i} type="button" onClick={() => setDaySet((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                    className={`h-8 w-9 rounded-md border text-sm ${daySet.has(i) ? 'bg-primary text-primary-foreground border-primary' : 'border-input text-muted-foreground'}`}>{w}</button>
                ))}
                <span className="text-xs text-muted-foreground self-center ml-1">{daySet.size === 0 ? t('schedules.everyday') : ''}</span>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="font-normal">{form.action === 'leave' ? t('schedules.farewell') : t('schedules.content')}</Label>
            <Textarea rows={2} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder={t('schedules.content_placeholder')} />
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>{editingId == null ? <><Plus className="mr-2 h-4 w-4" />{t('schedules.add')}</> : <><Save className="mr-2 h-4 w-4" />{t('common.save')}</>}</Button>
            {editingId != null && <Button variant="outline" onClick={cancelEdit}><X className="mr-2 h-4 w-4" />{t('common.cancel')}</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('schedules.list')} ({tasks.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}</Button>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            : tasks.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">{t('schedules.empty')}</p>
            : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="rt w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium p-2.5">{t('schedules.name')}</th>
                    <th className="text-left font-medium p-2.5">{t('schedules.target')}</th>
                    <th className="text-left font-medium p-2.5">{t('schedules.time')}</th>
                    <th className="text-left font-medium p-2.5">{t('schedules.days')}</th>
                    <th className="text-left font-medium p-2.5">{t('schedules.action')}</th>
                    <th className="text-left font-medium p-2.5">{t('schedules.content')}</th>
                    <th className="text-left font-medium p-2.5">{t('schedules.last_run')}</th>
                    <th className="text-left font-medium p-2.5">{t('schedules.next_run')}</th>
                    <th className="text-left font-medium p-2.5 w-44"></th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((tk) => (
                    <tr key={tk.id} className="border-t align-top hover:bg-muted/30">
                      <td data-label={t('schedules.name')} className="p-2.5 font-medium whitespace-nowrap">{tk.name}</td>
                      <td data-label={t('schedules.target')} className="p-2.5 whitespace-nowrap text-muted-foreground">{(tk.targetType === 'private' ? t('schedules.private') : t('schedules.group'))} {tk.targetId === '*' ? t('schedules.all_groups') : tk.targetId}</td>
                      <td data-label={t('schedules.time')} className="p-2.5 font-mono whitespace-nowrap">
                        {(tk.triggerType || 'daily') === 'interval' ? t('schedules.every_n_min', { n: tk.intervalMin })
                          : tk.triggerType === 'once' ? `${tk.onceDate} ${tk.cronTime}` : tk.cronTime}
                      </td>
                      <td data-label={t('schedules.days')} className="p-2.5 whitespace-nowrap text-xs">
                        {(tk.triggerType || 'daily') === 'daily' ? daysLabel(tk.days) : '—'}
                      </td>
                      <td data-label={t('schedules.action')} className="p-2.5 whitespace-nowrap text-xs">
                        {tk.action === 'leave' ? <span className="text-destructive">{t('schedules.action_leave')}</span> : t('schedules.action_send')}
                        {tk.condition && <span className="block font-mono text-[11px] text-muted-foreground">{tk.condition}</span>}
                      </td>
                      <td data-label={t('schedules.content')} className="p-2.5 text-muted-foreground whitespace-pre-wrap break-words max-w-[14rem]">{tk.content}</td>
                      <td data-label={t('schedules.last_run')} className="p-2.5 whitespace-nowrap text-xs">
                        {tk.lastRun === today
                          ? <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-primary">{t('schedules.ran_today')}</span>
                          : <span className="text-muted-foreground font-mono">{tk.lastRun || '—'}</span>}
                      </td>
                      <td data-label={t('schedules.next_run')} className="p-2.5 whitespace-nowrap text-xs text-muted-foreground font-mono">{nextRunOf(tk)}</td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1.5">
                          <Switch checked={tk.enabled} onCheckedChange={() => toggle(tk)} />
                          <Button size="icon" variant="ghost" className="h-7 w-7" title={t('schedules.run_now')} onClick={() => runNow(tk)}><Play className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(tk)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(tk.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default SchedulesPage;
