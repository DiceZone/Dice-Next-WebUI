import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlugZap, Plus, Copy, RefreshCw, Pencil, Trash2, KeyRound, ShieldCheck, MoreHorizontal, RotateCw, Stethoscope } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { FeatureHelp } from '@/components/ui/feature-help';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { useDialogs } from '@/hooks/use-dialogs';
import { useToast } from '@/hooks/use-toast';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { MCP_TOOLS, mcpEditor, mcpEditorDirty, mcpAuditQuery, mcpConnection, mcpEndpoint, mcpGrantPayload, mcpGrantState, mcpLines,
  MCP_READ_OPTIONS, MCP_CHECK_OPTIONS, mcpMutationOptions, mcpOperationId, mcpUncertain, mcpRecoverOperation, mcpServerNow, mcpExpiresSoon, type McpOperation,
  type McpAuditPage, type McpCard, type McpConfig, type McpGrant, type McpGrantDraft, type McpGrantPayload, type McpSettings,
  type McpEditor, type McpOutcome, type McpCardSummary, type McpSelfCheck, type McpClock } from '@/lib/mcp';

const emptyConfig: McpConfig = { enabled: false, allow_remote: false, allowed_hosts: [], allowed_origins: [] };
const descriptions = { roll_dice: 'roll_desc', search_help: 'help_desc', get_status: 'status_desc', get_character_card: 'card_desc' } as const;
const date = (seconds: number) => new Date(seconds * 1000).toLocaleString();

