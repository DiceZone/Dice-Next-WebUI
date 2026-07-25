import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Archive, Database, Loader2 } from 'lucide-react';

export const BackupPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [legacyDir, setLegacyDir] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>('');

  const runImport = async () => {
    if (!legacyDir.trim()) return;
    setImporting(true); setImportResult('');
    try {
      const r = await fetch('/api/legacy/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir: legacyDir.trim() }) });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      const d = j.data;
      setImportResult(t('backup.legacy_result', { cards: d.cards, users: d.profiles, black: d.blacklist, replies: d.replies, help: d.help, msgs: d.msgs, masters: d.masters })
        + '\n' + t('backup.legacy_result2', { mods: d.mods ?? 0, decks: d.decks ?? 0, groups: d.chatGroups ?? 0, settings: d.chatSettings ?? 0 }));
      toast({ title: t('backup.legacy_done') });
    } catch (e) { setImportResult(''); toast({ title: t('backup.legacy_fail'), description: String(e), variant: 'destructive' }); }
    finally { setImporting(false); }
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

      {/* 备份 / 恢复（尚未实现） */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-muted-foreground"><Archive className="h-4 w-4" />{t('backup.backup_restore_title')}</CardTitle>
          <CardDescription>{t('backup.backup_restore_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{t('backup.not_implemented')}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupPage;
