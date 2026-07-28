import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Archive, Database, Download, Loader2, Upload } from 'lucide-react';

export const BackupPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [legacyDir, setLegacyDir] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>('');
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreFileRef = useRef<HTMLInputElement>(null);

  const runImport = async () => {
    if (!legacyDir.trim()) return;
    setImporting(true); setImportResult('');
    try {
      const r = await fetch('/api/legacy/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir: legacyDir.trim() }) });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      const d = j.data;
      const importedFiles = (value: unknown) => typeof value === 'number'
        ? value
        : (value && typeof value === 'object' && 'success' in value
          ? Number((value as { success?: unknown }).success ?? 0)
          : 0);
      setImportResult(t('backup.legacy_result', { cards: d.cards, users: d.profiles, black: d.blacklist, replies: d.replies, help: d.help, msgs: d.msgs, masters: d.masters })
        + '\n' + t('backup.legacy_result2', { mods: importedFiles(d.mods), decks: importedFiles(d.decks), groups: d.chatGroups ?? 0, settings: d.chatSettings ?? 0 }));
      toast({ title: t('backup.legacy_done') });
    } catch (e) { setImportResult(''); toast({ title: t('backup.legacy_fail'), description: String(e), variant: 'destructive' }); }
    finally { setImporting(false); }
  };

  const downloadBackup = async () => {
    setBackingUp(true);
    try {
      const r = await fetch('/api/backup/export');
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const name = r.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/i)?.[1] ?? 'DiceNext-backup.tar.gz';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      toast({ title: t('backup.backup_downloaded') });
    } catch (e) {
      toast({ title: t('backup.backup_fail'), description: String(e), variant: 'destructive' });
    } finally { setBackingUp(false); }
  };

  const stageRestore = async (file?: File) => {
    if (!file) return;
    if (!window.confirm(t('backup.restore_confirm'))) return;
    setRestoring(true);
    try {
      const r = await fetch('/api/backup/restore', { method: 'POST', headers: { 'Content-Type': 'application/gzip' }, body: file });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      toast({ title: t('backup.restore_staged'), description: t('backup.restore_staged_desc') });
    } catch (e) {
      toast({ title: t('backup.backup_fail'), description: String(e), variant: 'destructive' });
    } finally {
      setRestoring(false);
      if (restoreFileRef.current) restoreFileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Archive className="h-5 w-5" />{t('backup.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('backup.subtitle')}</p>
      </div>

      {/* 导入旧版数据 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" />{t('backup.legacy_title')}</CardTitle>
          <CardDescription>{t('backup.legacy_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input placeholder="C:\…\DiceData" value={legacyDir} onChange={(e) => setLegacyDir(e.target.value)} />
            <Button onClick={runImport} disabled={importing || !legacyDir.trim()}>
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}{t('backup.legacy_import')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('backup.legacy_hint')}</p>
          {importResult && <p className="text-sm text-green-600 dark:text-green-400 whitespace-pre-wrap">{importResult}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Archive className="h-4 w-4" />{t('backup.backup_restore_title')}</CardTitle>
          <CardDescription>{t('backup.backup_restore_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={downloadBackup} disabled={backingUp}>
              {backingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{t('common.download')}
            </Button>
            <Button variant="outline" onClick={() => restoreFileRef.current?.click()} disabled={restoring}>
              {restoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{t('common.upload')}
            </Button>
            <input ref={restoreFileRef} className="hidden" type="file" accept=".tar.gz,application/gzip" onChange={(e) => void stageRestore(e.target.files?.[0])} />
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">{t('backup.restore_warning')}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupPage;
