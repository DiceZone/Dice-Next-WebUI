import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTourActive } from '@/components/onboarding/tour-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FeatureHelp } from '@/components/ui/feature-help';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { isHttpsPanel, panelBase, ssoStartUrl } from '@/lib/sso';
import { LogIn, Plus, Trash2, Link2, Pencil, Copy } from 'lucide-react';

interface Binding { sub: string; label: string; bound_at: string; }
interface Provider {
  id: string; name: string; issuer: string; client_id: string; has_secret: boolean; scopes: string;
  enabled: boolean; logo: string; logo_url: string; has_logo_file: boolean; bindings: Binding[];
}
interface SsoConfig {
  bdc: { enabled: boolean; client_id: string; redirect_uris: string[]; has_key: boolean };
  providers: Provider[]; callback_path: string; session_hours: number;
}
interface Draft { id: string; name: string; issuer: string; client_id: string; client_secret: string; scopes: string; logo_url: string; enabled: boolean; }

const emptyDraft: Draft = { id: '', name: '', issuer: '', client_id: '', client_secret: '', scopes: 'openid profile email', logo_url: '', enabled: true };

async function call(method: string, url: string, body?: unknown) {
  const r = await fetch(url, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.code !== 0) throw new Error(j.message || r.statusText);
  return j.data;
}

