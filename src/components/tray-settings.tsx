import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTourActive, useTourState } from '@/components/onboarding/tour-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FeatureHelp } from '@/components/ui/feature-help';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequestGate } from '@/hooks/use-request-gate';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { readTraySettings, trayTextError, trayTextLength, trayTooltip, TRAY_TEXT_LIMIT, type TraySettings } from '@/lib/tray-settings';

const sample: TraySettings = { text: '', port: 18088, tooltip: 'Dice!Next(18088)', supported: true };

export function TraySettingsCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const tour = useTourActive();
  const gate = useRequestGate(String(tour));
  const [settings, setSettings] = useTourState<TraySettings | null>(null, sample);
  const [text, setText] = useTourState('', '');
  const [loading, setLoading] = useTourState(true, false);
  const [saving, setSaving] = useTourState(false, false);
  const [loadError, setLoadError] = useTourState('', '');
  const saveLock = useRef(false);
  const tourRef = useRef(tour);
  tourRef.current = tour;
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (tourRef.current || saveLock.current) return;
    const current = gate.start();
    setLoading(true); setLoadError('');
    try {
      const result = await apiClient.get<unknown>('/system/tray', { timeoutMs: 10000 });
      const next = readTraySettings(result.data);
      if (!current()) return;
      setSettings(next); setText(next.text);
    } catch (error) {
      if (current()) { setSettings(null); setLoadError(String(error)); }
    } finally { if (current()) setLoading(false); }
  }, [tour, gate, setLoading, setLoadError, setSettings, setText]);
  useEffect(() => { void load(); }, [load]);

  const error = trayTextError(text);
  const save = async () => {
    if (tour || loading || saveLock.current || !settings?.supported || error) return;
    const current = gate.capture();
    saveLock.current = true; setSaving(true);
    try {
      const result = await apiClient.put<unknown>('/system/tray', { text: text.trim() }, { timeoutMs: 10000 });
      const next = readTraySettings(result.data);
      if (!current()) return;
      setSettings(next); setText(next.text);
      toast({ title: t('common.save_success') });
    } catch (cause) {
      if (current()) toast({ title: t('common.save_fail'), description: String(cause), variant: 'destructive' });
    } finally {
      saveLock.current = false;
      // The captured live setter can release the hidden draft even while a tour is displayed.
      setSaving(false);
      if (!current() && mountedRef.current && !tourRef.current) void load();
    }
  };

  return (
    <Card data-setting-anchor="settings-tray">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-1.5">{t('settings.tray_title')}
          <FeatureHelp title={t('settings.tray_title')} description={<><p>{t('settings.tray_desc')}</p><p>{t('settings.tray_hint')}</p></>} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loadError ? (
          <div className="space-y-2" role="alert">
            <p className="text-sm text-destructive">{t('settings.tray_load_failed')}</p>
            <p className="text-xs text-muted-foreground break-words">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>{t('common.refresh')}</Button>
          </div>
        ) : loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : (
          <>
            {settings && !settings.supported && <p className="text-sm text-muted-foreground">{t('settings.tray_unsupported')}</p>}
            <div className="space-y-2 max-w-md">
              <Label htmlFor="tray-text">{t('settings.tray_label')}</Label>
              <Input id="tray-text" value={text} placeholder="Dice!Next" onChange={event => setText(event.target.value)}
                disabled={!settings?.supported || saving} aria-invalid={!!error} aria-describedby="tray-text-hint tray-text-count" />
              <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
                <p id="tray-text-hint">{t('settings.tray_hint')}</p>
                <span id="tray-text-count" className="shrink-0">{trayTextLength(text)}/{TRAY_TEXT_LIMIT}</span>
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{t(`settings.tray_${error}`)}</p>}
              {settings && <p className="text-sm break-words">{t('settings.tray_preview')} <code>{trayTooltip(text, settings.port)}</code></p>}
            </div>
            <Button onClick={() => void save()} disabled={!settings?.supported || saving || !!error || text.trim() === settings.text}>
              {t(saving ? 'common.saving' : 'common.save')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