export const McpPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const dialogs = useDialogs(t);
  const [config, setConfig] = useState<McpConfig>(emptyConfig);
  const [savedConfig, setSavedConfig] = useState<McpConfig>(emptyConfig);
  const [hosts, setHosts] = useState('');
  const [origins, setOrigins] = useState('');
  const [settings, setSettings] = useState<McpSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setSaving] = useState(false);
  const [pending, setPending] = useState<{ id: string; action: string } | null>(null);
  const saving = requesting || pending !== null;
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<McpEditor | null>(null);
  const [cards, setCards] = useState<McpCard[]>([]);
  const [cardQuery, setCardQuery] = useState('');
  const [cardError, setCardError] = useState('');
  const [cardLoading, setCardLoading] = useState(false);
  const [cardDetails, setCardDetails] = useState<McpCardSummary[]>([]);
  const [detailsError, setDetailsError] = useState('');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkToken, setCheckToken] = useState('');
  const [checkTool, setCheckTool] = useState('none');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<McpSelfCheck | null>(null);
  const [checkError, setCheckError] = useState('');
  const [clock, setClock] = useState<McpClock | null>(null);
  const [steady, setSteady] = useState(() => performance.now());
  const [secret, setSecret] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [audit, setAudit] = useState<McpAuditPage>({ items: [], total: 0, page: 1, pageSize: 20 });
  const [auditError, setAuditError] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditClient, setAuditClient] = useState({ id: '', name: '' });
  const [auditOutcome, setAuditOutcome] = useState<McpOutcome>('');
  const [revision, setRevision] = useState(0);
  const [grantPage, setGrantPage] = useState(1);
  const dirty = !loading && JSON.stringify({ ...config, allowed_hosts: mcpLines(hosts), allowed_origins: mcpLines(origins) }) !== JSON.stringify(savedConfig);
  useUnsavedChanges(dirty || mcpEditorDirty(editor) || secret !== null || saving || checking, async () => !saving && !checking && await dialogs.confirm({
    title: t('ui_refresh.discard'), description: secret !== null ? t('mcp.secret_hint') : t('workspace.discard_hint'),
    cancelText: t('ui_refresh.keep_editing'), confirmText: t('ui_refresh.discard_edits'), destructive: true,
  }));
  const endpoint = mcpEndpoint();
  const fail = (e: unknown) => toast({ title: t('mcp.failed'), description: e instanceof Error && e.message === 'mcp_response_invalid' ? t('mcp.invalid_response') : String(e), variant: 'destructive' });
  const warnings = (data: { warnings?: string[] }) => {
    if (data.warnings?.includes('audit_unavailable')) toast({ title: t('mcp.saved'), description: t('mcp.audit_warning'), variant: 'destructive' });
  };
  const mutationError = (e: unknown, id: string, action: string) => {
    if (mcpUncertain(e)) setPending({ id, action }); else fail(e);
  };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast({ title: t('mcp.copied') }); } catch (e) { fail(e); }
  };
  const acceptSettings = (data: McpSettings) => {
    setSettings(data);
    const received = performance.now();
    setClock(data.server_time ? { server: data.server_time, received } : null); setSteady(received);
  };
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => { setSteady(performance.now()); timer = setTimeout(tick, 15000); };
    timer = setTimeout(tick, 15000);
    return () => clearTimeout(timer);
  }, []);
  const serverNow = mcpServerNow(clock, steady);
  useEffect(() => {
    let active = true;
    void apiClient.get<McpSettings>('/system/mcp', MCP_READ_OPTIONS).then(({ data }) => {
      if (!active) return;
      acceptSettings(data); setConfig({ enabled: data.enabled, allow_remote: data.allow_remote, allowed_hosts: data.allowed_hosts, allowed_origins: data.allowed_origins });
      setSavedConfig({ enabled: data.enabled, allow_remote: data.allow_remote, allowed_hosts: data.allowed_hosts, allowed_origins: data.allowed_origins });
      setHosts(data.allowed_hosts.join('\n')); setOrigins(data.allowed_origins.join('\n'));
    }).catch((e) => { if (active) setError(String(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    setAuditLoading(true); setAuditError('');
    void apiClient.get<McpAuditPage>(mcpAuditQuery(page, auditClient.id, auditOutcome), MCP_READ_OPTIONS).then(({ data }) => {
      if (active) { setAudit(data); if (data.page !== page) setPage(data.page); }
    }).catch((e) => { if (active) setAuditError(String(e)); }).finally(() => { if (active) setAuditLoading(false); });
    return () => { active = false; };
  }, [page, revision, auditClient.id, auditOutcome]);
  const wantsCards = !!editor?.draft.tools.includes('get_character_card');
  useEffect(() => {
    if (!wantsCards) return;
    let active = true;
    setCardError(''); setCardLoading(true);
    const timer = setTimeout(() => {
      void apiClient.get<McpCard[]>(`/system/mcp/card-options?q=${encodeURIComponent(cardQuery)}`, MCP_READ_OPTIONS).then(({ data }) => {
        if (active) setCards(data);
      }).catch((e) => { if (active) setCardError(String(e)); }).finally(() => { if (active) setCardLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [wantsCards, cardQuery]);
  const selectedIds = wantsCards ? editor!.draft.card_ids.join(',') : '';
  const editorId = editor?.id;
  useEffect(() => {
    setCardDetails([]); setDetailsError('');
    if (!selectedIds) { setDetailsLoading(false); return; }
    let active = true; setDetailsLoading(true);
    void apiClient.post<McpCardSummary[]>('/system/mcp/card-details', {
      card_ids: selectedIds.split(',').map(Number), ...(editorId ? { grant_id: editorId } : {}),
    }, MCP_CHECK_OPTIONS).then(({ data }) => { if (active) setCardDetails(data); })
      .catch((e) => { if (active) setDetailsError(String(e)); })
      .finally(() => { if (active) setDetailsLoading(false); });
    return () => { active = false; };
  }, [selectedIds, editorId]);
  const runCheck = async () => {
    if (checking) return;
    setChecking(true); setCheckError(''); setCheckResult(null);
    try {
      const { data } = await apiClient.post<McpSelfCheck>('/system/mcp/self-check', {
        ...(checkToken.trim() ? { token: checkToken.trim() } : {}), ...(checkTool === 'none' ? {} : { tool: checkTool }),
      }, MCP_CHECK_OPTIONS);
      setCheckResult(data);
    } catch { setCheckError(t('mcp.check_request_failed')); }
    finally { setCheckToken(''); setChecking(false); }
  };
  const refreshGrants = async () => {
    setRevision((v) => v + 1);
    try {
      const { data } = await apiClient.get<McpSettings>('/system/mcp', MCP_READ_OPTIONS); acceptSettings(data); return data;
    } catch (e) { toast({ title: t('mcp.refresh_failed'), description: String(e), variant: 'destructive' }); }
  };
  const checkPending = async () => {
    if (!pending || requesting) return;
    setSaving(true);
    try {
      const recovery = await mcpRecoverOperation(
        async () => (await apiClient.get<McpOperation>(`/system/mcp/operations/${pending.id}`, MCP_READ_OPTIONS)).data,
        async () => (await apiClient.get<McpSettings>('/system/mcp', MCP_READ_OPTIONS)).data,
        () => dialogs.confirm({ title: t('mcp.unknown_title'), description: t('mcp.unknown_hint') }),
      );
      if (recovery.state === 'pending') { toast({ title: t('mcp.still_running') }); return; }
      if (recovery.state === 'cancelled') return;
      const { operation: data, settings: fresh } = recovery;
      // Commit local state only after both reads and any confirmation succeed.
      acceptSettings(fresh); setRevision((v) => v + 1);
      if (data.state === 'unknown') {
        setEditor(null);
      } else if (data.state === 'succeeded') {
        warnings(data);
        if (pending.action === 'create' || pending.action === 'rotate') toast({ title: t('mcp.token_not_received'), description: `${t('mcp.token_recover_hint')} ${data.grant_id ? `(${data.grant_id})` : ''}`, variant: 'destructive' });
        if (pending.action === 'create' || pending.action === 'update') setEditor(null);
      } else toast({ title: t('mcp.not_applied') });
      if (pending.action === 'configure' && data.state !== 'failed') {
        const value = { enabled: fresh.enabled, allow_remote: fresh.allow_remote, allowed_hosts: fresh.allowed_hosts, allowed_origins: fresh.allowed_origins };
        setConfig(value); setSavedConfig(value); setHosts(value.allowed_hosts.join('\n')); setOrigins(value.allowed_origins.join('\n'));
      }
      setPending(null);
    } catch (e) { fail(e); } finally { setSaving(false); }
  };
  const save = async () => {
    if (saving) return;
    const id = mcpOperationId();
    setSaving(true);
    try {
      const next = { ...config, allowed_hosts: mcpLines(hosts), allowed_origins: mcpLines(origins) };
      const { data } = await apiClient.put<McpConfig & { warnings?: string[] }>('/system/mcp', next, mcpMutationOptions(id));
      warnings(data);
      const clean = { enabled: data.enabled, allow_remote: data.allow_remote, allowed_hosts: data.allowed_hosts, allowed_origins: data.allowed_origins };
      setConfig(clean); setSavedConfig(clean); setHosts(data.allowed_hosts.join('\n')); setOrigins(data.allowed_origins.join('\n'));
      setSettings((current) => current ? { ...current, ...data } : current);
      toast({ title: t('mcp.saved') }); await refreshGrants();
    } catch (e) { mutationError(e, id, 'configure'); } finally { setSaving(false); }
  };
  const saveGrant = async () => {
    if (!editor || saving) return;
    const id = mcpOperationId();
    let payload: McpGrantPayload;
    try { payload = mcpGrantPayload(editor.draft, editor.renew); } catch { toast({ title: t('mcp.invalid'), variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (editor.id) {
        const { data } = await apiClient.put<McpGrant & { warnings?: string[] }>(`/system/mcp/grants/${encodeURIComponent(editor.id)}`, payload, mcpMutationOptions(id));
        warnings(data);
        setSettings((current) => current ? { ...current, grants: current.grants.map((grant) => grant.id === data.id ? { ...grant, ...data } : grant) } : current);
      }
      else {
        const { data } = await apiClient.post<McpGrant & { token: string; warnings?: string[] }>('/system/mcp/grants', payload, mcpMutationOptions(id));
        warnings(data);
        // Never persisted in a store, local/sessionStorage or a query string.
        setSecret(data.token);
        const { token: _token, ...grant } = data;
        setSettings((current) => current ? { ...current, grants: [...current.grants, grant] } : current);
      }
      setEditor(null); await refreshGrants();
    } catch (e) { mutationError(e, id, editor.id ? 'update' : 'create'); } finally { setSaving(false); }
  };
  const revoke = async (grant: McpGrant) => {
    if (saving) return;
    if (!await dialogs.confirm({ title: t('mcp.revoke_confirm'), description: `${grant.name}\n${t('mcp.revoke_hint')}`, destructive: true })) return;
    setSaving(true);
    const id = mcpOperationId();
    try {
      const { data } = await apiClient.delete<{ warnings?: string[] }>(`/system/mcp/grants/${encodeURIComponent(grant.id)}`, mcpMutationOptions(id)); warnings(data);
      setSettings((current) => current ? { ...current, grants: current.grants.filter((item) => item.id !== grant.id) } : current);
      await refreshGrants();
    }
    catch (e) { mutationError(e, id, 'revoke'); } finally { setSaving(false); }
  };
  const rotate = async (grant: McpGrant) => {
    if (saving) return;
    if (!await dialogs.confirm({ title: t('mcp.rotate_confirm'), description: `${grant.name}\n${t('mcp.rotate_hint')}`, destructive: true })) return;
    setSaving(true);
    const id = mcpOperationId();
    try {
      const { data } = await apiClient.post<McpGrant & { token: string; warnings?: string[] }>(`/system/mcp/grants/${encodeURIComponent(grant.id)}/rotate`, {}, mcpMutationOptions(id));
      warnings(data); setSecret(data.token);
      const { token: _token, ...updatedGrant } = data;
      setSettings((current) => current ? { ...current, grants: current.grants.map((item) => item.id === updatedGrant.id ? { ...item, ...updatedGrant } : item) } : current);
      await refreshGrants();
    } catch (e) { mutationError(e, id, 'rotate'); } finally { setSaving(false); }
  };
  const closeEditor = async () => {
    if (saving) return;
    if (mcpEditorDirty(editor) && !await dialogs.confirm({ title: t('ui_refresh.discard'), description: t('workspace.discard_hint'),
      cancelText: t('ui_refresh.keep_editing'), confirmText: t('ui_refresh.discard_edits'), destructive: true })) return;
    setEditor(null);
  };
  const patchDraft = (value: Partial<McpGrantDraft>) => setEditor((current) => current ? { ...current, draft: { ...current.draft, ...value } } : null);
  const grants = settings?.grants ?? [];
  const auditClients = grants.map(({ id, name }) => ({ id, name }));
  if (auditClient.id && !auditClients.some((item) => item.id === auditClient.id)) auditClients.push(auditClient);
  const grantPages = Math.max(1, Math.ceil(grants.length / 10));
  useEffect(() => { if (grantPage > grantPages) setGrantPage(grantPages); }, [grantPage, grantPages]);
  if (loading || error) return <div className="max-w-5xl space-y-6">
    <PageHeader title={t('mcp.title')} icon={PlugZap} description={t('mcp.desc')} help={t('mcp.help')} />
    {error ? <div role="alert" className="rounded-md border border-destructive/30 p-4 text-destructive">{t('mcp.failed')}: {error}</div>
      : <p className="text-muted-foreground">{t('mcp.loading')}</p>}
  </div>;
  return <div className="max-w-5xl space-y-6">
    <PageHeader title={t('mcp.title')} icon={PlugZap} description={t('mcp.desc')} help={t('mcp.help')}
      actions={<div className="flex flex-wrap gap-2"><Button onClick={save} disabled={saving}>{t('mcp.save')}</Button>
        <Button variant="outline" onClick={() => { setCardQuery(''); setEditor(mcpEditor()); }} disabled={saving}><Plus className="mr-2 h-4 w-4" />{t('mcp.add')}</Button></div>} />
    {dialogs.node}
    {settings?.restored_access_reset && <p role="status" className="rounded-md border border-amber-500/40 p-4 text-sm">{t('mcp.restore_reset_hint')}</p>}
    {pending && !editor && <div role="alert" className="space-y-2 rounded-md border border-amber-500/40 p-4 text-sm"><p>{t('mcp.uncertain_hint')}</p><Button variant="outline" disabled={requesting} onClick={() => { void checkPending(); }}>{t('mcp.check_state')}</Button></div>}
    <Card data-setting-anchor="mcp-settings"><CardHeader><CardTitle className="text-base">{t('mcp.settings')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3"><Label htmlFor="mcp-enabled">{t('mcp.enabled')}</Label><Switch id="mcp-enabled" disabled={saving} checked={config.enabled} onCheckedChange={(enabled) => setConfig((c) => ({ ...c, enabled }))} /></div>
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-1"><Label htmlFor="mcp-remote">{t('mcp.remote')}</Label><FeatureHelp title={t('mcp.remote')} description={t('mcp.remote_warning')} /></div>
          <Switch id="mcp-remote" disabled={saving} checked={config.allow_remote} onCheckedChange={async (allow_remote) => {
            if (allow_remote && !await dialogs.confirm({ title: t('mcp.remote_confirm'), description: t('mcp.remote_warning') })) return;
            setConfig((c) => ({ ...c, allow_remote }));
          }} /></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><div className="flex items-center gap-1"><Label htmlFor="mcp-hosts">{t('mcp.hosts')}</Label><FeatureHelp title={t('mcp.hosts')} description={t('mcp.hosts_hint')} /></div>
            <Textarea id="mcp-hosts" disabled={saving} value={hosts} onChange={(e) => setHosts(e.target.value)} placeholder="dice.example.com" className="font-mono text-xs" /></div>
          <div className="space-y-2"><div className="flex items-center gap-1"><Label htmlFor="mcp-origins">{t('mcp.origins')}</Label><FeatureHelp title={t('mcp.origins')} description={t('mcp.origins_hint')} /></div>
            <Textarea id="mcp-origins" disabled={saving} value={origins} onChange={(e) => setOrigins(e.target.value)} placeholder="https://ai.example.com" className="font-mono text-xs" /></div>
        </div>
      </CardContent>
    </Card>
    <Card data-setting-anchor="mcp-connection"><CardHeader><CardTitle className="flex items-center gap-2 text-base">{t('mcp.connection')}<FeatureHelp title={t('mcp.connection')} description={<div className="space-y-2"><p>{t('mcp.connection_hint')}</p><p>{t('mcp.format_hint')}</p></div>} /></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {[[t('mcp.current_url'), endpoint], [t('mcp.local_url'), settings?.local_endpoint || endpoint]].map(([label, value]) => <div key={label} className="space-y-1"><Label>{label}</Label><div className="flex min-w-0 gap-2"><Input readOnly value={value} className="min-w-0 font-mono text-xs" /><Button variant="outline" size="icon" onClick={() => copy(value)} aria-label={t('mcp.copy')}><Copy className="h-4 w-4" /></Button></div></div>)}
        <pre className="max-w-full overflow-x-auto rounded-md bg-muted p-3 text-xs">{mcpConnection(endpoint)}</pre>
        <p className="text-xs text-muted-foreground">{t('mcp.versions')}: {settings?.protocol_versions.join(' / ')}</p>
        <Button variant="outline" disabled={saving || checking} onClick={() => { setCheckResult(null); setCheckError(''); setCheckToken(''); setCheckOpen(true); }}><Stethoscope className="mr-2 h-4 w-4" />{t('mcp.self_check')}</Button>
      </CardContent>
    </Card>
    <Card data-setting-anchor="mcp-grants"><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" />{t('mcp.grants')}<FeatureHelp title={t('mcp.grants')} description={t('mcp.usage_hint')} /></CardTitle><Button size="sm" variant="outline" disabled={saving} onClick={() => { void refreshGrants(); }}>{t('mcp.refresh')}</Button></CardHeader>
      <CardContent className="space-y-3">
        {!grants.length && <p className="text-sm text-muted-foreground">{t('mcp.empty')}</p>}
        {grants.slice((grantPage - 1) * 10, grantPage * 10).map((grant) => <div key={grant.id} data-testid={`mcp-grant-${grant.id}`} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4">
          <div className="min-w-0 flex-1 space-y-2"><div className="flex flex-wrap items-center gap-2"><span className="break-all font-medium">{grant.name}</span><Badge variant="outline">{t(`mcp.${mcpGrantState(grant, serverNow)}`)}</Badge>{mcpExpiresSoon(grant, serverNow) && <Badge variant="outline" className="text-amber-700 dark:text-amber-400">{t('mcp.expires_soon')}</Badge>}</div>
            <div className="flex flex-wrap gap-1">{grant.tools.map((tool) => <Badge key={tool} variant="secondary">{t(`mcp.${tool}`)}</Badge>)}</div>
            <p className="text-xs text-muted-foreground">{t('mcp.expires')}: {date(grant.expires_at)}</p>
            <p className="text-xs text-muted-foreground">{t('mcp.last_used')}: {settings?.usage_available === false ? t('mcp.usage_unavailable') : grant.last_used_at ? date(grant.last_used_at) : t('mcp.no_retained_usage')}</p>
            {grant.requires_rotation && <p className="text-xs text-amber-700 dark:text-amber-400">{t('mcp.restore_grant_hint')}</p>}
          </div><div className="flex shrink-0 gap-1"><Button size="sm" variant="outline" disabled={saving} onClick={() => { setCardQuery(''); setEditor(mcpEditor(grant)); }}><Pencil className="mr-1 h-3 w-3" />{t('mcp.edit')}</Button>
            <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="outline" disabled={saving} aria-label={t('mcp.more')}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { void rotate(grant); }}><RotateCw className="mr-2 h-4 w-4" />{t('mcp.rotate')}</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => { void revoke(grant); }}><Trash2 className="mr-2 h-4 w-4" />{t('mcp.revoke')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
        </div>)}
        {grantPages > 1 && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{t('mcp.page', { page: grantPage, pages: grantPages })}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={grantPage <= 1} onClick={() => setGrantPage((v) => v - 1)}>{t('mcp.previous')}</Button><Button size="sm" variant="outline" disabled={grantPage >= grantPages} onClick={() => setGrantPage((v) => v + 1)}>{t('mcp.next')}</Button></div></div>}
      </CardContent>
    </Card>
    <Card data-setting-anchor="mcp-audit"><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />{t('mcp.audit')}<FeatureHelp title={t('mcp.audit')} description={t('mcp.audit_hint')} /></CardTitle><Button size="sm" variant="outline" disabled={auditLoading} onClick={() => setRevision((v) => v + 1)}><RefreshCw className="mr-1 h-3 w-3" />{t('mcp.refresh')}</Button></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="mcp-audit-client">{t('mcp.client')}</Label><Select value={auditClient.id || 'all'} onValueChange={(value) => { setAuditClient(value === 'all' ? { id: '', name: '' } : auditClients.find((item) => item.id === value) ?? { id: value, name: value.slice(0, 8) }); setPage(1); }}>
            <SelectTrigger id="mcp-audit-client"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t('mcp.all_clients')}</SelectItem>{auditClients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name} · {client.id.slice(0, 8)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="mcp-audit-outcome">{t('mcp.result')}</Label><Select value={auditOutcome || 'all'} onValueChange={(value) => { setAuditOutcome(value === 'all' ? '' : value as McpOutcome); setPage(1); }}>
            <SelectTrigger id="mcp-audit-outcome"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t('mcp.all_results')}</SelectItem>{(['success', 'denied', 'error'] as const).map((outcome) => <SelectItem key={outcome} value={outcome}>{t(`mcp.${outcome}`)}</SelectItem>)}</SelectContent></Select></div>
        </div>
        {auditError ? <p role="alert" className="text-sm text-destructive">{auditError}</p> : <>
          <div className="overflow-x-auto" aria-busy={auditLoading}><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2">{t('mcp.time')}</th><th className="p-2">{t('mcp.client')}</th><th className="p-2">{t('mcp.operation')}</th><th className="p-2">{t('mcp.result')}</th></tr></thead><tbody>
            {!auditLoading && audit.items.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="whitespace-nowrap p-2 text-xs">{date(row.created_at)}</td><td className="max-w-48 break-words p-2">{row.client_id ? <button className="text-left hover:underline" title={t('mcp.filter_client')} onClick={() => { setAuditClient({ id: row.client_id, name: row.client_name }); setPage(1); }}>{row.client_name}<span className="block font-mono text-xs text-muted-foreground">{row.client_id.slice(0, 8)}</span></button> : row.client_name}</td><td className="p-2"><div>{MCP_TOOLS.includes(row.operation as typeof MCP_TOOLS[number]) ? t(`mcp.${row.operation}`) : row.operation}</div><div className="max-w-sm break-words text-xs text-muted-foreground">{row.message}</div></td><td className="p-2"><Badge variant={row.outcome === 'success' ? 'secondary' : 'outline'}>{t(`mcp.${row.outcome}`)}</Badge></td></tr>)}
          </tbody></table></div>
          {(auditLoading || !audit.items.length) && <p className="py-3 text-center text-sm text-muted-foreground">{auditLoading ? t('mcp.loading') : t('mcp.no_audit')}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{t('mcp.total', { count: audit.total })} · {t('mcp.page', { page: audit.page, pages: Math.max(1, Math.ceil(audit.total / audit.pageSize)) })}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={auditLoading || page <= 1} onClick={() => setPage((v) => v - 1)}>{t('mcp.previous')}</Button><Button size="sm" variant="outline" disabled={auditLoading || page * audit.pageSize >= audit.total} onClick={() => setPage((v) => v + 1)}>{t('mcp.next')}</Button></div></div>
        </>}
      </CardContent>
    </Card>
    <Dialog open={!!editor} onOpenChange={(open) => { if (!open) void closeEditor(); }}>
      <DialogContent layout="editor" className="max-w-xl"><DialogHeader><DialogTitle>{t(editor?.id ? 'mcp.edit' : 'mcp.add')}</DialogTitle><DialogDescription>{t('mcp.cards_hint')}</DialogDescription></DialogHeader>
        {editor && <DialogBody className="space-y-4">
          {pending && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{t('mcp.uncertain_hint')}</p>}
          <div className="space-y-2"><Label htmlFor="mcp-grant-name">{t('mcp.name')}</Label><Input id="mcp-grant-name" disabled={saving} maxLength={100} value={editor.draft.name} onChange={(e) => patchDraft({ name: e.target.value })} /></div>
          <div className="space-y-2"><Label>{t('mcp.tools')}</Label>{MCP_TOOLS.map((tool) => <label key={tool} className="flex cursor-pointer items-start gap-3 rounded-md border p-3"><Checkbox disabled={saving} className="mt-0.5" checked={editor.draft.tools.includes(tool)} onCheckedChange={(checked) => patchDraft({ tools: checked ? [...editor.draft.tools, tool] : editor.draft.tools.filter((value) => value !== tool) })} /><span><span className="text-sm font-medium">{t(`mcp.${tool}`)}</span><span className="block text-xs text-muted-foreground">{t(`mcp.${descriptions[tool]}`)}</span></span></label>)}</div>
          {wantsCards && <div className="space-y-2"><Label htmlFor="mcp-card-search">{t('mcp.cards')}</Label><Input id="mcp-card-search" disabled={saving} value={cardQuery} onChange={(e) => setCardQuery(e.target.value)} placeholder={t('mcp.card_search')} />
            {!!editor.draft.card_ids.length && <div className="space-y-1" aria-busy={detailsLoading}>{editor.draft.card_ids.map((id) => {
              const card = cardDetails.find((item) => item.card_id === id);
              return <div key={id} className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm"><div className="min-w-0 break-all"><p>#{id} · {card?.name || t('mcp.default_card')}</p>{card?.user_id && <p className="text-xs text-muted-foreground">{t('mcp.owner')}: {card.user_id}</p>}<p className={card?.state && card.state !== 'available' ? 'text-xs text-amber-700 dark:text-amber-400' : 'text-xs text-muted-foreground'}>{detailsLoading ? t('mcp.loading') : card ? t(`mcp.card_${card.state}`) : t('mcp.card_not_checked')}</p></div><Button disabled={saving} size="icon" variant="ghost" aria-label={t('mcp.remove_card', { id })} onClick={() => patchDraft({ card_ids: editor.draft.card_ids.filter((value) => value !== id) })}><Trash2 className="h-4 w-4" /></Button></div>;
            })}</div>}
            {detailsError && <p role="alert" className="text-xs text-destructive">{t('mcp.card_not_checked')}: {detailsError}</p>}
            <div className="h-40 space-y-1 overflow-y-auto rounded-md border p-2">{cardLoading && <p className="text-xs text-muted-foreground">{t('mcp.loading')}</p>}{cardError && <p className="text-xs text-destructive">{cardError}</p>}{!cardLoading && cards.map((card) => <label key={card.card_id} className="flex items-center gap-2 rounded p-1 text-sm"><Checkbox disabled={saving} checked={editor.draft.card_ids.includes(card.card_id)} onCheckedChange={(checked) => patchDraft({ card_ids: checked ? [...editor.draft.card_ids, card.card_id] : editor.draft.card_ids.filter((id) => id !== card.card_id) })} /><span className="break-all">#{card.card_id} · {card.name || t('mcp.default_card')} <span className="text-xs text-muted-foreground">({card.user_id})</span></span></label>)}</div><p className="text-xs text-muted-foreground">{t('mcp.card_limit')}</p>
          </div>}
          {editor.expires_at !== undefined && <p className="text-xs text-muted-foreground">{t('mcp.expires')}: {date(editor.expires_at)}</p>}
          {editor.id && <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-1"><Label htmlFor="mcp-renew">{t('mcp.renew')}</Label><FeatureHelp title={t('mcp.renew')} description={t('mcp.renew_hint')} /></div><Switch id="mcp-renew" disabled={saving} checked={editor.renew} onCheckedChange={(renew) => setEditor((current) => current ? { ...current, renew } : current)} /></div>}
          <div className="space-y-2"><div className="flex items-center gap-1"><Label htmlFor="mcp-expiry">{t('mcp.expiry')}</Label><FeatureHelp title={t('mcp.expiry')} description={t('mcp.expiry_hint')} /></div><Input id="mcp-expiry" disabled={saving || !editor.renew} type="number" min={1} max={365} value={editor.draft.expires_days} onChange={(e) => patchDraft({ expires_days: Number(e.target.value) })} /></div>
          {editor.requires_rotation && <p className="text-sm text-amber-700 dark:text-amber-400">{t('mcp.restore_grant_hint')}</p>}
          <div className="flex items-center justify-between gap-3"><Label htmlFor="mcp-grant-enabled">{t('mcp.enabled_grant')}</Label><Switch id="mcp-grant-enabled" disabled={saving || editor.requires_rotation} checked={editor.draft.enabled} onCheckedChange={(enabled) => patchDraft({ enabled })} /></div>
        </DialogBody>}
        <DialogFooter>{pending ? <Button disabled={requesting} onClick={() => { void checkPending(); }}>{t('mcp.check_state')}</Button> : <><Button variant="outline" disabled={saving} onClick={() => { void closeEditor(); }}>{t('mcp.cancel')}</Button><Button disabled={saving} onClick={saveGrant}>{t(editor?.id ? 'mcp.save' : 'mcp.create')}</Button></>}</DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={checkOpen} onOpenChange={(open) => { if (!open) { setCheckToken(''); setCheckOpen(false); } }}>
      <DialogContent layout="editor" className="max-w-xl"><DialogHeader><DialogTitle>{t('mcp.self_check')}</DialogTitle><DialogDescription>{t('mcp.self_check_hint')}</DialogDescription></DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2"><Label htmlFor="mcp-check-token">{t('mcp.check_token')}</Label><Input id="mcp-check-token" type="password" autoComplete="off" maxLength={70} disabled={checking} value={checkToken} onChange={(e) => setCheckToken(e.target.value)} /><p className="text-xs text-muted-foreground">{t('mcp.check_token_hint')}</p></div>
          <div className="space-y-2"><Label htmlFor="mcp-check-tool">{t('mcp.check_tool')}</Label><Select value={checkTool} disabled={checking} onValueChange={setCheckTool}><SelectTrigger id="mcp-check-tool"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{t('mcp.check_no_tool')}</SelectItem>{MCP_TOOLS.map((tool) => <SelectItem key={tool} value={tool}>{t(`mcp.${tool}`)}</SelectItem>)}</SelectContent></Select></div>
          {checkError && <p role="alert" className="text-sm text-destructive">{checkError}</p>}
          {checkResult && <div role="status" className="space-y-3">{checkResult.checks.map((row) => <div key={row.name} className="space-y-1 rounded-md border p-3"><div className="flex items-center justify-between gap-2 text-sm"><span>{t(`mcp.check_${row.name}`)}</span><Badge variant={row.state === 'pass' ? 'secondary' : 'outline'}>{t(`mcp.check_${row.state}`)}</Badge></div><p className="text-sm text-muted-foreground">{t(`mcp.check_detail_${row.detail}`)}</p></div>)}{!!checkResult.tools.length && <p className="text-xs text-muted-foreground">{t('mcp.tools')}: {checkResult.tools.map((tool) => t(`mcp.${tool}`)).join(' / ')}</p>}</div>}
        </DialogBody><DialogFooter><Button variant="outline" onClick={() => { setCheckToken(''); setCheckOpen(false); }}>{t('mcp.cancel')}</Button><Button disabled={checking} onClick={() => { void runCheck(); }}>{t(checking ? 'mcp.checking' : 'mcp.check_start')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={secret !== null} onOpenChange={(open) => { if (!open) setSecret(null); }}>
      <DialogContent className="max-h-[85dvh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>{t('mcp.secret_title')}</DialogTitle><DialogDescription>{t('mcp.secret_hint')}</DialogDescription></DialogHeader>
        {secret && <div className="space-y-3"><Label>{t('mcp.token')}</Label><div className="flex min-w-0 gap-2"><Input readOnly value={secret} className="min-w-0 font-mono text-xs" autoComplete="off" /><Button variant="outline" size="icon" onClick={() => copy(secret)} aria-label={t('mcp.copy')}><Copy className="h-4 w-4" /></Button></div><pre className="max-w-full overflow-x-auto rounded bg-muted p-3 text-xs">{mcpConnection(endpoint, secret)}</pre><Button variant="outline" onClick={() => copy(mcpConnection(endpoint, secret))}>{t('mcp.copy')}</Button></div>}
        <DialogFooter><Button onClick={() => setSecret(null)}>{t('mcp.close_secret')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
};
