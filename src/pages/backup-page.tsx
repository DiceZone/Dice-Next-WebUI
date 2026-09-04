import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimePicker } from '@/components/ui/date-time-picker';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { Archive, Clock3, Database, Download, Loader2, RotateCcw, Save, Trash2, Upload } from 'lucide-react';

type StoredBackup = { name: string; size: number; createdAt: number; automatic: boolean };
type BackupSelection = {
  config: boolean;
  coreDatabase: boolean;
  characterCards: boolean;
  chatHistory: boolean;
  gameLogs: boolean;
  runtimeLogs: boolean;
  auditLogs: boolean;
  decks: boolean;
  rules: boolean;
  help: boolean;
  cardTemplates: boolean;
  jsPlugins: boolean;
  luaMods: boolean;
  uploadedAssets: boolean;
  resourceImages: boolean;
  gameLogImages: boolean;
  chatMedia: boolean;
};
type AutoBackupConfig = { enabled: boolean; schedule: 'interval' | 'daily'; intervalHours: number; dailyTime: string; keepDays: number; selection: BackupSelection; lastAutoAt: number };
const autoSelectionDefaults: BackupSelection = {
  config: true,
  coreDatabase: true,
  characterCards: true,
  chatHistory: true,
  gameLogs: true,
  runtimeLogs: false,
  auditLogs: false,
  decks: true,
  rules: true,
  help: true,
  cardTemplates: true,
  jsPlugins: true,
  luaMods: true,
  uploadedAssets: false,
  resourceImages: false,
  gameLogImages: false,
  chatMedia: false,
};
const fullSelection: BackupSelection = {
  ...autoSelectionDefaults,
  runtimeLogs: true,
  auditLogs: true,
  uploadedAssets: true,
  resourceImages: true,
  gameLogImages: true,
  chatMedia: true,
};

const normalizeSelection = (value?: Partial<BackupSelection>): BackupSelection => ({
  ...autoSelectionDefaults,
  ...(value || {}),
});

const formatSize = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
type SelectionItem = { key: keyof BackupSelection; label: string; description: string; large?: boolean };
const selectionGroups: Array<{ title: string; items: SelectionItem[] }> = [
  { title: '配置与数据库', items: [
    { key: 'config', label: '系统配置', description: '适配器、系统设置与服务配置。' },
    { key: 'coreDatabase', label: '核心数据库', description: '群设置、用户资料、自定义回复等主要数据。' },
    { key: 'characterCards', label: '人物卡数据库', description: '独立保存的人物卡与属性数据。' },
    { key: 'chatHistory', label: '模拟聊天记录', description: '聊天消息、AI 摘要与记忆；不含聊天图片。' },
  ] },
  { title: '日志', items: [
    { key: 'gameLogs', label: '跑团日志', description: '跑团日志正文与已经导出的日志文件；不含图片。' },
    { key: 'runtimeLogs', label: '程序运行日志', description: '程序运行记录与崩溃诊断文件；默认不备份。' },
    { key: 'auditLogs', label: '通知审计日志', description: '通知窗口产生的结构化审计记录；默认不备份。' },
  ] },
  { title: '资源', items: [
    { key: 'decks', label: '牌堆', description: '已安装和自定义牌堆。' },
    { key: 'rules', label: '规则与规则包', description: '规则词条、规则包及其配置。' },
    { key: 'help', label: '帮助文档', description: '内置和自定义帮助内容。' },
    { key: 'cardTemplates', label: '人物卡模板', description: '人物卡模板文件。' },
    { key: 'jsPlugins', label: 'JavaScript 插件', description: 'JS 插件、插件数据库与持久化数据。' },
    { key: 'luaMods', label: 'Lua / 原版 Mod', description: 'Lua 插件、Mod、配置和 SelfData。' },
  ] },
  { title: '图片与媒体（可能显著增大备份）', items: [
    { key: 'uploadedAssets', label: '上传的回复图片', description: '在网页中上传、供回复或插件使用的图片。', large: true },
    { key: 'resourceImages', label: '资源图片', description: '帮助、规则等内容引用的 data/images 图片。', large: true },
    { key: 'gameLogImages', label: '跑团日志图片', description: '随跑团日志保存的本地图片；与日志正文独立。', large: true },
    { key: 'chatMedia', label: '模拟聊天媒体缓存', description: '模拟聊天中为防链接失效而缓存的图片。', large: true },
  ] },
];

