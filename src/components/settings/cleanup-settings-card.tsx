import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FeatureHelp } from '@/components/ui/feature-help';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTourActive } from '@/components/onboarding/tour-data';
import { useToast } from '@/hooks/use-toast';
import apiClient from '@/lib/api-client';
import { panelQueryClient } from '@/lib/query-client';

export type CleanupSettings = {
  days: number; groupDays: number; userRecordDays: number; groupRecordDays: number;
  groupLimit: number; maxGroupSize: number;
};
const defaults: CleanupSettings = { days: 0, groupDays: 0, userRecordDays: 0, groupRecordDays: 0, groupLimit: 20, maxGroupSize: 0 };
const queryKey = ['panel', 'cleanup-settings'];
export function CleanupSettingsCard() {
  const { t } = useTranslation();
  const touring = useTourActive();
  const toast = useToast();
  const [draft, setDraft] = useState<CleanupSettings>();
  const query = useQuery({ queryKey, enabled: !touring,
    queryFn: async () => ({ ...defaults, ...(await apiClient.get<CleanupSettings>('/system/friend-clean')).data }),
  }, panelQueryClient);
  const save = useMutation({
    mutationFn: async (settings: CleanupSettings) => (await apiClient.put<CleanupSettings>('/system/friend-clean', settings)).data,
    onSuccess: (data) => { panelQueryClient.setQueryData(queryKey, data); setDraft(undefined); toast({ title: t('common.save_success') }); },
    onError: (error) => toast({ title: t('common.save_fail'), description: String(error), variant: 'destructive' }),
  }, panelQueryClient);
  const values = touring ? defaults : draft ?? query.data ?? defaults;
  const field = (key: keyof CleanupSettings, label: string, hint: string, max = 3650) => <div className="min-w-0 space-y-2">
    <Label htmlFor={`cleanup-${key}`}>{t(`friendclean.${label}`)}</Label>
    <Input id={`cleanup-${key}`} type="number" min={0} max={max} step={1} required value={Number.isFinite(values[key]) ? values[key] : ''}
      aria-describedby={`cleanup-${key}-hint`}
      onChange={(event) => setDraft({ ...values, [key]: event.target.valueAsNumber })} />
    <p id={`cleanup-${key}-hint`} className="text-xs leading-relaxed text-muted-foreground">{t(`friendclean.${hint}`)}</p>
  </div>;
  const valid = Object.entries(values).every(([key, value]) => Number.isInteger(value) && value >= 0
    && value <= (key === 'groupLimit' ? 10000 : key === 'maxGroupSize' ? 1000000 : 3650));
  return <Card data-setting-anchor="settings-friend-clean">
    <CardHeader><CardTitle className="flex items-center gap-2 text-base">{t('friendclean.title')}
      <FeatureHelp title={t('friendclean.title')} description={<><p>{t('friendclean.desc')}</p><p>{t('friendclean.hint')}</p><p>{t('friendclean.migration')}</p></>} />
    </CardTitle></CardHeader>
    <CardContent>
      {!touring && query.isPending ? <Skeleton className="h-64" role="status" aria-label={t('common.loading')} />
        : !touring && query.isError && !query.data ? <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          {t('common.load_fail')}<Button variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button></div>
        : <form onSubmit={(event) => { event.preventDefault(); if (draft && valid && !touring) save.mutate(draft); }}>
          <fieldset disabled={touring || save.isPending} className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t('friendclean.records')}</h3>
              <p className="text-sm text-muted-foreground">{t('friendclean.records_hint')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {field('userRecordDays', 'user_record_days', 'user_record_hint')}
                {field('groupRecordDays', 'group_record_days', 'group_record_hint')}
              </div>
            </section>
            <section className="space-y-3 border-t pt-5">
              <h3 className="text-sm font-semibold">{t('friendclean.platform_actions')}</h3>
              <p className="text-sm text-muted-foreground">{t('friendclean.actions_hint')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {field('days', 'days', 'days_hint')}
                {field('groupDays', 'group_days', 'group_days_hint')}
                {field('maxGroupSize', 'max_group_size', 'max_size_hint', 1000000)}
                {field('groupLimit', 'group_limit', 'group_limit_hint', 10000)}
              </div>
            </section>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('friendclean.hint')}</p>
            <div className="flex justify-end"><Button type="submit" disabled={!draft || !valid || save.isPending}>
              {t(save.isPending ? 'common.saving' : 'common.save')}</Button></div>
          </fieldset>
        </form>}
    </CardContent>
  </Card>;
}
