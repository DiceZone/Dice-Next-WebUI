import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Accordion } from '@/components/ui/accordion';
import { Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DiceRuleGroupPanel } from '@/components/dice/dice-rule-group';
import { zustandDiceStore } from '@/store/dice-store';
import { useToast } from '@/hooks/use-toast';
import { DICE_RULE_GROUPS } from '@/types/dice';
import type { DiceRules } from '@/types/dice';

export const DiceRulesPage: React.FC = () => {
  const { t } = useTranslation();
  const { rules, loading, saving, fetchRules, updateRules, resetRules } = zustandDiceStore();
  const toast = useToast();
  const [localRules, setLocalRules] = useState<DiceRules | null>(null);
  const [accordionValue, setAccordionValue] = useState<string[]>([]);

  useEffect(() => { void fetchRules(); }, [fetchRules]);
  useEffect(() => { if (rules) setLocalRules({ ...rules }); }, [rules]);

  const handleFieldChange = (key: string, value: boolean | number | string) => {
    setLocalRules((prev) => (prev ? { ...prev, [key]: value } : prev));
  };
  const handleSave = async () => {
    if (!localRules) return;
    try { await updateRules(localRules); toast({ title: t('dice.saved') }); }
    catch { toast({ title: t('common.save_fail'), variant: 'destructive' }); }
  };
  const handleReset = () => { resetRules(); toast({ title: t('dice.reset_done') }); };

  if (loading && !localRules) {
    return (<div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Dices className="h-5 w-5" />{t('dice.title')}</h1><p className="text-sm text-muted-foreground">{t('common.loading')}</p></div><div className="h-64 animate-pulse rounded-lg bg-muted" /></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Dices className="h-5 w-5" />{t('dice.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('dice.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>{t('dice.reset_default')}</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : t('dice.save_rules')}</Button>
        </div>
      </div>
      {localRules && (
        <Accordion type="multiple" value={accordionValue} onValueChange={setAccordionValue}>
          {DICE_RULE_GROUPS.map((group) => (
            <DiceRuleGroupPanel key={group.id} group={group} rules={localRules} onFieldChange={handleFieldChange} />
          ))}
        </Accordion>
      )}
      <Card className="mt-6">
        <CardContent className="p-4 text-sm text-muted-foreground text-center">
          <p>{t('dice.wip')}</p>
        </CardContent>
      </Card>
    </div>
  );
};
export default DiceRulesPage;
