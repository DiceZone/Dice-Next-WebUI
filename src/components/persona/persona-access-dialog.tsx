import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PlatformIcon } from '@/components/platform-icon';
import { useDialogs } from '@/hooks/use-dialogs';
import { useToast } from '@/hooks/use-toast';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useRequestGate } from '@/hooks/use-request-gate';
import { useTourActive } from '@/components/onboarding/tour-data';
import apiClient from '@/lib/api-client';
import { readPersonaPolicy, samePersonaPolicy, type PersonaPolicy } from '@/lib/persona-policy';
import { zustandAdapterStore } from '@/store/adapter-store';
import type { Adapter } from '@/types/adapter';
import type { PersonaTemplate } from '@/types/persona';

export function PersonaAccessDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const dlg = useDialogs(t);
  const toast = useToast();
  const tourActive = useTourActive();
  const gate = useRequestGate(String(tourActive));
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [personas, setPersonas] = useState<PersonaTemplate[]>([]);
  const [adapterId, setAdapterId] = useState('');
  const [draft, setDraft] = useState<PersonaPolicy>(() => readPersonaPolicy({}));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const adapter = adapters.find((item) => item.id === adapterId);
  const dirty = !!adapter && !samePersonaPolicy(draft, readPersonaPolicy(adapter));

  const load = useCallback(async () => {
    if (tourActive) return;
    const current = gate.start();
    setLoading(true); setError('');
    try {
      const [bots, templates] = await Promise.all([
        apiClient.get<Adapter[]>('/adapters'), apiClient.get<PersonaTemplate[]>('/personas'),
      ]);
      if (!current()) return;
      const items = bots.data ?? [];
      setAdapters(items); setPersonas(templates.data ?? []);
      setAdapterId(items[0]?.id ?? ''); setDraft(readPersonaPolicy(items[0] ?? {}));
    } catch (err) {
      if (current()) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (current()) setLoading(false);
    }
  }, [gate, tourActive]);
  useEffect(() => { void load(); }, [load]);

  const confirmLeave = async () => {
    if (busy.current) return false;
    if (!dirty) return true;
    busy.current = true;
    try {
      return await dlg.confirm({
        title: t('ui_refresh.discard'), description: t('workspace.discard_hint'),
        cancelText: t('ui_refresh.keep_editing'), confirmText: t('ui_refresh.discard_edits'), destructive: true,
      });
    } finally { busy.current = false; }
  };
  useUnsavedChanges(dirty || saving, confirmLeave);
  const close = async () => { if (await confirmLeave()) onClose(); };
  const selectAdapter = async (id: string) => {
    if (id === adapterId || !await confirmLeave()) return;
    const next = adapters.find((item) => item.id === id);
    if (!next) return;
    setAdapterId(id); setDraft(readPersonaPolicy(next)); setError('');
  };
  const save = async () => {
    if (tourActive || loading || !adapter || !dirty || busy.current) return;
    const id = adapter.id;
    const policy = readPersonaPolicy(draft);
    const current = gate.capture();
    busy.current = true; setSaving(true); setError('');
    try {
      await zustandAdapterStore.getState().updateAdapter(id, policy);
      if (!current()) return;
      setAdapters((items) => items.map((item) => item.id === id ? { ...item, ...policy } : item));
      setDraft(policy);
      toast({ title: t('common.save_success') });
    } catch (err) {
      if (current()) setError(err instanceof Error ? err.message : t('common.save_fail'));
    } finally {
      busy.current = false;
      if (current()) setSaving(false);
    }
  };

  return <>
    <Dialog open onOpenChange={(open) => { if (!open) void close(); }}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('commands.persona_access')}</DialogTitle>
          <DialogDescription>{t('commands.persona_access_desc')}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : <>
            {!adapter && !error && <p className="text-sm text-muted-foreground">{t('commands.persona_no_adapters')}</p>}
            <fieldset disabled={saving || tourActive} className="space-y-4">
              {adapter && <>
                <div className="space-y-2">
                  <Label htmlFor="persona-account">{t('commands.persona_account')}</Label>
                  <Select value={adapterId} disabled={saving} onValueChange={(id) => { void selectAdapter(id); }}>
                    <SelectTrigger id="persona-account"><SelectValue /></SelectTrigger>
                    <SelectContent>{adapters.map((item) => <SelectItem key={item.id} value={item.id}>
                      <span className="flex min-w-0 items-center gap-2"><PlatformIcon platform={item.type} className="h-4 w-4" /><span className="truncate">{item.name} · {item.loginId || item.id}</span></span>
                    </SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="persona-default">{t('commands.persona_bot_default')}</Label>
                  <Select value={String(draft.defaultPersonaId)} disabled={saving} onValueChange={(value) => setDraft({ ...draft, defaultPersonaId: Number(value) })}>
                    <SelectTrigger id="persona-default"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t('commands.persona_follow_global')}</SelectItem>
                      {draft.defaultPersonaId > 0 && !personas.some((p) => p.id === draft.defaultPersonaId) && <SelectItem value={String(draft.defaultPersonaId)} disabled>#{draft.defaultPersonaId} ({t('commands.persona_unavailable')})</SelectItem>}
                      {personas.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="persona-selection">{t('commands.persona_user_selection')}</Label>
                  <Select value={draft.personaSelection} disabled={saving} onValueChange={(value: PersonaPolicy['personaSelection']) => setDraft({ ...draft, personaSelection: value })}>
                    <SelectTrigger id="persona-selection"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('commands.persona_all')}</SelectItem>
                      <SelectItem value="selected">{t('commands.persona_selected')}</SelectItem>
                      <SelectItem value="none">{t('commands.persona_none')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {draft.personaSelection === 'selected' && <div className="space-y-3 rounded-md border p-3">
                  {personas.length === 0 && <p className="text-sm text-muted-foreground">{t('commands.persona_empty')}</p>}
                  {personas.map((p) => <label key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words">{p.name}</span>
                    <Switch disabled={saving} checked={draft.selectablePersonaIds.includes(p.id)} onCheckedChange={(checked) => setDraft({ ...draft, selectablePersonaIds: checked ? [...draft.selectablePersonaIds, p.id] : draft.selectablePersonaIds.filter((id) => id !== p.id) })} />
                  </label>)}
                </div>}
                <p className="text-xs text-muted-foreground">{t('commands.persona_scope_hint')}</p>
              </>}
            </fieldset>
          </>}
          {error && <p role="alert" className="mt-3 break-words text-sm text-destructive">{error}</p>}
          {!adapter && !loading && error && <Button variant="outline" className="mt-3" onClick={() => { void load(); }}>{t('common.refresh')}</Button>}
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" disabled={saving} onClick={() => { void close(); }}>{t('common.close')}</Button>
          <Button disabled={loading || saving || !dirty || tourActive} onClick={() => { void save(); }}>{t(saving ? 'common.saving' : 'common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {dlg.node}
  </>;
}
