import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpRight, SlidersHorizontal, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DEFAULT_SHORTCUTS, MAX_SHORTCUTS, SHORTCUT_OPTIONS, SHORTCUT_STORAGE_KEY, moveShortcut, readShortcuts } from '@/lib/dashboard-shortcuts';

export function QuickActions({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useTranslation();
  const [paths, setPaths] = useState(() => readShortcuts(localStorage));
  const [draft, setDraft] = useState(paths);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const label = (path: string) => t(SHORTCUT_OPTIONS.find(([key]) => key === path)?.[1] || 'nav.dashboard');
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === SHORTCUT_STORAGE_KEY || event.key === null) setPaths(readShortcuts(localStorage));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const save = () => {
    try { localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(draft)); }
    catch { setError(true); return; }
    setPaths([...draft]); setOpen(false);
  };
  return <Card data-setting-anchor="dashboard-shortcuts">
    <CardHeader className="flex-row items-center justify-between gap-2 p-4 pb-3">
      <CardTitle className="text-sm">{t('dashboard_shortcuts.title')}</CardTitle>
      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t('dashboard_shortcuts.customize')} title={t('dashboard_shortcuts.customize')}
        onClick={() => { setDraft([...paths]); setError(false); setOpen(true); }}><SlidersHorizontal className="h-4 w-4" /></Button>
    </CardHeader>
    <CardContent className="p-4 pt-0">
      {paths.length === 0 ? <p className="text-xs text-muted-foreground">{t('dashboard_shortcuts.empty')}</p> :
        <div className="grid grid-cols-2 gap-2" data-testid="dashboard-shortcuts">
          {paths.map((path) => <button key={path} onClick={() => onNavigate(path)}
            className="flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="min-w-0 break-words">{label(path)}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>)}
        </div>}
    </CardContent>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent layout="editor" className="max-w-xl">
        <DialogHeader><DialogTitle>{t('dashboard_shortcuts.customize')}</DialogTitle><DialogDescription>{t('dashboard_shortcuts.description')}</DialogDescription></DialogHeader>
        <DialogBody className="space-y-5 px-1">
          <section aria-label={t('dashboard_shortcuts.selected')}>
            <h3 className="mb-2 text-sm font-medium">{t('dashboard_shortcuts.selected')} <span className="text-muted-foreground">{draft.length} / {MAX_SHORTCUTS}</span></h3>
            <ol className="space-y-2">
              {draft.map((path, index) => <li key={path} className="flex items-center gap-1 rounded-lg border px-3 py-1.5">
                <span className="mr-2 text-xs tabular-nums text-muted-foreground">{index + 1}</span><span className="min-w-0 flex-1 text-sm">{label(path)}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={index === 0} aria-label={t('dashboard_shortcuts.up', { name: label(path) })} onClick={() => setDraft(moveShortcut(draft, index, -1))}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={index === draft.length - 1} aria-label={t('dashboard_shortcuts.down', { name: label(path) })} onClick={() => setDraft(moveShortcut(draft, index, 1))}><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('dashboard_shortcuts.remove', { name: label(path) })} onClick={() => setDraft(draft.filter((value) => value !== path))}><X className="h-4 w-4" /></Button>
              </li>)}
            </ol>
          </section>
          <section aria-label={t('dashboard_shortcuts.available')}>
            <h3 className="mb-2 text-sm font-medium">{t('dashboard_shortcuts.available')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {SHORTCUT_OPTIONS.map(([path, key]) => <label key={path} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                <input type="checkbox" className="h-4 w-4 shrink-0 accent-primary" checked={draft.includes(path)} disabled={!draft.includes(path) && draft.length >= MAX_SHORTCUTS}
                  onChange={(event) => setDraft(event.target.checked ? [...draft, path] : draft.filter((value) => value !== path))} />
                <span>{t(key)}</span>
              </label>)}
            </div>
          </section>
        </DialogBody>
        {error && <p role="alert" className="text-sm text-destructive">{t('dashboard_shortcuts.save_failed')}</p>}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setDraft([...DEFAULT_SHORTCUTS])}>{t('dashboard_shortcuts.restore')}</Button>
          <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={save}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>;
}
