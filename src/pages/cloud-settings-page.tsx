import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, HeartPulse, ScrollText } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CloudKeysCard, CloudCardsCard } from '@/components/settings/cloud-services';
import { CloudBanCard } from '@/components/settings/cloud-ban-card';
import { zustandAdapterStore } from '@/store/adapter-store';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';

async function getJson(path: string) { return (await apiClient.get<any>(path)).data; }
async function putJson(path: string, body: unknown) { return (await apiClient.put<any>(path, body)).data; }

const formatDateTimeAtOffset = (value: string, offsetMinutes: number) => {
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return value;
  const date = new Date(epoch + offsetMinutes * 60_000);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} `
    + `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
};

export const CloudSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [timezoneMinutes, setTimezoneMinutes] = useState(0);
  useEffect(() => {
    void getJson('/system/timezone').then((data) => {
      setTimezoneMinutes(Number(data?.effective_offset_minutes ?? data?.offset_minutes ?? 0));
    }).catch(() => { /* Keep UTC if server timezone is unavailable. */ });
  }, []);
  return (
    <div className="max-w-3xl space-y-6">
      <div data-setting-anchor="settings-cloud">
        <PageHeader icon={Cloud} title={t('cloud.title')} description={t('cloud.desc')} />
      </div>
      <CloudKeysCard />
      <CloudCardsCard />
      <CloudBanCard />
      <HeartbeatCard timezoneMinutes={timezoneMinutes} />
      <LogsiteCard />
    </div>
  );
};

const LogsiteCard: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  // — 日志站（API 地址可自建 + 上传协议）—
  const [logsiteUrl, setLogsiteUrl] = useState('');
  const [logsiteFormat, setLogsiteFormat] = useState('dicenext');
  const [logsiteOfficial, setLogsiteOfficial] = useState('');
  const [savingLogsite, setSavingLogsite] = useState(false);
  const loadLogsite = async () => {
    try {
      const r = await fetch('/api/system/logsite'); const j = await r.json();
      if (j.code === 0) { setLogsiteUrl(j.data.url || ''); setLogsiteFormat(j.data.format || 'dicenext'); setLogsiteOfficial(j.data.official || ''); }
    } catch { /* ignore */ }
  };
  useEffect(() => { void loadLogsite(); }, []);
  const saveLogsite = async () => {
    setSavingLogsite(true);
    try {
      const r = await fetch('/api/system/logsite', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: logsiteUrl.trim(), format: logsiteFormat }) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      setLogsiteUrl(j.data.url || ''); setLogsiteFormat(j.data.format || 'dicenext');
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSavingLogsite(false); }
  };
  return (
      <Card data-setting-anchor="settings-logsite">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ScrollText className="h-4 w-4" />{t('settings.logsite_title')}</CardTitle>
          <CardDescription>{t('settings.logsite_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.logsite_url')}</Label>
            <Input value={logsiteUrl} onChange={(e) => setLogsiteUrl(e.target.value)} placeholder={logsiteOfficial} className="font-mono text-xs" />
            {logsiteUrl.trim() !== '' && logsiteOfficial !== '' && logsiteUrl.trim() !== logsiteOfficial && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{t('settings.logsite_unofficial')}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('settings.logsite_format')}</Label>
            <Select value={logsiteFormat} onValueChange={setLogsiteFormat}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="seal">{t('settings.logsite_format_seal')}</SelectItem>
                <SelectItem value="dicenext">{t('settings.logsite_format_dicenext')}</SelectItem>
                <SelectItem value="seal_v105">{t('settings.logsite_format_seal_v105')}</SelectItem>
                <SelectItem value="legacy">{t('settings.logsite_format_legacy')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={saveLogsite} disabled={savingLogsite}>{t('common.save')}</Button>
            <Button size="sm" variant="outline" onClick={() => { setLogsiteUrl(logsiteOfficial); setLogsiteFormat('dicenext'); }}>{t('settings.logsite_reset')}</Button>
          </div>
        </CardContent>
      </Card>
  );
};

// ── 心跳上报（向 heart.dice.zone 上报骰娘在线状态）────────────────
interface HeartbeatConf {
  enabled: boolean; url: string; configured_adapters: number;
  public_show: boolean; interval: number;
  master_qq: string; master_nickname: string;
  effective_master_qq: string; effective_master_nickname: string; master_source: string;
  last_status: string; last_report_at: string; last_error: string;
}

