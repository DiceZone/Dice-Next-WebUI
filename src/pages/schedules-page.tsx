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
import { Clock, Plus, Trash2, RefreshCw, Loader2, Pencil, Save, X } from 'lucide-react';

interface Task {
  id: number; name: string; platform: string; targetType: string; targetId: string;
  cronTime: string; days: string; content: string; enabled: boolean; lastRun: string;
  action: string; condition: string;
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const blankForm = { name: '', platform: 'onebot_v11', targetType: 'group', targetId: '', cronTime: '09:00', days: '', content: '', action: 'send', condition: '' };

export const SchedulesPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...blankForm });
  const [daySet, setDaySet] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try { const r = await fetch('/api/schedules'); const j = await r.json(); if (j.code === 0) setTasks(j.data || []); }
    catch { toast({ title: t('common.load_fail'), variant: 'destructive' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const startEdit = (tk: Task) => {
    setEditingId(tk.id);
    setForm({ name: tk.name, platform: tk.platform, targetType: tk.targetType, targetId: tk.targetId,
              cronTime: tk.cronTime, days: tk.days, content: tk.content, action: tk.action || 'send', condition: tk.condition || '' });
    setDaySet(new Set((tk.days || '').split(',').filter(Boolean).map(Number)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelEdit = () => { setEditingId(null); setForm({ ...blankForm }); setDaySet(new Set()); };

  const save = async () => {
    if (!form.targetId.trim() || (form.action !== 'leave' && !form.content.trim())) {
      toast({ title: t('schedules.need_fields'), variant: 'destructive' }); return;
    }
    const days = [...daySet].sort().join(',');
    try {
      const body = JSON.stringify({ ...form, days, ...(editingId == null ? { enabled: true } : {}) });
      const url = editingId == null ? '/api/schedules' : `/api/schedules/${editingId}`;
      const r = await fetch(url, { method: editingId == null ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      cancelEdit(); toast({ title: t('common.save_success') }); void load();
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
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

  const daysLabel = (d: string) => !d ? '每天' : d.split(',').filter(Boolean).map((n) => '周' + WEEK[Number(n)]).join(' ');

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
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="每日早安" /></div>
            <div className="space-y-1.5"><Label className="font-normal">{t('schedules.time')}</Label>
              <Input type="time" value={form.cronTime} onChange={(e) => setForm({ ...form, cronTime: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="font-normal">{t('schedules.target_type')}</Label>
              <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">{t('schedules.group')}</SelectItem>
                  <SelectItem value="private">{t('schedules.private')}</SelectItem>
                </SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label className="font-normal">{t('schedules.target_id')}</Label>
              <Input value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })} placeholder="群号 / QQ号" /></div>
            <div className="space-y-1.5"><Label className="font-normal">{t('schedules.action')}</Label>
              <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="send">{t('schedules.action_send')}</SelectItem>
                  <SelectItem value="leave">{t('schedules.action_leave')}</SelectItem>
                </SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label className="font-normal">{t('schedules.condition')}</Label>
              <Input value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="inactive>=7" /></div>
          </div>
          <p className="text-xs text-muted-foreground">{t('schedules.condition_hint')}</p>
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
                    <th className="text-left font-medium p-2.5 w-36"></th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((tk) => (
                    <tr key={tk.id} className="border-t align-top hover:bg-muted/30">
                      <td data-label={t('schedules.name')} className="p-2.5 font-medium whitespace-nowrap">{tk.name}</td>
                      <td data-label={t('schedules.target')} className="p-2.5 whitespace-nowrap text-muted-foreground">{(tk.targetType === 'private' ? t('schedules.private') : t('schedules.group'))} {tk.targetId}</td>
                      <td data-label={t('schedules.time')} className="p-2.5 font-mono whitespace-nowrap">{tk.cronTime}</td>
                      <td data-label={t('schedules.days')} className="p-2.5 whitespace-nowrap text-xs">{daysLabel(tk.days)}</td>
                      <td data-label={t('schedules.action')} className="p-2.5 whitespace-nowrap text-xs">
                        {tk.action === 'leave' ? <span className="text-destructive">{t('schedules.action_leave')}</span> : t('schedules.action_send')}
                        {tk.condition && <span className="block font-mono text-[11px] text-muted-foreground">{tk.condition}</span>}
                      </td>
                      <td data-label={t('schedules.content')} className="p-2.5 text-muted-foreground whitespace-pre-wrap break-words max-w-[14rem]">{tk.content}</td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1.5">
                          <Switch checked={tk.enabled} onCheckedChange={() => toggle(tk)} />
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
