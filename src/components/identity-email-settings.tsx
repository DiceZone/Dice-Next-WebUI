import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTourActive, useTourState } from '@/components/onboarding/tour-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface Settings {
  enabled: boolean; host: string; port: number; ssl: boolean;
  user: string; from: string; password_configured: boolean;
}
const initial: Settings = { enabled: false, host: '', port: 465, ssl: true, user: '', from: '', password_configured: false };
const sample: Settings = { ...initial, host: 'smtp.example.com', user: 'dice@example.com', from: 'dice@example.com' };

export function IdentityEmailSettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const tourActive = useTourActive();
  const [settings, setSettings] = useTourState(initial, sample);
  const [password, setPassword] = useTourState('', '');
  const [loading, setLoading] = useTourState(true, false);
  const [saving, setSaving] = useTourState(false, false);
  const [loadError, setLoadError] = useTourState('', '');
  const load = async () => {
    setLoading(true); setLoadError('');
    try {
      const r = await fetch('/api/system/identity-email');
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      setSettings({ ...initial, ...j.data });
    } catch (e) { setLoadError(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (!tourActive) void load(); }, [tourActive]);
  const save = async () => {
    if (tourActive) return;
    setSaving(true);
    try {
      const { password_configured: _, ...fields } = settings;
      const r = await fetch('/api/system/identity-email', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, pass: password }),
      });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      setSettings({ ...initial, ...j.data }); setPassword('');
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  return (
    <Card data-setting-anchor="settings-identity-email">
      <CardHeader>
        <CardTitle className="text-base">{t('identitymail.title')}</CardTitle>
        <CardDescription>{t('identitymail.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError ? <div className="flex items-center gap-2 text-sm text-destructive">
          <span>{loadError}</span><Button variant="outline" size="sm" onClick={() => void load()}>{t('identitymail.retry')}</Button>
        </div> : <>
          <div className="flex items-center gap-2">
            <Switch id="identity-mail-enabled" disabled={loading} checked={settings.enabled}
              onCheckedChange={(enabled) => setSettings((s) => ({ ...s, enabled }))} />
            <Label htmlFor="identity-mail-enabled">{t('identitymail.enabled')}</Label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="identity-mail-host">{t('identitymail.host')}</Label>
              <Input id="identity-mail-host" disabled={loading} value={settings.host} placeholder="smtp.example.com"
                onChange={(e) => setSettings((s) => ({ ...s, host: e.target.value }))} /></div>
            <div><Label htmlFor="identity-mail-port">{t('identitymail.port')}</Label>
              <Input id="identity-mail-port" disabled={loading} type="number" min={1} max={65535} value={settings.port}
                onChange={(e) => setSettings((s) => ({ ...s, port: Number(e.target.value) }))} /></div>
            <div><Label htmlFor="identity-mail-user">{t('identitymail.user')}</Label>
              <Input id="identity-mail-user" disabled={loading} value={settings.user} autoComplete="off"
                onChange={(e) => setSettings((s) => ({ ...s, user: e.target.value }))} /></div>
            <div><Label htmlFor="identity-mail-password">{t('identitymail.password')}</Label>
              <Input id="identity-mail-password" disabled={loading} type="password" value={password} autoComplete="new-password"
                placeholder={settings.password_configured ? t('identitymail.password_saved') : ''}
                onChange={(e) => setPassword(e.target.value)} /></div>
            <div><Label htmlFor="identity-mail-from">{t('identitymail.from')}</Label>
              <Input id="identity-mail-from" disabled={loading} value={settings.from} placeholder="dice@example.com"
                onChange={(e) => setSettings((s) => ({ ...s, from: e.target.value }))} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="identity-mail-ssl" disabled={loading} checked={settings.ssl}
              onCheckedChange={(ssl) => setSettings((s) => ({ ...s, ssl }))} />
            <Label htmlFor="identity-mail-ssl">{t('identitymail.ssl')}</Label>
          </div>
          <p className="text-xs text-muted-foreground">{t('identitymail.tls_hint')}</p>
          <p className="text-xs text-muted-foreground">{t('identitymail.usage')}</p>
          <Button size="sm" disabled={tourActive || loading || saving} onClick={() => void save()}>{t('common.save')}</Button>
        </>}
      </CardContent>
    </Card>
  );
}
