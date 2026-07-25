/**
 * C#29: Counter Manager — view / reset / edit counters
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { RefreshCw, Trash2, Save, Gauge } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { CounterEntry } from '@/types/causal';

export const CounterManager: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const dlg = useDialogs(t);
  const [counters, setCounters] = useState<CounterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const fetchCounters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<CounterEntry[]>('/counters');
      setCounters(res.data || []);
    } catch {
      toast({ title: t('common.load_fail'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { void fetchCounters(); }, [fetchCounters]);

  const handleSave = async (key: string) => {
    try {
      await apiClient.put(`/counters/${encodeURIComponent(key)}`, { value: Number(editValue) });
      toast({ title: t('common.save_success') });
      setEditingKey(null);
      void fetchCounters();
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleReset = async (key: string) => {
    if (!(await dlg.confirm({ title: t('counter.reset_confirm_title'), description: t('counter.reset_confirm_desc', { key }), destructive: true, confirmText: t('counter.reset') }))) return;
    try {
      await apiClient.delete(`/counters/${encodeURIComponent(key)}`);
      toast({ title: t('counter.reset_done') });
      void fetchCounters();
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          {t('counter.title')}
        </CardTitle>
        <CardDescription>{t('counter.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={fetchCounters} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
          </Button>
        </div>

        {loading ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        ) : counters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Gauge className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">{t('counter.empty')}</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-1">
            {counters.map((c) => (
              <div key={c.key} className="flex items-center gap-2 rounded-md border p-2">
                <div className="flex-1 min-w-0">
                  <code className="text-xs font-mono break-all">{c.key}</code>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{t('counter.rule')} #{c.ruleId}</Badge>
                    <Badge variant="outline" className="text-[10px]">{c.counterName}</Badge>
                    <Badge variant="outline" className="text-[10px]">{c.scope}: {c.scopeId}</Badge>
                  </div>
                </div>
                {editingKey === c.key ? (
                  <>
                    <Input
                      type="number"
                      className="w-20 h-8 text-sm"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSave(c.key)}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-lg font-mono font-bold tabular-nums">{c.value}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.edit')} onClick={() => { setEditingKey(c.key); setEditValue(String(c.value)); }}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title={t('counter.reset')} onClick={() => handleReset(c.key)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {dlg.node}
    </Card>
  );
};

export default CounterManager;
