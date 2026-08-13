import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Loader2, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type LogDownloadFormat = 'txt' | 'csv' | 'html';

interface LogActionButtonsProps {
  onDownload: (format: LogDownloadFormat) => void;
  onUpload: () => void;
  onDelete: () => void;
  downloadDisabled?: boolean;
  uploading?: boolean;
  deleting?: boolean;
}

/** Compact actions shared by group logs, log management and game sessions. */
export const LogActionButtons: React.FC<LogActionButtonsProps> = ({
  onDownload,
  onUpload,
  onDelete,
  downloadDisabled = false,
  uploading = false,
  deleting = false,
}) => {
  const { t } = useTranslation();
  const [downloadOpen, setDownloadOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const openDownload = () => {
    cancelClose();
    if (!downloadDisabled) setDownloadOpen(true);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setDownloadOpen(false), 140);
  };
  useEffect(() => () => cancelClose(), []);
  const formats: Array<{ value: LogDownloadFormat; label: string }> = [
    { value: 'txt', label: 'TXT' },
    { value: 'csv', label: 'Excel' },
    { value: 'html', label: t('logs.export_html') },
  ];

  return (
    <div className="flex flex-nowrap items-center justify-center gap-1 whitespace-nowrap">
      <DropdownMenu open={downloadOpen} onOpenChange={setDownloadOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={downloadDisabled}
            onPointerEnter={openDownload}
            onPointerLeave={scheduleClose}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            {t('common.download')}
            <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform ${downloadOpen ? 'rotate-180' : ''}`} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={4}
          className="min-w-32"
          onPointerEnter={cancelClose}
          onPointerLeave={scheduleClose}
        >
          {formats.map((format) => (
            <DropdownMenuItem
              key={format.value}
              className="text-xs"
              onSelect={() => onDownload(format.value)}
            >
              {format.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={uploading || downloadDisabled} onClick={onUpload}>
        {uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
        {t('common.upload')}
      </Button>
      <Button type="button" size="sm" variant="destructive" className="h-7 px-2 text-xs" disabled={deleting} onClick={onDelete}>
        {deleting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
        {t('common.delete')}
      </Button>
    </div>
  );
};
