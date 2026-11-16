import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, FolderOpen, ImageIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageResourceBrowser } from '@/components/image-resource-browser';
import { QQMaterials } from '@/components/adapter/qq-media-editor';
import { OfficialBotIdentity, OfficialBotOption, officialBotOptionLabel } from '@/components/adapter/official-bot-account';
import { zustandAdapterStore } from '@/store/adapter-store';

export function FilesPage() {
  const { t } = useTranslation();
  const { adapters, fetchAdapters } = zustandAdapterStore();
  const official = adapters.filter((adapter) => adapter.type === 'qq_official');
  const requested = new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab') || 'images';
  const [tab, setTab] = useState(requested === 'official' ? 'official' : 'images');
  const [adapterId, setAdapterId] = useState('');
  const [busy, setBusy] = useState(false);
  const adapter = official.find((item) => item.id === adapterId);
  useEffect(() => { void fetchAdapters(); }, [fetchAdapters]);
  useEffect(() => { if (!adapterId && official.length) setAdapterId(official[0].id); }, [official, adapterId]);
  return <div className="min-w-0 space-y-5">
    <PageHeader icon={FolderOpen} title={t('image_resources.title')} help={tab === 'official' ? t('image_resources.officialHostHint') : t('image_resources.help')} />
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList variant="page" aria-label={t('image_resources.title')}>
        <TabsTrigger value="images"><ImageIcon className="h-4 w-4" />{t('image_resources.images')}</TabsTrigger>
        <TabsTrigger value="official"><Cloud className="h-4 w-4" />{t('image_resources.officialHost')}</TabsTrigger>
      </TabsList>
      <TabsContent value="images" className="mt-4"><ImageResourceBrowser /></TabsContent>
      <TabsContent value="official" className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
          <span className="text-sm font-medium">{t('qq_editor.account')}</span>
          <Select value={adapter?.id ?? ''} disabled={busy || !official.length} onValueChange={setAdapterId}>
            <SelectTrigger className="w-full min-w-0 sm:w-80" aria-label={t('qq_editor.account')}>
              {adapter ? <OfficialBotOption adapter={adapter} /> : <SelectValue placeholder={t('qq_editor.account')} />}
            </SelectTrigger>
            <SelectContent>{official.map((account) => (
              <SelectItem key={account.id} value={account.id} textValue={officialBotOptionLabel(account)}>
                <OfficialBotOption adapter={account} />
              </SelectItem>
            ))}</SelectContent>
          </Select>
          {adapter && <OfficialBotIdentity adapter={adapter} />}
        </div>
        {!adapter
          ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t('image_resources.officialHostNoAccount')}</div>
          : <QQMaterials key={adapter.id} adapterId={adapter.id} onBusy={setBusy} />}
      </TabsContent>
    </Tabs>
  </div>;
}
