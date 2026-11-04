import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTourActive } from '@/components/onboarding/tour-data';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FeatureHelp } from '@/components/ui/feature-help';
import apiClient from '@/lib/api-client';
import { panelQueryClient } from '@/lib/query-client';
import { useToast } from '@/hooks/use-toast';

type Source = 'system' | 'openssl' | 'hardware';
type Provider = Source | 'pseudo';
export interface RandomSourceState {
  source: Source;
  /** Provider that produced the latest roll; older backends omit it. */
  active?: Provider;
  fallbacks?: number;
  hardware_available?: boolean;
}
const key = ['panel', 'random-source'];
const SOURCES: Source[] = ['system', 'openssl', 'hardware'];

/** True when the latest roll did not come from the selected source. */
export const randomSourceFellBack = (state?: RandomSourceState) =>
  !!state?.active && state.active !== state.source;

export function RandomSourceCard() {
  const { t } = useTranslation();
  const touring = useTourActive();
  const toast = useToast();
  const [draft, setDraft] = useState<Source>();
  const query = useQuery({ queryKey: key, enabled: !touring,
    queryFn: async () => (await apiClient.get<RandomSourceState>('/system/random-source')).data,
  }, panelQueryClient);
  const save = useMutation({
    mutationFn: async (source: Source) => (await apiClient.put<RandomSourceState>('/system/random-source', { source })).data,
    onSuccess: (data) => { panelQueryClient.setQueryData(key, data); setDraft(undefined); toast({ title: t('common.save_success') }); },
    onError: (error) => toast({ title: t('common.save_fail'), description: error instanceof Error ? error.message : undefined, variant: 'destructive' }),
  }, panelQueryClient);
  const data = query.data;
  const hardwareAvailable = data?.hardware_available === true;
  const fellBack = !touring && randomSourceFellBack(data);
  return <Card data-setting-anchor="dice-random-source">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base">{t('dice.random_title')}
        <FeatureHelp title={t('dice.random_title')} description={<><p>{t('dice.random_help')}</p><p>{t('dice.random_fallback_help')}</p></>} />
      </CardTitle>
      <CardDescription>{t('dice.random_hint')}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {!touring && query.isPending ? <Skeleton className="h-10" role="status" aria-label={t('common.loading')} />
        : !touring && query.isError && !data ? <div role="alert" className="flex items-center gap-3 text-sm text-destructive">{t('common.load_fail')}
          <Button variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button></div>
        : <div className="flex flex-wrap items-center gap-3">
          <Select value={touring ? 'system' : draft ?? data?.source ?? 'system'} disabled={touring || save.isPending}
            onValueChange={(value) => setDraft(value as Source)}>
            <SelectTrigger aria-label={t('dice.random_title')} className="w-full sm:w-96"><SelectValue /></SelectTrigger>
            <SelectContent>{SOURCES.map((source) => <SelectItem key={source} value={source}
              disabled={source === 'hardware' && !hardwareAvailable && data?.source !== 'hardware'}>
              {t(`dice.random_${source}`)}{source === 'hardware' && !hardwareAvailable ? ` · ${t('dice.random_hardware_unavailable')}` : ''}
            </SelectItem>)}</SelectContent>
          </Select>
          <Button disabled={touring || save.isPending || !draft || draft === data?.source} onClick={() => draft && save.mutate(draft)}>
            {t(save.isPending ? 'common.saving' : 'common.save')}
          </Button>
        </div>}
      {fellBack && data?.active && <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
        {t('dice.random_fallback_active', { provider: t(`dice.random_provider_${data.active}`) })}
      </p>}
      <p className="text-xs text-muted-foreground">{t(`dice.random_${draft ?? data?.source ?? 'system'}_desc`)}</p>
    </CardContent>
  </Card>;
}
