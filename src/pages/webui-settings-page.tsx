import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { zustandAppStore } from '@/store/app-store';
import { useToast } from '@/hooks/use-toast';
import { ADMIN_PASSWORD_MAX_LENGTH, isValidAdminPassword, sanitizeAdminPassword } from '@/lib/admin-password';
import { Monitor, Key, Eye, EyeOff, Copy, Palette, Terminal, Lock, Server, RefreshCw } from 'lucide-react';

export const WebuiSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { apiKey, setApiKey, theme, setTheme } = zustandAppStore();
  const toast = useToast();
  const [localApiKey, setLocalApiKey] = useState(apiKey ?? '');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rawLog, setRawLog] = useState(false);
  // WebUI 登录口令
  const [pwInput, setPwInput] = useState('');
  const [pwEnabled, setPwEnabled] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  // 运行 IP / 端口
  const [host, setHost] = useState('0.0.0.0');
  const [port, setPort] = useState(18088);
  const [srvSaving, setSrvSaving] = useState(false);
  const [restartNeeded, setRestartNeeded] = useState(false);

  useEffect(() => {
    void (async () => {
      try { const r = await fetch('/api/system/log-mode'); const j = await r.json(); if (j.code === 0) setRawLog(!!j.data.raw); } catch { /* ignore */ }
      try { const r = await fetch('/api/system/webui-auth'); const j = await r.json(); if (j.code === 0) setPwEnabled(!!j.data.enabled); } catch { /* ignore */ }
      try { const r = await fetch('/api/system/server-config'); const j = await r.json(); if (j.code === 0) { setHost(j.data.host || '0.0.0.0'); setPort(Number(j.data.port) || 18088); } } catch { /* ignore */ }
    })();
  }, []);

  const handleSavePassword = async () => {
    if (!isValidAdminPassword(pwInput, true)) { toast({ title: t('auth.setup_short'), variant: 'destructive' }); return; }
    setPwSaving(true);
    try {
      const r = await fetch('/api/system/webui-auth', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwInput }) });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      setPwEnabled(!!j.data.enabled);
      setPwInput('');
      toast({ title: pwInput ? t('settings.webpw_set_ok') : t('settings.webpw_cleared') });
    } catch { toast({ title: t('common.save_fail'), variant: 'destructive' }); }
    finally { setPwSaving(false); }
  };

  const handleSaveServer = async () => {
    setSrvSaving(true);
    try {
      const r = await fetch('/api/system/server-config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host, port }) });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      setRestartNeeded(!!j.data.restart_required);
      toast({ title: t('common.save_success') });
    } catch { toast({ title: t('common.save_fail'), variant: 'destructive' }); }
    finally { setSrvSaving(false); }
  };

  const handleRestart = async () => {
    try {
      await fetch('/api/system/restart', { method: 'POST' });
      toast({ title: t('settings.restarting') });
    } catch { /* 连接会断开属正常 */ toast({ title: t('settings.restarting') }); }
  };

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    window.location.reload();
  };

  const handleSaveApiKey = async () => {
    setSaving(true);
    try { setApiKey(localApiKey || null); toast({ title: t('settings.key_saved') }); }
    catch { toast({ title: t('common.save_fail'), variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  const handleCopyApiKey = async () => {
    if (!apiKey) { toast({ title: t('settings.key_not_set'), variant: 'destructive' }); return; }
    try { await navigator.clipboard.writeText(apiKey); toast({ title: t('common.copy_success') }); }
    catch { toast({ title: t('common.copy_fail'), variant: 'destructive' }); }
  };

  const toggleRawLog = async (raw: boolean) => {
    setRawLog(raw);
    try {
      const r = await fetch('/api/system/log-mode', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }) });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      toast({ title: t('common.save_success') });
    } catch { setRawLog(!raw); toast({ title: t('common.save_fail'), variant: 'destructive' }); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Monitor className="h-5 w-5" />{t('webui.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('webui.desc')}</p>
      </div>

      {/* API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" />{t('settings.api_key_title')}</CardTitle>
          <CardDescription>{t('settings.api_key_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">{t('settings.api_key_label')}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input id="api-key" type={showKey ? 'text' : 'password'} placeholder={t('settings.api_key_placeholder')} value={localApiKey} onChange={(e) => setLocalApiKey(e.target.value)} />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button variant="outline" size="icon" onClick={handleCopyApiKey} disabled={!apiKey}><Copy className="h-4 w-4" /></Button>
            </div>
          </div>
          <Button onClick={handleSaveApiKey} disabled={saving}>{saving ? t('common.saving') : t('settings.save_key')}</Button>
        </CardContent>
      </Card>

      {/* WebUI 登录口令 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" />{t('settings.webpw_title')}</CardTitle>
          <CardDescription>{t('settings.webpw_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            {t('settings.webpw_status')}：
            <span className={pwEnabled ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'}>
              {pwEnabled ? t('settings.webpw_on') : t('settings.webpw_off')}
            </span>
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input type={showPw ? 'text' : 'password'} placeholder={t('settings.webpw_placeholder')} value={pwInput}
                autoCapitalize="none" spellCheck={false} inputMode="text" pattern="[!-~]*" maxLength={ADMIN_PASSWORD_MAX_LENGTH}
                onChange={(e) => setPwInput(sanitizeAdminPassword(e.target.value))} />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button onClick={handleSavePassword} disabled={pwSaving || (pwInput.length > 0 && !isValidAdminPassword(pwInput))}>{pwSaving ? t('common.saving') : t('common.save')}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.webpw_hint')}</p>
          {pwEnabled && (
            <Button variant="outline" size="sm" onClick={handleLogout}>{t('settings.logout')}</Button>
          )}
        </CardContent>
      </Card>

      {/* 运行 IP / 端口 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" />{t('settings.server_title')}</CardTitle>
          <CardDescription>{t('settings.server_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="srv-host" className="text-xs">{t('settings.server_host')}</Label>
              <Input id="srv-host" className="h-9 w-44 text-sm" value={host} onChange={(e) => setHost(e.target.value)} placeholder="0.0.0.0" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="srv-port" className="text-xs">{t('settings.server_port')}</Label>
              <Input id="srv-port" type="number" min={1} max={65535} className="h-9 w-28 text-sm" value={port} onChange={(e) => setPort(Number(e.target.value))} />
            </div>
            <Button size="sm" onClick={handleSaveServer} disabled={srvSaving}>{srvSaving ? t('common.saving') : t('common.save')}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.server_hint')}</p>
          {restartNeeded && (
            <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm">
              <span className="text-amber-700 dark:text-amber-400">{t('settings.server_restart_note')}</span>
              <Button size="sm" variant="outline" onClick={handleRestart}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />{t('settings.restart_now')}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 主题偏好 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" />{t('settings.theme_title')}</CardTitle>
          <CardDescription>{t('settings.theme_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {(['light', 'dark', 'system'] as const).map((tv) => (
              <Button key={tv} variant={theme === tv ? 'default' : 'outline'} size="sm" onClick={() => setTheme(tv)}>
                {t(`settings.theme_${tv}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 控制台日志 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Terminal className="h-4 w-4" />{t('settings.log_title')}</CardTitle>
          <CardDescription>{t('settings.log_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="raw-log" className="font-normal">{t('settings.log_raw')}</Label>
            <Switch id="raw-log" checked={rawLog} onCheckedChange={toggleRawLog} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
export default WebuiSettingsPage;
