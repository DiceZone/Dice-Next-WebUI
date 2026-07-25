import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, X, Loader2 } from 'lucide-react';

interface BroadcastStatus { active: boolean; content: string; pushed: number; total: number; }

// C#72：render 控制渲染部位——'banner' 仅活动横幅（供单独一行）、'button' 仅「新增广播」
// 按钮（供与搜索/添加同一横排）、'both' 旧行为（二者择一）。
export const BroadcastBar: React.FC<{ render?: 'both' | 'banner' | 'button' }> = ({ render = 'both' }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [st, setSt] = useState<BroadcastStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const r = await fetch('/api/broadcast'); const j = await r.json(); if (j.code === 0) setSt(j.data); } catch { /* ignore */ }
  }, []);
  // 'button' 模式不显示状态，无需轮询（避免与 'banner' 实例重复轮询）。
  useEffect(() => { if (render === 'button') return; void load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load, render]);

  const chars = [...text].length;
  const tooLong = chars > 200;

  const save = async () => {
    if (!text.trim() || tooLong) return;
    setBusy(true);
    try {
      const r = await fetch('/api/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text.trim() }) });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      setOpen(false); setText(''); toast({ title: t('broadcast.saved') }); void load();
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    try { await fetch('/api/broadcast', { method: 'DELETE' }); toast({ title: t('broadcast.cancelled') }); void load(); }
    catch { toast({ title: t('common.operation_fail'), variant: 'destructive' }); }
  };

  const banner = st?.active ? (
    <div className="flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3">
      <Megaphone className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{t('broadcast.pending')}</span>
          <span className="text-xs text-muted-foreground">{t('broadcast.pushed')}: {st.pushed}/{st.total}</span>
        </div>
        <p className="text-sm mt-1 whitespace-pre-wrap break-words">{st.content}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="outline" onClick={() => { setText(st.content); setOpen(true); }}>{t('broadcast.replace')}</Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={cancel}><X className="mr-1 h-4 w-4" />{t('broadcast.cancel')}</Button>
      </div>
    </div>
  ) : null;
  const newButton = (
    <Button size="sm" variant="outline" onClick={() => { setText(''); setOpen(true); }}>
      <Megaphone className="mr-2 h-4 w-4" />{t('broadcast.new')}
    </Button>
  );

  return (
    <>
      {render === 'banner' && banner}
      {render === 'button' && newButton}
      {render === 'both' && (st?.active ? banner : newButton)}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('broadcast.dialog_title')}</DialogTitle>
            <DialogDescription className="whitespace-pre-wrap">{t('broadcast.rules')}</DialogDescription>
          </DialogHeader>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
            placeholder={t('broadcast.placeholder')} maxLength={800} />
          <div className={`text-right text-xs ${tooLong ? 'text-destructive' : 'text-muted-foreground'}`}>{chars}/200</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button disabled={busy || !text.trim() || tooLong} onClick={save}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BroadcastBar;
