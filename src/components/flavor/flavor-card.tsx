import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Sparkles } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface FlavorInfo {
  flavor: string;
  available: string[];
}

/** C#28: 文案风味切换卡片 — 切换原版风味文案层，并预览对比 */
export const FlavorCard: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [flavor, setFlavor] = useState('default');
  const [available, setAvailable] = useState<string[]>(['default']);
  const [saving, setSaving] = useState(false);

  const fetchFlavor = useCallback(async () => {
    try {
      const res = await apiClient.get<FlavorInfo>('/system/flavor');
      setFlavor(res.data.flavor || 'default');
      setAvailable(res.data.available || ['default']);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchFlavor();
  }, [fetchFlavor]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/system/flavor', { flavor });
      toast({ title: t('common.save_success') });
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const flavorLabel = (f: string): string => {
    if (f === 'default') return t('flavor.label_default');
    if (f === 'original') return t('flavor.label_original');
    return f;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          {t('flavor.title')}
        </CardTitle>
        <CardDescription>
          {t('flavor.desc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Select value={flavor} onValueChange={setFlavor}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {available.map((f) => (
                <SelectItem key={f} value={f}>
                  {flavorLabel(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {t('common.save')}
          </Button>
        </div>
        {flavor === 'original' && (
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
            <p>
              <span className="font-medium">{t('flavor.on_title')}</span>{t('flavor.on_desc')}
            </p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>{t('flavor.item_welcome')}</li>
              <li>{t('flavor.item_bot')}</li>
              <li>{t('flavor.item_crit')}</li>
              <li>{t('flavor.item_deck')}</li>
              <li>{t('flavor.item_mapped')}</li>
              <li>{t('flavor.item_extra')}</li>
            </ul>
            <p className="pt-1">
              {t('flavor.var_note')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FlavorCard;