function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const SsoSettingsCard: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const dlg = useDialogs(t);
  const tourActive = useTourActive();
  const [config, setConfig] = useState<SsoConfig | null>(null);
  const [role, setRole] = useState('full');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const https = isHttpsPanel();
  const base = panelBase();
  const callback = `${base}${config?.callback_path || '/api/auth/sso/callback'}`;
  const readOnly = role !== 'full';

  const load = async () => {
    try {
      const [conf, status] = await Promise.all([call('GET', '/api/auth/sso/config'), fetch('/api/auth/status').then((r) => r.json())]);
      setConfig(conf as SsoConfig);
      setRole(status?.data?.role || 'full');
    } catch (e) { toast({ title: t('common.load_fail'), description: String(e), variant: 'destructive' }); }
  };
  useEffect(() => { if (!tourActive) void load(); }, [tourActive]);

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try { await action(); if (success) toast({ title: success }); await load(); }
    catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const toggleBdc = (enabled: boolean) => run(() => call('PUT', '/api/auth/sso/bdc', enabled && https ? { enabled, base } : { enabled }),
    enabled ? t('sso.bdc_enabled') : t('sso.bdc_disabled'));
  const registerCurrent = () => run(() => call('PUT', '/api/auth/sso/bdc', { enabled: true, base }), t('sso.bdc_registered'));
  const removeUri = async (uri: string) => {
    if (!await dlg.confirm({ title: t('sso.remove_uri'), description: uri, destructive: true, confirmText: t('common.delete') })) return;
    await run(() => call('DELETE', '/api/auth/sso/bdc/redirect-uris', { redirect_uri: uri }));
  };

  const saveDraft = async () => {
    if (!draft) return;
    await run(async () => {
      const { id, client_secret, ...rest } = draft;
      await call('PUT', `/api/auth/sso/providers/${encodeURIComponent(id)}`, { ...rest, client_secret });
      if (logoFile) await call('POST', `/api/auth/sso/providers/${encodeURIComponent(id)}/logo`, { content: await readFileBase64(logoFile) });
      setDraft(null); setLogoFile(null);
    }, t('common.save_success'));
  };
  const removeProvider = async (provider: Provider) => {
    if (!await dlg.confirm({ title: t('sso.delete_provider'), description: t('sso.delete_provider_desc', { name: provider.name }), destructive: true, confirmText: t('common.delete') })) return;
    await run(() => call('DELETE', `/api/auth/sso/providers/${encodeURIComponent(provider.id)}`));
  };
  const removeLogo = (provider: Provider) => run(() => call('DELETE', `/api/auth/sso/providers/${encodeURIComponent(provider.id)}/logo`));
  const unbind = async (provider: Provider, binding: Binding) => {
    if (!await dlg.confirm({ title: t('sso.unbind'), description: t('sso.unbind_desc', { label: binding.label }), destructive: true, confirmText: t('sso.unbind') })) return;
    await run(() => call('DELETE', `/api/auth/sso/providers/${encodeURIComponent(provider.id)}/bindings`, { sub: binding.sub }));
  };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast({ title: t('sso.copied') }); } catch { /* clipboard optional */ }
  };

  const bdc = config?.bdc;
  return (
    <Card data-setting-anchor="webui-sso">
      {dlg.node}
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <LogIn className="h-4 w-4" />{t('sso.title')}
          <FeatureHelp title={t('sso.title')} description={<><p>{t('sso.desc')}</p><p>{t('sso.session_hint', { hours: config?.session_hours ?? 24 })}</p><p>{t('sso.admin_hint')}</p></>} />
        </CardTitle>
        <CardDescription>{t('sso.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!https && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">{t('sso.https_required')}</p>}
        {readOnly && <p className="rounded-md border p-2.5 text-xs text-muted-foreground">{t('sso.readonly')}</p>}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded border p-2.5">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t('sso.bdc_title')}</Label>
              <p className="text-xs text-muted-foreground">{t('sso.bdc_desc')}</p>
              {bdc && !bdc.has_key && <p className="text-xs text-amber-600 dark:text-amber-400">{t('sso.bdc_no_key')}</p>}
            </div>
            <Switch checked={!!bdc?.enabled} disabled={busy || readOnly || !bdc?.has_key || (!bdc?.enabled && !https && !bdc?.redirect_uris.length)}
              onCheckedChange={(value) => void toggleBdc(value)} />
          </div>
          {bdc && (bdc.redirect_uris.length > 0 || bdc.enabled) && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs">{t('sso.redirect_uris')}</Label>
                <Button size="sm" variant="outline" disabled={busy || readOnly || !https || !bdc.has_key} onClick={() => void registerCurrent()}>{t('sso.register_current')}</Button>
              </div>
              {bdc.redirect_uris.length === 0 ? <p className="text-xs text-muted-foreground">{t('sso.no_redirect_uris')}</p> :
                <ul className="space-y-1">{bdc.redirect_uris.map((uri) => (
                  <li key={uri} className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5">
                    <span className="break-all font-mono text-xs">{uri}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" disabled={busy || readOnly} aria-label={t('sso.remove_uri')} onClick={() => void removeUri(uri)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </li>))}</ul>}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t('sso.custom_title')}</Label>
              <p className="text-xs text-muted-foreground">{t('sso.custom_desc')}</p>
            </div>
            <Button size="sm" variant="outline" disabled={busy || readOnly} onClick={() => { setEditing(false); setLogoFile(null); setDraft({ ...emptyDraft }); }}><Plus className="mr-1.5 h-3.5 w-3.5" />{t('sso.add_provider')}</Button>
          </div>
          {(config?.providers || []).length === 0 ? <p className="text-xs text-muted-foreground">{t('sso.no_providers')}</p> :
            (config?.providers || []).map((provider) => (
              <div key={provider.id} className="space-y-2 rounded border p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {provider.logo ? <img src={provider.logo} alt="" className="h-6 w-6 shrink-0 rounded object-contain" /> : <LogIn className="h-5 w-5 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{provider.name}{!provider.enabled && <span className="ml-2 text-xs text-muted-foreground">{t('sso.disabled')}</span>}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{provider.issuer}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" disabled={busy || readOnly || !https} onClick={() => { window.location.href = ssoStartUrl(provider.id, 'bind'); }}><Link2 className="mr-1.5 h-3.5 w-3.5" />{t('sso.bind_me')}</Button>
                    <Button size="sm" variant="outline" disabled={busy || readOnly} onClick={() => { setEditing(true); setLogoFile(null); setDraft({ id: provider.id, name: provider.name, issuer: provider.issuer, client_id: provider.client_id, client_secret: '', scopes: provider.scopes, logo_url: provider.logo_url, enabled: provider.enabled }); }}><Pencil className="mr-1.5 h-3.5 w-3.5" />{t('common.edit')}</Button>
                    {provider.has_logo_file && <Button size="sm" variant="outline" disabled={busy || readOnly} onClick={() => void removeLogo(provider)}>{t('sso.remove_logo')}</Button>}
                    <Button size="sm" variant="outline" disabled={busy || readOnly} onClick={() => void removeProvider(provider)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />{t('common.delete')}</Button>
                  </div>
                </div>
                {provider.bindings.length === 0 ? <p className="text-xs text-muted-foreground">{t('sso.no_bindings')}</p> :
                  <ul className="space-y-1">{provider.bindings.map((binding) => (
                    <li key={binding.sub} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2.5 py-1.5 text-xs">
                      <span className="min-w-0 truncate">{binding.label} <span className="text-muted-foreground">· {binding.bound_at}</span></span>
                      <Button size="sm" variant="ghost" className="h-7 shrink-0" disabled={busy || readOnly} onClick={() => void unbind(provider, binding)}>{t('sso.unbind')}</Button>
                    </li>))}</ul>}
              </div>
            ))}
          <div className="flex items-center gap-2 rounded bg-muted/40 px-2.5 py-1.5 text-xs">
            <span className="shrink-0 text-muted-foreground">{t('sso.callback_label')}</span>
            <span className="min-w-0 flex-1 break-all font-mono">{callback}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={t('sso.copy')} onClick={() => void copy(callback)}><Copy className="h-3.5 w-3.5" /></Button>
          </div>
        </section>
      </CardContent>

      <Dialog open={draft !== null} onOpenChange={(open) => { if (!open && !busy) setDraft(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t('sso.edit_provider') : t('sso.add_provider')}</DialogTitle></DialogHeader>
          {draft && <DialogBody className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">{t('sso.field_id')}</Label>
              <Input value={draft.id} disabled={editing} maxLength={32} onChange={(e) => setDraft({ ...draft, id: e.target.value.replace(/[^A-Za-z0-9_-]/g, '') })} placeholder="github" /></div>
            <div className="space-y-1"><Label className="text-xs">{t('sso.field_name')}</Label>
              <Input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">{t('sso.field_issuer')}</Label>
              <Input value={draft.issuer} onChange={(e) => setDraft({ ...draft, issuer: e.target.value.trim() })} placeholder="https://accounts.example.com" /></div>
            <div className="space-y-1"><Label className="text-xs">client_id</Label>
              <Input value={draft.client_id} onChange={(e) => setDraft({ ...draft, client_id: e.target.value.trim() })} /></div>
            <div className="space-y-1"><Label className="text-xs">client_secret</Label>
              <Input type="password" value={draft.client_secret} placeholder={editing ? t('sso.secret_keep') : ''} onChange={(e) => setDraft({ ...draft, client_secret: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">{t('sso.field_scopes')}</Label>
              <Input value={draft.scopes} onChange={(e) => setDraft({ ...draft, scopes: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">{t('sso.field_logo_url')}</Label>
              <Input value={draft.logo_url} placeholder="https://" onChange={(e) => setDraft({ ...draft, logo_url: e.target.value.trim() })} /></div>
            <div className="space-y-1"><Label className="text-xs">{t('sso.field_logo_file')}</Label>
              <Input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
              <p className="text-xs text-muted-foreground">{t('sso.logo_hint')}</p></div>
            <div className="flex items-center justify-between rounded border p-2.5"><Label className="text-sm">{t('sso.field_enabled')}</Label>
              <Switch checked={draft.enabled} onCheckedChange={(value) => setDraft({ ...draft, enabled: value })} /></div>
            <p className="text-xs text-muted-foreground">{t('sso.callback_hint', { url: callback })}</p>
          </DialogBody>}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setDraft(null)}>{t('common.cancel')}</Button>
            <Button disabled={busy || !draft?.id || !draft?.name || !draft?.issuer || !draft?.client_id} onClick={() => void saveDraft()}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
