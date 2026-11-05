import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FeatureHelp } from '@/components/ui/feature-help';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDialogs } from '@/hooks/use-dialogs';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { qqOfficialAction } from '@/lib/qq-official-actions';
import { platformData } from '@/lib/qq-official-editor';
import { EditorError, EditorSelect } from './qq-editor-shared';

type Props = { adapterId: string; onBusy: (busy: boolean) => void };
type Material = { image_id: string; file_name: string; url: string; preview_url?: string; expires_at: number };
const https = (value: string) => { try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; } catch { return false; } };

export function QQMaterials({ adapterId, onBusy }: Props) {
  const { t } = useTranslation();
  const { confirm, node } = useDialogs(t);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [items, setItems] = useState<Material[]>([]), [total, setTotal] = useState<number>();
  const [cursors, setCursors] = useState(['']), [next, setNext] = useState('');
  const [file, setFile] = useState<File>(), [preview, setPreview] = useState<Material>();
  useEffect(() => { onBusy(busy); return () => onBusy(false); }, [busy, onBusy]);
  const run = async (job: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await job(); } catch (e) { setError(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
  };
  const load = async (pages = ['']) => {
    const data = platformData(await qqOfficialAction(adapterId, 'qq_material_list', { cursor: pages[pages.length - 1] }));
    if (!Array.isArray(data.images) || data.images.some(item => !item || typeof item.image_id !== 'string' || typeof item.url !== 'string')) throw new Error(t('qq_editor.errors_invalid_response'));
    setItems(data.images as Material[]); setTotal(Number(data.total)); setNext(typeof data.next_cursor === 'string' ? data.next_cursor : ''); setCursors(pages);
  };
  return <section className="space-y-4 rounded-xl border bg-card p-4" data-setting-anchor="qq-materials">
    {node}
    <div className="flex items-center gap-2"><h2 className="font-medium">{t('qq_editor.materials')}</h2><FeatureHelp title={t('qq_editor.materials')} description={t('qq_editor.material_help')} /></div>
    <EditorError error={error} />{notice && <p role="status" className="break-all text-sm">{notice}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" disabled={busy} onClick={() => void run(() => load())}>{t('common.refresh')}{busy ? '…' : ''}</Button>
      {total !== undefined && <span className="text-sm text-muted-foreground">{total} / 100</span>}
      <Input type="file" className="w-full sm:w-72" accept="image/png,image/jpeg,image/gif,image/webp" disabled={busy} aria-label={t('qq_editor.upload_image')} onChange={e => setFile(e.target.files?.[0])} />
      <Button disabled={busy || !file} onClick={() => void run(async () => {
        if (!file || file.size < 1 || file.size > 10 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) throw new Error(t('qq_editor.material_limit'));
        const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
        const result = platformData(await qqOfficialAction(adapterId, 'qq_material_upload', { fileName: file.name, base64 }));
        // Signed preview URLs stay in memory only. The durable reference is qqbot-media://.
        await load(); setNotice(`${t('qq_editor.upload_done')} ${String(result.url || '')}`);
      })}>{t('qq_editor.upload_image')}</Button>
    </div>
    {items.map(item => <div key={item.image_id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{item.file_name || item.image_id}</p><p className="break-all text-xs text-muted-foreground">{item.url}</p><p className="text-xs text-muted-foreground">{t('qq_editor.expires')} {Number.isFinite(item.expires_at) ? new Date(item.expires_at * 1000).toLocaleString() : '—'}</p></div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!item.preview_url || !https(item.preview_url)} onClick={() => setPreview(item)}>{t('qq_editor.image_preview')}</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => { await navigator.clipboard.writeText(`![image](${item.url})`); setNotice(t('qq_editor.copied')); })}>{t('qq_editor.copy_image')}</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => {
          if (!await confirm({ title: t('common.delete'), description: t('qq_editor.material_delete'), destructive: true })) return;
          await qqOfficialAction(adapterId, 'qq_material_delete', { imageId: item.image_id }); await load();
        })}>{t('common.delete')}</Button>
      </div>
    </div>)}
    <div className="flex gap-2"><Button variant="outline" disabled={busy || cursors.length < 2} onClick={() => void run(() => load(cursors.slice(0, -1)))}>{t('qq_editor.previous')}</Button><Button variant="outline" disabled={busy || !next} onClick={() => void run(() => load([...cursors, next]))}>{t('qq_editor.next')}</Button></div>
    <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(undefined); }}><DialogContent><DialogHeader><DialogTitle>{preview?.file_name || t('qq_editor.image_preview')}</DialogTitle></DialogHeader>{preview?.preview_url && https(preview.preview_url) && <img src={preview.preview_url} alt={preview.file_name} referrerPolicy="no-referrer" className="max-h-[65vh] w-full object-contain" />}</DialogContent></Dialog>
  </section>;
}