const SelectionOptions: React.FC<{
  value: BackupSelection;
  onChange: (value: BackupSelection) => void;
}> = ({ value, onChange }) => (
  <div className="space-y-4">
    {selectionGroups.map((group) => (
      <div key={group.title} className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">{group.title}</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {group.items.map((item) => (
            <label key={item.key} className="flex cursor-pointer items-start gap-2 rounded border px-3 py-2.5 text-sm">
              <input className="mt-0.5" type="checkbox" checked={value[item.key]}
                onChange={(e) => onChange({ ...value, [item.key]: e.target.checked })} />
              <span className="min-w-0">
                <span className="font-medium">{item.label}</span>
                {item.large && <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400">占用空间</span>}
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export const BackupPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const dlg = useDialogs(t);
  const [legacyDir, setLegacyDir] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>('');
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [archives, setArchives] = useState<StoredBackup[]>([]);
  const [selection, setSelection] = useState<BackupSelection>(fullSelection);
  const [autoConfig, setAutoConfig] = useState<AutoBackupConfig>({ enabled: true, schedule: 'interval', intervalHours: 24, dailyTime: '04:00', keepDays: 7, selection: autoSelectionDefaults, lastAutoAt: 0 });
  const [savingAuto, setSavingAuto] = useState(false);
  const restoreFileRef = useRef<HTMLInputElement>(null);

  const loadBackupState = useCallback(async () => {
    try {
      const [listRes, configRes] = await Promise.all([fetch('/api/backup/list'), fetch('/api/backup/config')]);
      const list = await listRes.json(); const config = await configRes.json();
      if (list.code === 0) setArchives(list.data ?? []);
      if (config.code === 0) setAutoConfig({ ...config.data, selection: normalizeSelection(config.data?.selection) });
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
      setImportResult(t('backup.legacy_result', { cards: d.cards, users: d.profiles, black: d.blacklist, replies: d.replies, help: d.help, msgs: d.msgs, masters: d.masters, censor: d.censorWords ?? 0 })
        + '\n' + t('backup.legacy_result2', { mods: importedFiles(d.mods), decks: importedFiles(d.decks), groups: d.chatGroups ?? 0, settings: d.chatSettings ?? 0 }));
      toast({ title: t('backup.legacy_done') });
    } catch (e) { setImportResult(''); toast({ title: t('backup.legacy_fail'), description: String(e), variant: 'destructive' }); }
    finally { setImporting(false); }
  };

  const createStoredBackup = async () => {
    setBackingUp(true);
    try {
      const r = await fetch('/api/backup/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selection }) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      toast({ title: '备份已保存到服务器', description: j.data?.name }); await loadBackupState();
    } catch (e) {
      toast({ title: t('backup.backup_fail'), description: String(e), variant: 'destructive' });
    } finally { setBackingUp(false); }
  };

  const downloadStored = async (name: string, automatic: boolean) => {
    try {
      const r = await fetch(`/api/backup/download?name=${encodeURIComponent(name)}&automatic=${automatic ? '1' : '0'}`);
      if (!r.ok) throw new Error(await r.text());
      saveBlob(await r.blob(), name);
    } catch (e) { toast({ title: t('backup.backup_fail'), description: String(e), variant: 'destructive' }); }
  };

  const deleteStored = async (name: string, automatic: boolean) => {
    if (!(await dlg.confirm({ title: t('common.confirm_delete'), description: `确定删除备份「${name}」吗？此操作无法撤销。`, destructive: true, confirmText: t('common.delete') }))) return;
    try {
      const r = await fetch(`/api/backup/${encodeURIComponent(name)}?automatic=${automatic ? '1' : '0'}`, { method: 'DELETE' }); const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      await loadBackupState();
    } catch (e) { toast({ title: '删除备份失败', description: String(e), variant: 'destructive' }); }
  };

  const restoreStored = async (name: string, automatic: boolean) => {
    if (!(await dlg.confirm({ title: t('backup.backup_restore_title'), description: `确定使用服务器中的备份「${name}」恢复吗？当前数据会在重启时被替换，并保留回滚副本。`, confirmText: t('common.ok') }))) return;
    setRestoring(true);
    try {
      const r = await fetch('/api/backup/restore-stored', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, automatic }) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      toast({ title: '恢复已暂存', description: '请重启 Dice!Next 以安全应用该备份。' });
    } catch (e) { toast({ title: '恢复暂存失败', description: String(e), variant: 'destructive' }); }
    finally { setRestoring(false); }
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
    if (!(await dlg.confirm({ title: t('backup.backup_restore_title'), description: t('backup.restore_confirm'), confirmText: t('common.ok') }))) return;
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
      {dlg.node}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Archive className="h-5 w-5" />{t('backup.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('backup.subtitle')}</p>
      </div>

      {/* 导入旧版数据 */}
      <Card data-tour="backup-legacy">
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

      <Card data-tour="backup-manual">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Archive className="h-4 w-4" />{t('backup.backup_restore_title')}</CardTitle>
          <CardDescription>{t('backup.backup_restore_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={createStoredBackup} disabled={backingUp}>
              {backingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}立即备份到服务器
            </Button>
            <Button variant="outline" onClick={() => restoreFileRef.current?.click()} disabled={restoring}>
              {restoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{t('common.upload')}
            </Button>
            <input ref={restoreFileRef} className="hidden" type="file" accept=".zip,application/zip" onChange={(e) => void stageRestore(e.target.files?.[0])} />
          </div>
          <SelectionOptions value={selection} onChange={setSelection} />
          <p className="text-xs text-muted-foreground">立即备份默认包含全部项目。图片、媒体及运行日志可能显著增大备份，请按需取消；局部备份恢复时只覆盖已选择的内容。</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">{t('backup.restore_warning')}</p>
        </CardContent>
      </Card>

      <Card data-tour="backup-auto">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock3 className="h-4 w-4" />自动备份</CardTitle>
          <CardDescription>自动备份保存到 data/backups/；可按间隔或每日时刻执行，并按最近保留天数自动清理。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoConfig.enabled} onChange={(e) => setAutoConfig({ ...autoConfig, enabled: e.target.checked })} />启用自动备份</label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">执行方式
              <Select value={autoConfig.schedule} onValueChange={(value) => setAutoConfig({ ...autoConfig, schedule: value as 'interval' | 'daily' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="interval">按间隔</SelectItem><SelectItem value="daily">每日定时</SelectItem></SelectContent>
              </Select>
            </label>
            {autoConfig.schedule === 'interval' ? <label className="space-y-1 text-sm">间隔（小时，1–720）<Input type="number" min={1} max={720} value={autoConfig.intervalHours} onChange={(e) => setAutoConfig({ ...autoConfig, intervalHours: Number(e.target.value) })} /></label>
              : <label className="space-y-1 text-sm">每日执行时间<TimePicker label="每日执行时间" value={autoConfig.dailyTime} onValueChange={(value) => setAutoConfig({ ...autoConfig, dailyTime: value })} /></label>}
            <label className="space-y-1 text-sm">保留最近天数（1–3650）<Input type="number" min={1} max={3650} value={autoConfig.keepDays} onChange={(e) => setAutoConfig({ ...autoConfig, keepDays: Number(e.target.value) })} /></label>
          </div>
          <SelectionOptions value={autoConfig.selection}
            onChange={(next) => setAutoConfig({ ...autoConfig, selection: next })} />
          <p className="text-xs text-muted-foreground">自动备份默认采用精简组合，不包含运行/审计日志及图片、媒体，避免长期定时备份过快占满服务器。</p>
          <Button variant="outline" onClick={() => void saveAutoConfig()} disabled={savingAuto}>{savingAuto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}保存自动备份设置</Button>
        </CardContent>
      </Card>

      <Card data-tour="backup-archives">
        <CardHeader><CardTitle className="text-base">已保存的备份</CardTitle><CardDescription>手动备份保存在程序目录的 backups/，自动备份保存在 data/backups/；均可随时重新下载或删除。</CardDescription></CardHeader>
        <CardContent className="p-0">
          {archives.length === 0 ? <p className="px-6 py-8 text-center text-sm text-muted-foreground">暂无已保存的备份。</p> : <div className="overflow-x-auto"><table className="rt w-full text-sm"><thead className="border-y bg-muted/50 text-muted-foreground"><tr><th className="p-3 text-left">文件</th><th className="p-3 text-left">来源</th><th className="p-3 text-left">大小</th><th className="p-3 text-left">创建时间</th><th className="p-3 text-right">操作</th></tr></thead><tbody>{archives.map((item) => <tr key={`${item.automatic}-${item.name}`} className="border-b last:border-0"><td data-label="文件" className="p-3 font-mono text-xs break-all">{item.name}</td><td data-label="来源" className="p-3">{item.automatic ? '自动' : '手动'}</td><td data-label="大小" className="p-3">{formatSize(item.size)}</td><td data-label="创建时间" className="p-3 whitespace-nowrap">{new Date(item.createdAt * 1000).toLocaleString()}</td><td data-label="操作" className="p-3 text-right whitespace-nowrap"><Button size="sm" variant="ghost" disabled={restoring} onClick={() => void restoreStored(item.name, item.automatic)}><RotateCcw className="mr-1 h-4 w-4" />恢复</Button><Button size="sm" variant="ghost" onClick={() => void downloadStored(item.name, item.automatic)}><Download className="mr-1 h-4 w-4" />下载</Button><Button size="icon" variant="ghost" className="text-destructive" onClick={() => void deleteStored(item.name, item.automatic)}><Trash2 className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div>}
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupPage;
