import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListTree, PanelsTopLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QQMenuEditor } from '@/components/adapter/qq-menu-editor';
import { QQPanelEditor } from '@/components/adapter/qq-panel-editor';
import { EditorError } from '@/components/adapter/qq-editor-shared';
import { zustandAdapterStore } from '@/store/adapter-store';
import type { Adapter } from '@/types/adapter';

function AccountEditors({ adapter, onBusy }: { adapter: Adapter; onBusy: (busy: boolean) => void }) {
  const { t } = useTranslation();
  const [menuBusy, setMenuBusy] = useState(false), [panelBusy, setPanelBusy] = useState(false);
  const focus = new URLSearchParams(window.location.hash.split('?')[1] || '').get('focus');
  const [tab, setTab] = useState(focus === 'qq-panels' ? 'panels' : 'menu');
  useEffect(() => { onBusy(menuBusy || panelBusy); }, [menuBusy, panelBusy, onBusy]);
  return <Tabs value={tab} onValueChange={setTab} className="min-w-0 space-y-5">
    <TabsList variant="page" responsive aria-label={t('qq_editor.title')}>
      <TabsTrigger value="menu"><ListTree className="h-4 w-4" />{t('qq_editor.menu')}</TabsTrigger>
      <TabsTrigger value="panels"><PanelsTopLeft className="h-4 w-4" />{t('qq_editor.panels')}</TabsTrigger>
    </TabsList>
    {/* Keep both drafts mounted when switching tabs. */}
    <TabsContent forceMount value="menu" className="data-[state=inactive]:hidden" data-setting-anchor="qq-menu">
      <QQMenuEditor adapterId={adapter.id} accountName={adapter.name} connected={adapter.status === 'connected'} onBusy={setMenuBusy} />
    </TabsContent>
    <TabsContent forceMount value="panels" className="data-[state=inactive]:hidden" data-setting-anchor="qq-panels">
      <QQPanelEditor adapterId={adapter.id} accountName={adapter.name} connected={adapter.status === 'connected'} onBusy={setPanelBusy} />
    </TabsContent>
  </Tabs>;
}
export function QQOfficialPage() {
  const { t } = useTranslation();
  const { adapters, fetchAdapters, error } = zustandAdapterStore();
  const requested = new URLSearchParams(window.location.hash.split('?')[1] || '').get('adapter') || '';
  const [selected, setSelected] = useState(requested), [busy, setBusy] = useState(false);
  const official = adapters.filter((adapter) => adapter.type === 'qq_official');
  const adapter = official.find((candidate) => candidate.id === selected);
  useEffect(() => { void fetchAdapters(); const timer = setInterval(() => void fetchAdapters(), 15000); return () => clearInterval(timer); }, [fetchAdapters]);
  useEffect(() => { if (!selected && official.length) setSelected(official[0].id); }, [official, selected]);
  return <div className="min-w-0 space-y-6">
    <PageHeader title={t('qq_editor.title')} icon={PanelsTopLeft} description={t('qq_editor.subtitle')} help={t('qq_editor.help')} />
    <EditorError error={error || ''} />
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
      <span className="text-sm font-medium">{t('qq_editor.account')}</span>
      <Select value={adapter?.id ?? ''} disabled={busy || !official.length} onValueChange={(value) => {
        // AppRouter asks the registered draft guards before switching accounts.
        const query = new URLSearchParams(window.location.hash.split('?')[1] || '');
        query.set('adapter', value); window.location.hash = `/qq-official?${query}`;
      }}>
        <SelectTrigger className="w-full min-w-0 sm:w-80" aria-label={t('qq_editor.account')}><SelectValue placeholder={t('qq_editor.account')} /></SelectTrigger>
        <SelectContent>{official.map((account) => <SelectItem key={account.id} value={account.id}>{account.name} · {account.appId || account.id}</SelectItem>)}</SelectContent>
      </Select>
      {adapter && <span className="break-all font-mono text-xs text-muted-foreground">AppID: {adapter.appId || '—'}</span>}
    </div>
    {!adapter ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{official.length ? t('qq_editor.account') : t('qq_editor.no_account')}</div>
      : <><p className={`text-sm ${adapter.status === 'connected' ? 'hidden' : 'rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-amber-600 dark:text-amber-300'}`}>{t('qq_editor.offline')}</p>
        <AccountEditors key={adapter.id} adapter={adapter} onBusy={setBusy} /></>}
  </div>;
}
