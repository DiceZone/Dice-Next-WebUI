import { useTranslation } from 'react-i18next';
import { FolderOpen, ImageIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageResourceBrowser } from '@/components/image-resource-browser';

export function FilesPage() {
  const { t } = useTranslation();
  return <div className="min-w-0 space-y-5">
    <PageHeader icon={FolderOpen} title={t('image_resources.title')} help={t('image_resources.help')} />
    <Tabs value="images"><TabsList variant="page" aria-label={t('image_resources.title')}><TabsTrigger value="images"><ImageIcon className="h-4 w-4" />{t('image_resources.images')}</TabsTrigger></TabsList><TabsContent value="images" className="mt-4"><ImageResourceBrowser /></TabsContent></Tabs>
  </div>;
}
