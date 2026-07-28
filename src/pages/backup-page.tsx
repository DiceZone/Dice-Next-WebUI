import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Archive, Clock3, Database, Download, Loader2, Save, Trash2, Upload } from 'lucide-react';

type StoredBackup = { name: string; size: number; createdAt: number; automatic: boolean };
type AutoBackupConfig = { enabled: boolean; schedule: 'interval' | 'daily'; intervalHours: number; dailyTime: string; keepCount: number; lastAutoAt: number };

const formatSize = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export const BackupPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [legacyDir, setLegacyDir] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>('');
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [archives, setArchives] = useState<StoredBackup[]>([]);
  const [autoConfig, setAutoConfig] = useState<AutoBackupConfig>({ enabled: false, schedule: 'interval', intervalHours: 24, dailyTime: '04:00', keepCount: 7, lastAutoAt: 0 });
  const [savingAuto, setSavingAuto] = useState(false);
  const restoreFileRef = useRef<HTMLInputElement>(null);

  const loadBackupState = useCallback(async () => {
    try {
      const [listRes, configRes] = await Promise.all([fetch('/api/backup/list'), fetch('/api/backup/config')]);
      const list = await listRes.json(); const config = await configRes.json();
      if (list.code === 0) setArchives(list.data ?? []);
      if (config.code === 0) setAutoConfig(config.data);
    } catch { /* 页面首次加载失败时保留可用的手动备份入口 */ }
  }, []);
  useEffect(() => { void loadBackupState(); }, [loadBackupState]);

  const saveBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    // Edge may start the file stream after click returns; immediate revoke can produce a corrupt archive.
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

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
      const name = r.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/i)?.[1] ?? 'DiceNext-backup.zip';
      saveBlob(blob, name);
      toast({ title: t('backup.backup_downloaded') });
      void loadBackupState();
    } catch (e) {
      toast({ title: t('backup.backup_fail'), description: String(e), variant: 'destructive' });
    } finally { setBackingUp(false); }
  };

  const downloadStored = async (name: string) => {
    try {
      const r = await fetch(`/api/backup/download?name=${encodeURIComponent(name)}`);
      if (!r.ok) throw new Error(await r.text());
      saveBlob(await r.blob(), name);
    } catch (e) { toast({ title: t('backup.backup_fail'), description: String(e), variant: 'destructive' }); }
  };

  const deleteStored = async (name: string) => {
    if (!window.confirm(`确定删除备份「${name}」吗？此操作无法撤销。`)) return;
    try {
      const r = await fetch(`/api/backup/${encodeURIComponent(name)}`, { method: 'DELETE' }); const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      await loadBackupState();
    } catch (e) { toast({ title: '删除备份失败', description: String(e), variant: 'destructive' }); }
  };

  const saveAutoConfig = async () => {
    setSavingAuto(true);
    try {
      const r = await fetch('/api/backup/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(autoConfig) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      toast({ title: '自动备份设置已保存' }); await loadBackupState();
    } catch (e) { toast({ title: '自动备份设置保存失败', description: String(e), variant: 'destructive' }); }
    finally { setSavingAuto(false); }
  };

  const stageRestore = async (file?: File) => {
    if (!file) return;
    if (!window.confirm(t('backup.restore_confirm'))) return;
    setRestoring(true);
    try {
      const r = await fetch('/api/backup/restore', { method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: file });
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
            <input ref={restoreFileRef} className="hidden" type="file" accept=".zip,application/zip" onChange={(e) => void stageRestore(e.target.files?.[0])} />
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">{t('backup.restore_warning')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock3 className="h-4 w-4" />自动备份</CardTitle>
          <CardDescription>自动备份始终保存完整配置和 data/ 数据；可按间隔或每日时刻执行，并自动仅保留最新指定数量。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoConfig.enabled} onChange={(e) => setAutoConfig({ ...autoConfig, enabled: e.target.checked })} />启用自动备份</label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">执行方式
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2" value={autoConfig.schedule} onChange={(e) => setAutoConfig({ ...autoConfig, schedule: e.target.value as 'interval' | 'daily' })}>
                <option value="interval">按间隔</option><option value="daily">每日定时</option>
              </select>
            </label>
            {autoConfig.schedule === 'interval' ? <label className="space-y-1 text-sm">间隔（小时，1–720）<Input type="number" min={1} max={720} value={autoConfig.intervalHours} onChange={(e) => setAutoConfig({ ...autoConfig, intervalHours: Number(e.target.value) })} /></label>
              : <label className="space-y-1 text-sm">每日执行时间<Input type="time" value={autoConfig.dailyTime} onChange={(e) => setAutoConfig({ ...autoConfig, dailyTime: e.target.value })} /></label>}
            <label className="space-y-1 text-sm">保留最新（1–100）<Input type="number" min={1} max={100} value={autoConfig.keepCount} onChange={(e) => setAutoConfig({ ...autoConfig, keepCount: Number(e.target.value) })} /></label>
          </div>
          <Button variant="outline" onClick={() => void saveAutoConfig()} disabled={savingAuto}>{savingAuto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}保存自动备份设置</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">已保存的备份</CardTitle><CardDescription>手动备份保存在程序目录的 backups/，自动备份保存在 data/backups/；均可随时重新下载或删除。</CardDescription></CardHeader>
        <CardContent className="p-0">
          {archives.length === 0 ? <p className="px-6 py-8 text-center text-sm text-muted-foreground">暂无已保存的备份。</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-y bg-muted/50 text-muted-foreground"><tr><th className="p-3 text-left">文件</th><th className="p-3 text-left">来源</th><th className="p-3 text-left">大小</th><th className="p-3 text-left">创建时间</th><th className="p-3 text-right">操作</th></tr></thead><tbody>{archives.map((item) => <tr key={item.name} className="border-b last:border-0"><td className="p-3 font-mono text-xs">{item.name}</td><td className="p-3">{item.automatic ? '自动' : '手动'}</td><td className="p-3">{formatSize(item.size)}</td><td className="p-3 whitespace-nowrap">{new Date(item.createdAt * 1000).toLocaleString()}</td><td className="p-3 text-right whitespace-nowrap"><Button size="sm" variant="ghost" onClick={() => void downloadStored(item.name)}><Download className="mr-1 h-4 w-4" />下载</Button><Button size="icon" variant="ghost" className="text-destructive" onClick={() => void deleteStored(item.name)}><Trash2 className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div>}
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupPage;
