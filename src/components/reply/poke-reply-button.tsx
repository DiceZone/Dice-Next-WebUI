import React from 'react';
import { useTranslation } from 'react-i18next';
import { Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReplyForm } from './reply-form';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useTourActive } from '@/components/onboarding/tour-data';
import { POKE_KEYS, pokeReplyRule, type PokeSettings } from '@/lib/poke-reply';
import type { ReplyFormData, ReplyRule } from '@/types/reply';
import type { ReplySettingsScope } from '@/lib/reply-scope';

export const PokeReplyButton: React.FC<{
  scope: ReplySettingsScope; scopeLabel: string; onEditingChange: (editing: boolean) => void;
}> = ({ scope, scopeLabel, onEditingChange }) => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const samples = useTourActive();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [settings, setSettings] = React.useState<PokeSettings>({});
  const [rule, setRule] = React.useState<ReplyRule | null>(null);
  React.useEffect(() => {
    onEditingChange(open || loading);
    return () => onEditingChange(false);
  }, [open, loading, onEditingChange]);
  const start = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const data = samples ? { poke_default: '你好呀，{nick}！', poke_enabled: true } :
        (await apiClient.get<PokeSettings>('/system/events?' + new URLSearchParams({ ...scope, lang: i18n.language }))).data;
      setSettings(data); setRule(pokeReplyRule(data)); setOpen(true);
    } catch (e) {
      toast({ title: t('common.load_fail'), description: String(e), variant: 'destructive' });
    } finally { setLoading(false); }
  };
  const save = async (data: ReplyFormData) => {
    if (samples) { setRule({ ...rule!, ...data }); return; }
    await apiClient.put('/system/events', { ...scope,
      values: { poke_reply: data, poke_enabled: data.enabled !== false } });
    toast({ title: t('common.save_success') });
  };
  const inherited = scope.scope !== 'global' && POKE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(settings.overrides ?? {}, key));

  return <>
    <Button data-setting-anchor="settings-poke" variant="outline" className="shrink-0" disabled={loading} onClick={() => void start()}>
      <Hand className="mr-2 h-4 w-4" />{t('replies.poke_title')}
    </Button>
    <ReplyForm open={open} onOpenChange={setOpen} reply={rule} eventTrigger="poke" onSubmit={save} disabled={loading}
      onReset={inherited ? async () => {
        if (!samples) await apiClient.put('/system/events', { ...scope, values: {}, clear: POKE_KEYS });
        toast({ title: t('settings.scope_reset_success') });
      } : undefined}
      headerSlot={<div className="space-y-2">
        <p className="text-sm font-medium">{scopeLabel}</p>
        <p className="text-xs text-muted-foreground">{t('replies.poke_scope_hint')}</p>
      </div>} />
  </>;
};
