import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageResourceBrowser } from './image-resource-browser';
import type { ImageResource } from '@/lib/image-resources';

export function ImageResourcePicker({ directory = 'shared', onSelect, disabled, children, className, iconOnly = false }: {
  directory?: string; onSelect: (entry: ImageResource) => void; disabled?: boolean; children?: ReactNode;
  className?: string; iconOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" variant="outline" size={iconOnly ? 'icon' : 'sm'} className={className} aria-label={iconOnly ? t('image_resources.choose') : undefined} disabled={disabled} onClick={() => setOpen(true)}><ImageIcon className={iconOnly ? 'h-4 w-4' : 'mr-1 h-4 w-4'} />{!iconOnly && (children || t('image_resources.choose'))}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent layout="editor" className="max-w-6xl"><DialogHeader><DialogTitle>{t('image_resources.choose')}</DialogTitle></DialogHeader><DialogBody>{open && <ImageResourceBrowser initialDirectory={directory} onSelect={(entry) => { onSelect(entry); setOpen(false); }} />}</DialogBody></DialogContent></Dialog>
  </>;
}
