import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Download, Info, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { useDialogs } from '@/hooks/use-dialogs';

type UpdateAction = 'notify' | 'download' | 'install';
type UpdateSource = 'auto' | 'direct' | 'mirror' | 'custom';

interface UpdateSettings {
  autoCheck: boolean;
  intervalHours: number;
  autoAction: UpdateAction;
  source: UpdateSource;
  customMirror: string;
}

interface UpdateStatus {
  current: { version: string; build: number; tag: string };
  platform: { os: string; arch: string };
  latest: null | {
    tag: string;
    version: string;
    build: number;
    prerelease: boolean;
    publishedAt: string;
    releaseUrl: string;
    asset?: { name: string; size: number; sha256: string };
  };
  updateAvailable: boolean;
  phase: string;
  error: string;
  source: string;
  downloadedBytes: number;
  totalBytes: number;
  checkedAt: number;
  installSupported: boolean;
  pending: boolean;
  settings: UpdateSettings;
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return value.toFixed(index === 0 ? 0 : 1) + ' ' + units[index];
};

export const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const dialogs = useDialogs(t);
  const [version, setVersion] = useState('...');
  const [buildNumber, setBuildNumber] = useState('');
  const [buildTime, setBuildTime] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updateDraft, setUpdateDraft] = useState<UpdateSettings | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [working, setWorking] = useState('');
  const [updateError, setUpdateError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/system/status')
      .then((r) => r.json())
      .then((d) => {
        if (d.code === 0) {
          setVersion(d.data.version);
          setBuildNumber(d.data.buildNumber || 0);
          setBuildTime(d.data.buildTime || '');
        }
      })
      .catch(() => setVersion(t('about.unknown') || 'Unknown'));
  }, [t]);

  const loadUpdateStatus = useCallback(async () => {
    try {
      const response = await apiClient.get<UpdateStatus>('/system/update');
      setUpdateStatus(response.data);
      setUpdateDraft((current) => (settingsDirty && current ? current : response.data.settings));
      setUpdateError('');
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : String(error));
    }
  }, [settingsDirty]);

  useEffect(() => {
    void loadUpdateStatus();
    const timer = window.setInterval(() => void loadUpdateStatus(), 3000);
    return () => window.clearInterval(timer);
  }, [loadUpdateStatus]);

  const runAction = async (action: 'check' | 'download') => {
    setWorking(action);
    setUpdateError('');
    setSaved(false);
    try {
      const response = await apiClient.post<UpdateStatus>('/system/update/' + action);
      setUpdateStatus(response.data);
      setUpdateDraft((current) => (settingsDirty && current ? current : response.data.settings));
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking('');
    }
  };

  const installUpdate = async () => {
    const confirmed = await dialogs.confirm({
      title: t('about.update_install_confirm_title'),
      description: t('about.update_install_confirm_desc'),
      confirmText: t('about.update_install'),
      destructive: true,
    });
    if (!confirmed) return;

    setWorking('install');
    setUpdateError('');
    setSaved(false);
    try {
      const response = await apiClient.post<UpdateStatus>('/system/update/install');
      setUpdateStatus(response.data);
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking('');
    }
  };

  const saveUpdateSettings = async () => {
    if (!updateDraft) return;
    setWorking('save');
    setUpdateError('');
    setSaved(false);
    try {
      const response = await apiClient.put<UpdateStatus>('/system/update', updateDraft);
      setUpdateStatus(response.data);
      setUpdateDraft(response.data.settings);
      setSettingsDirty(false);
      setSaved(true);
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking('');
    }
  };

  const updateSetting = <K extends keyof UpdateSettings>(key: K, value: UpdateSettings[K]) => {
    setUpdateDraft((current) => (current ? { ...current, [key]: value } : current));
    setSettingsDirty(true);
    setSaved(false);
  };

  const phase = updateStatus?.phase ?? 'idle';
  const updateBusy = ['checking', 'downloading', 'installing'].includes(phase);
  const phaseVariant = phase === 'error'
    ? 'danger'
    : phase === 'up_to_date'
      ? 'success'
      : updateBusy
        ? 'info'
        : updateStatus?.updateAvailable
          ? 'warning'
          : 'neutral';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Info className="h-5 w-5" />{t('about.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('about.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('about.intro_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p dangerouslySetInnerHTML={{ __html: t('about.intro_text') }} />
          <p>{t('about.license')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('about.version_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{t('about.current_version')}</span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">{t('about.preview_label')}</span>
              <span className="font-mono font-medium">v{version}({buildNumber || '?'})</span>
            </div>
          </div>
          {buildTime && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('about.build_time')}</span>
              <span className="font-mono text-xs">{buildTime}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('about.backend_framework')}</span>
            <span>Drogon (C++20)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('about.frontend_framework')}</span>
            <span>React + TypeScript</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('about.update_title')}
            </CardTitle>
            <Badge variant={phaseVariant}>
              {t('about.phase_' + phase, { defaultValue: phase })}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t('about.update_desc')}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('about.current_version')}</span>
              <span className="font-mono">{updateStatus?.current.tag ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('about.latest_version')}</span>
              <span className="font-mono">
                {updateStatus?.latest?.tag ?? t('about.update_not_checked')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('about.update_platform')}</span>
              <span className="font-mono">
                {updateStatus ? updateStatus.platform.os + '/' + updateStatus.platform.arch : '—'}
              </span>
            </div>
            {updateStatus?.source && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t('about.update_source_used')}</span>
                <span className="font-mono text-xs break-all text-right">{updateStatus.source}</span>
              </div>
            )}
            {!!updateStatus?.checkedAt && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t('about.update_checked_at')}</span>
                <span>{new Date(updateStatus.checkedAt * 1000).toLocaleString()}</span>
              </div>
            )}
            {updateStatus?.latest?.asset && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t('about.update_asset')}</span>
                  <span className="font-mono text-xs text-right">
                    {updateStatus.latest.asset.name} ({formatBytes(updateStatus.latest.asset.size)})
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t('about.update_integrity')}</span>
                  <span className="font-mono text-xs">{updateStatus.latest.asset.sha256.slice(0, 12)}…</span>
                </div>
              </>
            )}
            {phase === 'downloading' && updateStatus && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('about.phase_downloading')}</span>
                  <span>{formatBytes(updateStatus.downloadedBytes)} / {formatBytes(updateStatus.totalBytes)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: Math.min(100, updateStatus.totalBytes > 0
                        ? (updateStatus.downloadedBytes / updateStatus.totalBytes) * 100
                        : 0) + '%',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {(updateError || updateStatus?.error) && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive break-words">
              {t('about.update_error')}: {updateError || updateStatus?.error}
            </div>
          )}

          {updateStatus && !updateStatus.installSupported && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              {t('about.update_manual_hint')}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void runAction('check')}
              disabled={updateBusy || !!working}
            >
              <RefreshCw className={'mr-2 h-4 w-4 ' + (phase === 'checking' ? 'animate-spin' : '')} />
              {t('about.update_check')}
            </Button>
            <Button
              variant="outline"
              onClick={() => void runAction('download')}
              disabled={!updateStatus?.updateAvailable || !updateStatus.latest?.asset || updateBusy || !!working}
            >
              <Download className="mr-2 h-4 w-4" />
              {t('about.update_download')}
            </Button>
            <Button
              onClick={() => void installUpdate()}
              disabled={!updateStatus?.installSupported || !updateStatus.pending || updateBusy || !!working}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {t('about.update_install')}
            </Button>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">{t('about.update_settings')}</h3>
              <p className="text-xs text-muted-foreground">{t('about.update_settings_desc')}</p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="update-auto-check">{t('about.update_auto_check')}</Label>
                <p className="text-xs text-muted-foreground">{t('about.update_auto_check_desc')}</p>
              </div>
              <Switch
                id="update-auto-check"
                checked={updateDraft?.autoCheck ?? false}
                disabled={!updateDraft}
                onCheckedChange={(checked) => updateSetting('autoCheck', checked)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('about.update_interval')}</Label>
                <Select
                  value={String(updateDraft?.intervalHours ?? 6)}
                  disabled={!updateDraft || !updateDraft.autoCheck}
                  onValueChange={(value) => updateSetting('intervalHours', Number(value))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 3, 6, 12, 24, 48, 72, 168].map((hours) => (
                      <SelectItem key={hours} value={String(hours)}>
                        {t('about.update_hours', { count: hours })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('about.update_auto_action')}</Label>
                <Select
                  value={updateDraft?.autoAction ?? 'notify'}
                  disabled={!updateDraft || !updateDraft.autoCheck}
                  onValueChange={(value) => updateSetting('autoAction', value as UpdateAction)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notify">{t('about.action_notify')}</SelectItem>
                    <SelectItem value="download">{t('about.action_download')}</SelectItem>
                    <SelectItem value="install" disabled={!updateStatus?.installSupported}>
                      {t('about.action_install')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>{t('about.update_source')}</Label>
                <Select
                  value={updateDraft?.source ?? 'auto'}
                  disabled={!updateDraft}
                  onValueChange={(value) => updateSetting('source', value as UpdateSource)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t('about.source_auto')}</SelectItem>
                    <SelectItem value="direct">{t('about.source_direct')}</SelectItem>
                    <SelectItem value="mirror">{t('about.source_mirror')}</SelectItem>
                    <SelectItem value="custom">{t('about.source_custom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {updateDraft?.source === 'custom' && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="update-custom-mirror">{t('about.update_custom_mirror')}</Label>
                  <Input
                    id="update-custom-mirror"
                    value={updateDraft.customMirror}
                    placeholder={t('about.custom_mirror_placeholder')}
                    onChange={(event) => updateSetting('customMirror', event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t('about.custom_mirror_desc')}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => void saveUpdateSettings()}
                disabled={!settingsDirty || !!working || !updateDraft}
              >
                <Save className="mr-2 h-4 w-4" />
                {t('about.update_save')}
              </Button>
              {saved && <span className="text-sm text-green-600 dark:text-green-400">{t('about.update_saved')}</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('about.stack_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><strong className="text-foreground">{t('about.stack_backend')}</strong>：{t('about.stack_backend_text')}</p>
          <p><strong className="text-foreground">{t('about.stack_frontend')}</strong>：{t('about.stack_frontend_text')}</p>
          <p><strong className="text-foreground">{t('about.stack_adapter')}</strong>：{t('about.stack_adapter_text')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('about.changelog_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">{t('about.v3_title')}</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {(t('about.v3_items', { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
          <Separator />
          <div>
            <p className="font-medium text-foreground">{t('about.v2_title')}</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {(t('about.v2_items', { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('about.thanks_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><a href="https://github.com/Dice-Developer-Team/Dice" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Dice!</a></p>
          <p><a href="https://github.com/sealdice/sealdice-core" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">SealDice</a></p>
          <p><a href="https://github.com/OlivOS-Team/OlivOS" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OlivOS</a></p>
          <p><a href="https://github.com/NapNeko/NapCatQQ" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">NapCat</a></p>
          <p><a href="https://www.llonebot.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">LLOneBot</a></p>
          <p><a href="https://snowluma.github.io/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">SnowLuma</a></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('about.testers_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TESTERS.map((p) => (
              <div key={p.qq} className="flex items-center gap-2.5">
                <img
                  src={`https://q1.qlogo.cn/g?b=qq&nk=${p.qq}&s=100`}
                  alt={p.name}
                  loading="lazy"
                  className="h-9 w-9 rounded-full bg-muted object-cover shrink-0"
                />
                <span className="text-sm font-medium truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {dialogs.node}
    </div>
  );
};

// Beta testers — nickname shown, QQ used to load the avatar.
const TESTERS: { name: string; qq: string }[] = [
  { name: '剪影', qq: '25373790' },
  { name: '平衡', qq: '869154801' },
  { name: '云嗣', qq: '2984360687' },
  { name: '贰狐', qq: '1735450' },
  { name: '条辣困', qq: '2404823271' },
  { name: '叶川', qq: '3190096508' },
  { name: '韶华', qq: '2130369737' },
  { name: '细雪', qq: '2431692084' },
  { name: '察生', qq: '2294044530' },
  { name: '霜桦', qq: '404507568' },
];

export default AboutPage;
