import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDialogs } from '@/hooks/use-dialogs';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Memory { id: number; scope: string; scope_id: string; content: string; updated_at: number; hits: number; }
async function request(path: string, method = 'GET', body?: unknown) {
  const response = await fetch('/api/system/ai/memory' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok || result.code !== 0) throw new Error(result.message || `HTTP ${response.status}`);
  return result.data;
}

export function AiMemoryDialog({ kind, onClose }: { kind: 'summary' | 'fact' | null; onClose: () => void }) {
  const { t } = useTranslation(); const toast = useToast(); const dialogs = useDialogs();
  const [items, setItems] = useState<Memory[]>([]); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [group, setGroup] = useState('');
  const [query, setQuery] = useState(''); const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Memory | null>(null); const [draft, setDraft] = useState('');
  useEffect(() => {
    if (!kind) return;
    let active = true; setBusy(true); setError(''); setSelected(null); setItems([]); setQuery(''); setPage(0);
    request('?kind=' + kind).then((data) => { if (active) { setItems(data.items); setGroup(data.items[0]?.scope_id || ''); } })
      .catch((e: Error) => { if (active) setError(e.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [kind]);
  const groups = [...new Set(items.map((item) => item.scope_id))];
  const matches = items.filter((item) => item.scope_id === group && item.content.toLowerCase().includes(query.toLowerCase()));
  const visible = matches.slice(page * 8, page * 8 + 8);
  const select = async (item: Memory | null) => {
    if (selected && draft !== selected.content && !await dialogs.confirm({ title: t('ai.memory_discard'), description: t('ai.memory_discard_desc') })) return;
    setSelected(item); setDraft(item?.content || '');
  };
  const save = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await request('', 'PUT', { id: selected.id, content: draft, previous_content: selected.content });
      const next = { ...selected, content: draft, updated_at: Math.floor(Date.now() / 1000) };
      setItems((all) => all.map((item) => item.id === next.id ? next : item)); setSelected(next);
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!selected || !await dialogs.confirm({ title: t('ai.memory_delete'), description: t('ai.memory_delete_desc'), destructive: true, confirmText: t('common.delete') })) return;
    setBusy(true);
    try { await request('?id=' + selected.id, 'DELETE'); setItems((all) => all.filter((item) => item.id !== selected.id)); setSelected(null); setDraft(''); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const height = Math.max(180, visible.length * 76);
  return <>{dialogs.node}<Dialog open={!!kind} onOpenChange={async (open) => {
    if (!open && !busy && (!selected || draft === selected.content || await dialogs.confirm({ title: t('ai.memory_discard'), description: t('ai.memory_discard_desc') }))) onClose();
  }}><DialogContent layout="editor" className="max-w-6xl"><DialogHeader><DialogTitle>{t(kind === 'fact' ? 'ai.mlong_stored' : 'ai.mem_stored')}</DialogTitle></DialogHeader>
    <div className="grid gap-3 sm:grid-cols-2"><Select value={group || undefined} onValueChange={(value) => { setGroup(value); setPage(0); }}><SelectTrigger aria-label={t('ai.memory_scope')}><SelectValue placeholder={t('ai.memory_scope')} /></SelectTrigger><SelectContent>{groups.map((id) => <SelectItem key={id} value={id}>{id}</SelectItem>)}</SelectContent></Select><Input aria-label={t('common.search')} placeholder={t('common.search')} value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} /></div>
    <DialogBody className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="min-w-0 rounded-xl border bg-muted/20 p-3">
        {busy && <Loader2 className="h-5 w-5 animate-spin" aria-label={t('common.loading')} />}
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {!busy && !matches.length && <p className="p-6 text-sm text-muted-foreground">{t('ai.mem_empty')}</p>}
        <div className="overflow-x-auto"><div className="relative min-w-[440px]" style={{ height }}>
          <svg className="absolute inset-0 h-full w-full text-primary/30" aria-hidden="true" viewBox={`0 0 440 ${height}`} preserveAspectRatio="none">{visible.map((item, i) => <path key={item.id} d={`M 130 ${height / 2} C 180 ${height / 2}, 155 ${i * 76 + 36}, 205 ${i * 76 + 36}`} fill="none" stroke="currentColor" strokeWidth="2" />)}</svg>
          <div className="absolute left-0 w-[30%] break-all rounded-xl bg-primary/10 p-3 text-center text-xs font-medium text-primary" style={{ top: '50%', transform: 'translateY(-50%)' }}>{group || t('ai.memory_scope')}</div>
          {visible.map((item, i) => <Button key={item.id} variant="outline" disabled={busy} className={`absolute left-[47%] h-16 w-[53%] justify-start whitespace-normal rounded-xl px-3 text-left text-xs ${selected?.id === item.id ? 'border-primary bg-primary/10' : 'bg-card'}`} style={{ top: i * 76 + 4 }} onClick={() => void select(item)}><span className="line-clamp-2 break-all">{item.content}</span></Button>)}
        </div></div>
        <div className="mt-3 flex items-center justify-center gap-3"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>←</Button><span className="text-xs">{page + 1} / {Math.max(1, Math.ceil(matches.length / 8))}</span><Button size="sm" variant="outline" disabled={(page + 1) * 8 >= matches.length} onClick={() => setPage(page + 1)}>→</Button></div>
      </div>
      <div className="flex min-w-0 flex-col gap-3 rounded-xl border p-4">{selected ? <>
        <p className="break-all text-sm font-medium">{selected.scope_id}</p><p className="text-xs text-muted-foreground">{new Date(selected.updated_at * 1000).toLocaleString()} · {t('ai.memory_hits', { count: selected.hits })}</p>
        <Textarea aria-label={t('ai.memory_content')} value={draft} disabled={busy} onChange={(e) => setDraft(e.target.value)} className="min-h-64 flex-1" />
        {kind === 'fact' && <p className="text-xs text-muted-foreground">{t('ai.memory_embed_edit')}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => void remove()}>{t('common.delete')}</Button><Button disabled={busy || !draft.trim() || draft === selected.content} onClick={() => void save()}>{t('common.save')}</Button></div>
      </> : <p className="py-10 text-center text-sm text-muted-foreground">{t('ai.memory_select')}</p>}</div>
    </DialogBody>
  </DialogContent></Dialog></>;
}
