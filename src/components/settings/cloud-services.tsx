import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, ContactRound, RefreshCw, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { PlatformIcon, platformLabel } from '@/components/platform-icon';
import { useToast } from '@/hooks/use-toast';
import { zustandAdapterStore } from '@/store/adapter-store';
import { cloudKeyPatch } from '@/lib/cloud-settings';
import type { Adapter } from '@/types/adapter';

const AdapterKeyRow: React.FC<{ adapter: Adapter }> = ({ adapter }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const updateAdapter = zustandAdapterStore((state) => state.updateAdapter);
  const [value, setValue] = useState('');
  const [clear, setClear] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const patch = cloudKeyPatch(value, clear);
    if (!patch) return;
    setSaving(true);
    try {
      await updateAdapter(adapter.id, patch);
      setValue(''); setClear(false);
      toast({ title: t('common.save_success') });
    } catch (error) {
      toast({ title: (error as Error).message, variant: 'destructive' });
    } finally { setSaving(false); }
  };
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`cloud-key-${adapter.id}`} className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <PlatformIcon platform={adapter.type} />{adapter.name}
        </label>
        <Badge variant={adapter.heartApiKeyConfigured ? 'secondary' : 'outline'}>
          {t(adapter.heartApiKeyConfigured ? 'cloud.key_configured' : 'cloud.key_missing')}
        </Badge>
      </div>
      <p className="break-all text-xs text-muted-foreground">
        {platformLabel(adapter.type)} · #{adapter.id} · {adapter.loginName || adapter.loginId || adapter.qqNumber || adapter.appId || '—'}
      </p>
      <Input id={`cloud-key-${adapter.id}`} type="password" autoComplete="new-password"
        value={value} disabled={saving || clear} onChange={(event) => setValue(event.target.value)}
        placeholder={adapter.heartApiKeyConfigured
          ? t('adapters.heart_api_key_set', { tail: adapter.heartApiKeyTail }) : t('adapters.heart_api_key_unset')} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {adapter.heartApiKeyConfigured ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={clear} disabled={saving} onCheckedChange={setClear} />{t('adapters.heart_api_key_clear')}
          </label>
        ) : <span />}
        <Button size="sm" disabled={saving || !cloudKeyPatch(value, clear)} onClick={() => void save()}>{t('common.save')}</Button>
      </div>
    </div>
  );
};

export const CloudKeysCard: React.FC = () => {
  const { t } = useTranslation();
  const { adapters, loading, error, fetchAdapters } = zustandAdapterStore();
  useEffect(() => { void fetchAdapters(); }, [fetchAdapters]);
  return (
    <Card data-setting-anchor="settings-cloud-keys">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" />{t('cloud.keys_title')}</CardTitle>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void fetchAdapters()}>
            <RefreshCw className={`mr-1 h-3 w-3 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
          </Button>
        </div>
        <CardDescription>{t('cloud.keys_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <a href="https://account.dice.zone/dashboard/bindings" target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          {t('adapters.heart_api_key_link')}<ExternalLink className="h-3 w-3" />
        </a>
        <p className="text-xs text-muted-foreground">{t('cloud.key_warning')}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {loading && adapters.length === 0 && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
        {!loading && !error && adapters.length === 0 && <p className="text-sm text-muted-foreground">{t('cloud.no_adapters')} <a className="text-primary hover:underline" href="#/adapters">{t('nav.adapters')}</a></p>}
        {adapters.map((adapter) => <AdapterKeyRow key={adapter.id} adapter={adapter} />)}
      </CardContent>
    </Card>
  );
};

export const CloudCardsCard: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Card data-setting-anchor="settings-cloud-cards">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><ContactRound className="h-4 w-4" />{t('cloud.cards_title')}</CardTitle>
        <CardDescription>{t('cloud.cards_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{t('cloud.cards_auth')}</p>
        <div className="space-y-2 rounded-md bg-muted/60 p-3">
          <p><code>.pc cloud auth read</code> — {t('cloud.cards_read')}</p>
          <p><code>.pc cloud auth write</code> — {t('cloud.cards_write')}</p>
          <p><code>.pc cloud confirm</code> — {t('cloud.cards_confirm')}</p>
          <p><code>.pc cloud</code> — {t('cloud.cards_help')}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t('cloud.cards_privacy')}</p>
      </CardContent>
    </Card>
  );
};