export function QQMessageComposer({ adapterId, onBusy }: Props) {
  const { t } = useTranslation(); const { confirm, node } = useDialogs(t);
  const [mode, setMode] = useState('card'), [scope, setScope] = useState('group'), [target, setTarget] = useState('');
  const [title, setTitle] = useState(''), [description, setDescription] = useState(''), [url, setUrl] = useState(''), [pic, setPic] = useState('');
  const [text, setText] = useState(''), [msgId, setMsgId] = useState(''), [error, setError] = useState(''), [sent, setSent] = useState(false), [busy, setBusy] = useState(false);
  const sequence = useRef(1);
  const draft = JSON.stringify([mode, scope, target, title, description, url, pic, text, msgId]);
  const [savedDraft, setSavedDraft] = useState(draft);
  useUnsavedChanges(busy || draft !== savedDraft, () => busy ? Promise.resolve(false) : confirm({ title: t('qq_editor.discard_title'), description: t('qq_editor.discard_desc'), destructive: true }));
  useEffect(() => { onBusy(busy); return () => onBusy(false); }, [busy, onBusy]);
  const valid = mode === 'card' ? [...title].length >= 1 && [...title].length <= 50 && [...description].length >= 1 && [...description].length <= 200 && https(url) && https(pic) && url.length <= 1024 && pic.length <= 1024 : !!text.trim();
  const body = mode === 'card' ? { msg_type: 8, card: { type: 'tuwen', content: { title, description, url, pic_url: pic } } } : { msg_type: 2, markdown: { content: text } };
  return <section className="space-y-4 rounded-xl border bg-card p-4" data-setting-anchor="qq-messages">
    {node}
    <div className="flex items-center gap-2"><h2 className="font-medium">{t('qq_editor.message_cards')}</h2><FeatureHelp title={t('qq_editor.message_cards')} description={t('qq_editor.message_help')} /></div>
    <EditorError error={error} />{sent && <p role="status">{t('qq_editor.sent')}</p>}
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <EditorSelect label={t('qq_editor.type')} value={mode} onChange={setMode} options={[{ value: 'card', label: t('qq_editor.picture_card') }, { value: 'markdown', label: 'Markdown' }]} />
        <EditorSelect label={t('qq_editor.scope')} value={scope} onChange={setScope} options={[{ value: 'group', label: t('qq_editor.group') }, { value: 'c2c', label: t('qq_editor.c2c') }]} />
      </div>
      {mode === 'card' ? <div className="grid gap-4 sm:grid-cols-2">
        {[[title, setTitle, 'card_title'], [description, setDescription, 'card_description'], [url, setUrl, 'card_link'], [pic, setPic, 'card_image']].map(([value, setter, key]) => <div key={String(key)} className="space-y-2"><Label htmlFor={`qq-${key}`}>{t(`qq_editor.${key}`)}</Label><Input id={`qq-${key}`} value={String(value)} onChange={e => (setter as (value: string) => void)(e.target.value)} /></div>)}
      </div> : <div className="space-y-2"><Label htmlFor="qq-message-text">Markdown</Label><Textarea id="qq-message-text" value={text} onChange={e => setText(e.target.value)} rows={5} />
        {scope === 'group' && <Button type="button" variant="outline" onClick={() => setText(value => value + '<qqbot-at-everyone />')}>{t('qq_editor.mention_all')}</Button>}
        <p className="text-xs text-muted-foreground">{t('qq_editor.mention_help')}</p></div>}
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="qq-message-target">{t('qq_editor.target_id')}</Label><Input id="qq-message-target" value={target} onChange={e => setTarget(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="qq-message-id">{t('qq_editor.reply_id')}</Label><Input id="qq-message-id" value={msgId} onChange={e => setMsgId(e.target.value)} /></div></div>
      <Button disabled={!valid || !target.trim() || busy} onClick={async () => {
        setBusy(true); setError(''); setSent(false);
        try {
          if (!await confirm({ title: t('qq_editor.send_confirm'), description: `${t(`qq_editor.${scope}`)}: ${target}` })) return;
          await qqOfficialAction(adapterId, 'qq_send_message', { [scope === 'group' ? 'groupId' : 'userOpenId']: target.trim(), body: { ...body, msg_seq: sequence.current++, ...(msgId.trim() ? { msg_id: msgId.trim() } : {}) } }); setSent(true); setSavedDraft(draft); }
        catch (e) { setError(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
      }}>{t('qq_editor.send')}</Button>
    </fieldset>
    <details><summary className="cursor-pointer text-sm">{t('qq_editor.raw')}</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(body, null, 2)}</pre></details>
  </section>;
}
