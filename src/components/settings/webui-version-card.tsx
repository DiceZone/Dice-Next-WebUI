import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FeatureHelp } from '@/components/ui/feature-help';
import { useToast } from '@/hooks/use-toast';
import { useTourActive } from '@/components/onboarding/tour-data';
import { apiClient } from '@/lib/api-client';
import { validWebuiState, webuiTarget, type WebuiVersion, type WebuiVersionState } from '@/lib/webui-version';
import buildVersion from '@/webui-version.json';

export const WebuiVersionCard: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const tour = useTourActive();
  const [state, setState] = useState<WebuiVersionState | null>(null);
  const [selected, setSelected] = useState<WebuiVersion>('v1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const active = buildVersion.version;
  const load = async () => {
    setLoading(true); setError(false);
    try {
      const result = await apiClient.get<WebuiVersionState>('/system/webui-version');
      if (!validWebuiState(result.data)) throw new Error('Invalid WebUI version response');
      setState(result.data); setSelected(result.data.selected);
      const auth = await apiClient.get<{ role?: string }>('/auth/status');
      setReadOnly(auth.data.role === 'admin');
    } catch { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (!tour) void load(); }, [tour]);
  const save = async () => {
    if (tour || busy || readOnly || !state?.available[selected]) return;
    setBusy(true);
    try {
      const result = await apiClient.put<WebuiVersionState>('/system/webui-version', { version: selected });
      if (!validWebuiState(result.data) || result.data.selected !== selected) throw new Error(t('webui_versions.load_error'));
      window.location.assign(webuiTarget(selected, result.data.legacy, window.location));
    } catch (reason) {
      toast({ title: t('common.save_fail'), description: reason instanceof Error ? reason.message : undefined, variant: 'destructive' });
      setBusy(false);
    }
  };
  return <Card data-setting-anchor="webui-version">
    <CardHeader><CardTitle className="text-base flex items-center gap-2">
      {t('webui_versions.title')}
      <FeatureHelp title={t('webui_versions.title')} description={t('webui_versions.help')} />
    </CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('webui_versions.current', { version: t(`webui_versions.${active}`) })}</p>
      {loading && !tour && <p role="status">{t('webui_versions.loading')}</p>}
      {error && <div role="alert"><p>{t('webui_versions.load_error')}</p><Button variant="outline" onClick={() => void load()}>{t('common.retry')}</Button></div>}
      {state && state.selected !== state.effective && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{t('webui_versions.fallback')}</p>}
      <div role="group" aria-label={t('webui_versions.title')} className="grid gap-3 sm:grid-cols-2">
        {(['v1', 'v2'] as const).map((version) => <button key={version} type="button" aria-pressed={selected === version}
          disabled={!tour && (loading || error || busy || readOnly || !state?.available[version])}
          onClick={() => setSelected(version)}
          className={`rounded-lg border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${selected === version ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
          <span className="block text-sm font-medium">{t(`webui_versions.${version}`)}</span>
          <span className="mt-1 block text-sm text-muted-foreground">{t(`webui_versions.${version}_desc`)}</span>
          {state && !state.available[version] && <span className="mt-2 block text-xs">{t('webui_versions.unavailable')}</span>}
        </button>)}
      </div>
      {readOnly && <p className="text-sm text-muted-foreground">{t('webui_versions.read_only')}</p>}
      <Button onClick={() => void save()} disabled={loading || error || busy || readOnly || !state?.available[selected]}>
        {busy ? t('common.saving') : t('webui_versions.apply')}
      </Button>
    </CardContent>
  </Card>;
};
