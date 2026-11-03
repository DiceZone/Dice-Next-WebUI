import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTourActive } from '@/components/onboarding/tour-data';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FeatureHelp } from '@/components/ui/feature-help';
import apiClient from '@/lib/api-client';
import { panelQueryClient } from '@/lib/query-client';
import { useToast } from '@/hooks/use-toast';

type Source = 'system' | 'openssl';
const key = ['panel', 'random-source'];
export function RandomSourceCard() {
  const { t } = useTranslation();
  const touring = useTourActive();
  const toast = useToast();
  const [draft, setDraft] = useState<Source>();
  const query = useQuery({ queryKey: key, enabled: !touring,
    queryFn: async () => (await apiClient.get<{ source: Source }>('/system/random-source')).data,
  }, panelQueryClient);
  const save = useMutation({
    mutationFn: async (source: Source) => (await apiClient.put<{ source: Source }>('/system/random-source', { source })).data,
    onSuccess: (data) => { panelQueryClient.setQueryData(key, data); setDraft(undefined); toast({ title: t('common.save_success') }); },
    onError: () => toast({ title: t('common.save_fail'), variant: 'destructive' }),
  }, panelQueryClient);
  return <Card data-setting-anchor="dice-random-source">
    <CardHeader><CardTitle className="flex items-center gap-2 text-base">{t('dice.random_title')}
      <FeatureHelp title={t('dice.random_title')} description={<p>{t('dice.random_help')}</p>} />
    </CardTitle></CardHeader>
    <CardContent className="space-y-3">
      {!touring && query.isPending ? <Skeleton className="h-10" role="status" aria-label={t('common.loading')} />
        : !touring && query.isError && !query.data ? <div role="alert" className="flex items-center gap-3 text-sm text-destructive">{t('common.load_fail')}
          <Button variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button></div>
        : <div className="flex flex-wrap items-center gap-3">
          <Select value={touring ? 'system' : draft ?? query.data?.source ?? 'system'} disabled={touring || save.isPending}
            onValueChange={(value) => setDraft(value as Source)}>
            <SelectTrigger aria-label={t('dice.random_title')} className="w-full sm:w-80"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="system">{t('dice.random_system')}</SelectItem><SelectItem value="openssl">{t('dice.random_openssl')}</SelectItem></SelectContent>
          </Select>
          <Button disabled={touring || save.isPending || !draft || draft === query.data?.source} onClick={() => draft && save.mutate(draft)}>
            {t(save.isPending ? 'common.saving' : 'common.save')}
          </Button>
        </div>}
      <p className="text-sm text-muted-foreground">{t('dice.random_hint')}</p>
    </CardContent>
  </Card>;
}
