import React from 'react';
import { ChevronDown, Download, Loader2, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

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
  const formats: Array<{ value: LogDownloadFormat; label: string }> = [
    { value: 'txt', label: 'TXT' },
    { value: 'csv', label: 'Excel' },
    { value: 'html', label: t('logs.export_html') },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 whitespace-nowrap">
      <div className="group relative">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={downloadDisabled}
          aria-haspopup="menu"
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          {t('common.download')}
          <ChevronDown className="ml-1 h-3.5 w-3.5 transition-transform group-hover:rotate-180 group-focus-within:rotate-180" />
        </Button>
        {!downloadDisabled && (
          <div className="invisible absolute right-0 top-full z-50 min-w-32 pt-1 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            <div className="rounded-md border bg-popover p-1 text-popover-foreground shadow-md" role="menu">
              {formats.map((format) => (
                <button
                  key={format.value}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  onClick={() => onDownload(format.value)}
                >
                  {format.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
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
