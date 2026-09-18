import React from 'react';
import { useTranslation } from 'react-i18next';
import { Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReplyForm } from './reply-form';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { platformLabel } from '@/components/platform-icon';
import { useTourActive } from '@/components/onboarding/tour-data';
import { POKE_KEYS, pokeReplyRule, type PokeSettings } from '@/lib/poke-reply';
import type { ReplyFormData, ReplyRule } from '@/types/reply';

interface Account { id: string; name: string; type: string; loginId?: string; }

export const PokeReplyButton: React.FC = () => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const dialogs = useDialogs();
  const samples = useTourActive();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [selection, setSelection] = React.useState('global');
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [settings, setSettings] = React.useState<PokeSettings>({});
  const [rule, setRule] = React.useState<ReplyRule | null>(null);
  const selector = (value: string) => {
    if (value === 'global') return { scope: 'global', target: '', platform: '' };
    const [scope, target] = value.split(':');
    return { scope, target, platform: scope === 'adapter' ? target : accounts.find((a) => a.id === target)?.type ?? '' };
  };
  const load = async (value: string) => {
    setLoading(true);
    try {
      const data = samples ? { poke_default: '你好呀，{nick}！', poke_enabled: true } :
        (await apiClient.get<PokeSettings>('/system/events?' + new URLSearchParams({ ...selector(value), lang: i18n.language }))).data;
      setSettings(data); setRule(pokeReplyRule(data)); setSelection(value); setOpen(true);
    } catch (e) {
      toast({ title: t('common.load_fail'), description: String(e), variant: 'destructive' });
    } finally { setLoading(false); }
  };
  const start = async () => {
    if (loading) return;
    setLoading(true);
    if (!samples) {
      try { setAccounts((await apiClient.get<Account[]>('/adapters')).data); }
      catch (e) { toast({ title: t('common.load_fail'), description: String(e), variant: 'destructive' }); setLoading(false); return; }
    }
    await load('global');
  };
  const changeScope = async (value: string) => {
    if (value === selection || loading) return;
    if (await dialogs.confirm({ title: t('replies.poke_scope_change'), description: t('replies.poke_scope_change_hint') })) await load(value);
  };
  const save = async (data: ReplyFormData) => {
    if (samples) { setRule({ ...rule!, ...data }); return; }
    await apiClient.put('/system/events', { ...selector(selection),
      values: { poke_reply: data, poke_enabled: data.enabled !== false } });
    toast({ title: t('common.save_success') });
  };
  const inherited = selection !== 'global' && POKE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(settings.overrides ?? {}, key));

  return <>
    <Button data-setting-anchor="settings-poke" size="sm" variant="outline" className="shrink-0" disabled={loading} onClick={() => void start()}>
      <Hand className="mr-2 h-4 w-4" />{t('replies.poke_title')}
    </Button>
    <ReplyForm open={open} onOpenChange={setOpen} reply={rule} eventTrigger="poke" onSubmit={save} disabled={loading}
      onReset={inherited ? async () => {
        if (!samples) await apiClient.put('/system/events', { ...selector(selection), values: {}, clear: POKE_KEYS });
        toast({ title: t('settings.scope_reset_success') });
      } : undefined}
      headerSlot={<div className="space-y-2">
        <Select value={selection} onValueChange={(value) => void changeScope(value)} disabled={loading}>
          <SelectTrigger aria-label={t('settings.scope_title')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="global">{t('settings.scope_global')}</SelectItem>
            {[...new Set(accounts.map((a) => a.type))].map((platform) => <SelectItem key={platform} value={'adapter:' + platform}>
              {t('settings.scope_adapter')} · {platformLabel(platform)}
            </SelectItem>)}
            {accounts.map((account) => <SelectItem key={account.id} value={'account:' + account.id}>
              {t('settings.scope_account')} · {account.name} {account.loginId || ''}
            </SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t('replies.poke_scope_hint')}</p>
      </div>} />
  </>;
};
