import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Cloud, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

async function jsend(method: 'GET' | 'PUT' | 'POST', path: string, body?: unknown) {
  const response = method === 'GET' ? await apiClient.get<any>(path)
    : method === 'PUT' ? await apiClient.put<any>(path, body)
    : await apiClient.post<any>(path, body);
  return response.data;
}
const fmtTs = (iso?: string) => iso ? iso.replace('T', ' ').slice(0, 19) : '';

// ── 云黑名单：云端共享黑名单同步配置 ─────────────────────────────
interface CloudBanConf {
  enabled: boolean; url: string; token_set: boolean; token_tail: string;
  share: boolean; min_danger: number; sync_interval: number; cursor: string;
  last_sync_at: string; last_sync_added: number; last_sync_removed: number; last_error: string;
}

export const CloudBanCard: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [c, setC] = useState<CloudBanConf>({
    enabled: false, url: '', token_set: false, token_tail: '', share: false,
    min_danger: 2, sync_interval: 21600, cursor: '',
    last_sync_at: '', last_sync_added: 0, last_sync_removed: 0, last_error: '',
  });
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await jsend('GET', '/system/cloudban') as Partial<CloudBanConf>;
      setC((prev) => ({ ...prev, ...d }));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await jsend('PUT', '/system/cloudban', {
        enabled: c.enabled, url: c.url.trim(), token,   // token 留空 = 不修改
        share: c.share, min_danger: c.min_danger, sync_interval: c.sync_interval,
      });
      setToken(''); await load();
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const d = await jsend('POST', '/system/cloudban/sync');
      toast({ title: t('banlist.cloudban_sync_done'), description: t('banlist.cloudban_sync_result', { added: d?.added ?? 0, removed: d?.removed ?? 0 }) });
      await load();
    } catch (e) { toast({ title: t('banlist.cloudban_sync_fail'), description: (e as Error).message, variant: 'destructive' }); }
    finally { setSyncing(false); }
  };

  return (
    <Card data-setting-anchor="settings-cloudban">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Cloud className="h-4 w-4" />{t('banlist.cloudban_title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {t('banlist.cloudban_desc')}
        </p>
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t('banlist.cloudban_enable')}</Label>
          <Switch checked={c.enabled} onCheckedChange={(v) => setC({ ...c, enabled: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('banlist.cloudban_url')}</Label>
          <Input className="h-8 font-mono text-xs" value={c.url}
            onChange={(e) => setC({ ...c, url: e.target.value })} placeholder="https://cloudban.dice.zone" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Access Token</Label>
          <Input className="h-8 text-sm" type="password" value={token} onChange={(e) => setToken(e.target.value)}
            placeholder={c.token_set ? t('banlist.cloudban_token_set_ph', { tail: c.token_tail }) : t('banlist.cloudban_token_unset_ph')} />
          <p className="text-[11px] text-muted-foreground">{t('banlist.cloudban_token_hint')}</p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm">{t('banlist.cloudban_share')}</Label>
            <p className="text-xs text-muted-foreground">{t('banlist.cloudban_share_desc')}</p>
          </div>
          <Switch checked={c.share} onCheckedChange={(v) => setC({ ...c, share: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('banlist.cloudban_min_danger')}</Label>
          <Select value={String(c.min_danger)} onValueChange={(v) => setC({ ...c, min_danger: Number(v) })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{t('banlist.cloudban_danger1')}</SelectItem>
              <SelectItem value="2">{t('banlist.cloudban_danger2')}</SelectItem>
              <SelectItem value="3">{t('banlist.cloudban_danger3')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('banlist.cloudban_interval')}</Label>
          <Select value={String(c.sync_interval)} onValueChange={(v) => setC({ ...c, sync_interval: Number(v) })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3600">{t('banlist.cloudban_iv_1h')}</SelectItem>
              <SelectItem value="21600">{t('banlist.cloudban_iv_6h')}</SelectItem>
              <SelectItem value="43200">{t('banlist.cloudban_iv_12h')}</SelectItem>
              <SelectItem value="86400">{t('banlist.cloudban_iv_24h')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{t('banlist.cloudban_last')}</span>
          {c.last_sync_at ? (
            <>
              <span className="text-muted-foreground">{fmtTs(c.last_sync_at)}</span>
              <Badge variant="outline" className="text-[10px]">{t('banlist.cloudban_added', { n: c.last_sync_added ?? 0 })}</Badge>
              <Badge variant="outline" className="text-[10px]">{t('banlist.cloudban_removed', { n: c.last_sync_removed ?? 0 })}</Badge>
            </>
          ) : (
            <Badge variant="outline">{t('banlist.cloudban_never')}</Badge>
          )}
          {c.last_error && <span className="text-destructive truncate max-w-[280px]" title={c.last_error}>{c.last_error}</span>}
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={syncNow} disabled={syncing}>
            <RefreshCw className={`mr-1 h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />{syncing ? t('banlist.cloudban_syncing') : t('banlist.cloudban_sync_now')}
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>{t('common.save')}</Button>
        </div>
      </CardContent>
    </Card>
  );
};