const HeartbeatCard: React.FC<{ timezoneMinutes: number }> = ({ timezoneMinutes }) => {
  const configuredAdapters = zustandAdapterStore((state) => state.adapters.filter((adapter) => adapter.heartApiKeyConfigured).length);
  const { t } = useTranslation();
  const toast = useToast();
  const [c, setC] = useState<HeartbeatConf>({
    enabled: false, url: 'https://heart.dice.zone', configured_adapters: 0,
    public_show: true, interval: 300,
    master_qq: '', master_nickname: '', effective_master_qq: '', effective_master_nickname: '', master_source: 'none',
    last_status: '', last_report_at: '', last_error: '',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getJson('/system/heartbeat') as Partial<HeartbeatConf>;
      setC((prev) => ({ ...prev, ...d, url: d.url || 'https://heart.dice.zone' }));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const interval = Math.min(480, Math.max(180, Number(c.interval) || 300));
      await putJson('/system/heartbeat', {
        enabled: c.enabled, url: c.url.trim(),
        public_show: c.public_show, interval,
        master_qq: c.master_qq.trim(), master_nickname: c.master_nickname.trim(),
      });
      await load();
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await fetch('/api/system/heartbeat/test', { method: 'POST' });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      const d = j.data || {};
      let payload: { results?: Array<{ adapter_name?: string; http?: number; body?: string }> } = {};
      try {
        payload = typeof d.body === 'string' ? JSON.parse(d.body) : (d.body || d);
      } catch {
        payload = {};
      }
      const results = Array.isArray(payload.results) ? payload.results : [];
      const rateLimited = results.filter((item) => {
        try {
          const body = typeof item.body === 'string' ? JSON.parse(item.body) : item.body;
          return body?.status === 'rate_limited';
        } catch {
          return false;
        }
      }).length;
      const failed = results.filter((item) => item.http !== 200);
      if (failed.length > 0) {
        const first = failed[0];
        throw new Error(`${first.adapter_name || t('nav.adapters')}: HTTP ${first.http ?? '?'}`);
      }
      toast({
        title: t('settings.heartbeat_test_success'),
        description: rateLimited > 0
          ? t('settings.heartbeat_test_rate_limited', { count: rateLimited, total: results.length })
          : t('settings.heartbeat_test_success_desc', { count: results.length }),
      });
      void load();
    } catch (e) { toast({ title: t('settings.heartbeat_test_fail'), description: (e as Error).message, variant: 'destructive' }); }
    finally { setTesting(false); }
  };

  const statusBadge = () => {
    // 后端取值：''/unknown=从未上报、online=在线、offline=离线；其余视为错误
    const s = c.last_status || '';
    if (!s || s === 'unknown') return <Badge variant="outline">{t('settings.heartbeat_never')}</Badge>;
    if (s === 'online') return <Badge variant="outline" className="border-green-600 text-green-600 dark:border-green-400 dark:text-green-400">{t('settings.heartbeat_online')}</Badge>;
    if (s === 'offline') return <Badge variant="outline">{t('settings.heartbeat_offline')}</Badge>;
    return <Badge variant="destructive">{s}</Badge>;
  };

  return (
    <Card data-setting-anchor="settings-heartbeat">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><HeartPulse className="h-4 w-4" />{t('settings.heartbeat_title')}</CardTitle>
        <CardDescription>{t('settings.heartbeat_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t('settings.heartbeat_enable')}</Label>
          <Switch checked={c.enabled} onCheckedChange={(v) => setC({ ...c, enabled: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('settings.heartbeat_url')}</Label>
          <Input className="h-8 font-mono text-xs" value={c.url}
            onChange={(e) => setC({ ...c, url: e.target.value })} placeholder="https://heart.dice.zone" />
        </div>
        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
          <div>
            <Label className="text-sm">{t('settings.heartbeat_master_title')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.heartbeat_master_desc')}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('settings.heartbeat_master_nickname')}</Label>
              <Input className="h-8 text-sm" value={c.master_nickname} maxLength={128}
                onChange={(e) => setC({ ...c, master_nickname: e.target.value })}
                placeholder={t('settings.heartbeat_master_nickname_placeholder')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('settings.heartbeat_master_qq')}</Label>
              <Input className="h-8 font-mono text-sm" value={c.master_qq} inputMode="numeric" maxLength={20}
                onChange={(e) => setC({ ...c, master_qq: e.target.value.replace(/\D/g, '').slice(0, 20) })}
                placeholder={t('settings.heartbeat_master_qq_placeholder')} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{c.master_source === 'none'
            ? t('settings.heartbeat_master_effective_none')
            : t('settings.heartbeat_master_effective', {
                source: t(c.master_source === 'manual' ? 'settings.heartbeat_master_source_manual' : 'settings.heartbeat_master_source_auto'),
                nickname: c.effective_master_nickname || '—', qq: c.effective_master_qq || '—',
              })}</p>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/20 p-3">
          <div>
            <Label className="text-sm">{t('settings.heartbeat_adapter_keys')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.heartbeat_adapter_keys_desc')}</p>
          </div>
          <a href="#/cloud-services?focus=settings-cloud-keys" className="shrink-0 text-sm text-primary underline-offset-4 hover:underline">
            {t('settings.heartbeat_adapter_keys_count', { count: configuredAdapters })}
          </a>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm">{t('settings.heartbeat_public')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.heartbeat_public_desc')}</p>
          </div>
          <Switch checked={c.public_show} onCheckedChange={(v) => setC({ ...c, public_show: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('settings.heartbeat_interval')}</Label>
          <Input className="h-8 w-32 text-sm" type="number" min={180} max={480} value={c.interval}
            onChange={(e) => setC({ ...c, interval: Number(e.target.value) || 0 })} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{t('settings.heartbeat_last')}</span>
          {statusBadge()}
          {c.last_report_at && <span className="text-muted-foreground">{formatDateTimeAtOffset(c.last_report_at, timezoneMinutes)}</span>}
          {c.last_error && <span className="text-destructive truncate max-w-[280px]" title={c.last_error}>{c.last_error}</span>}
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={test} disabled={testing}>{testing ? t('settings.heartbeat_testing') : t('settings.heartbeat_test_now')}</Button>
          <Button size="sm" onClick={save} disabled={saving}>{t('common.save')}</Button>
        </div>
      </CardContent>
    </Card>
  );
};
