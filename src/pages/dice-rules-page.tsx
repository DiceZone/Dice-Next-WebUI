import React, { useEffect } from 'react';
import { useTourState } from '@/components/onboarding/tour-data';
import { DEFAULT_DICE_RULES } from '@/types/dice';
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
import { PageHeader } from '@/components/ui/page-header';

export const DiceRulesPage: React.FC = () => {
  const { t } = useTranslation();
  const { rules, loading, saving, fetchRules, updateRules, resetRules } = zustandDiceStore();
  const toast = useToast();
  const [localRules, setLocalRules] = useTourState<DiceRules | null>(null, DEFAULT_DICE_RULES);
  const [accordionValue, setAccordionValue] = useTourState<string[]>([], ['coc', 'general']);

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
    return (<div className="space-y-6"><PageHeader icon={Dices} title={t('dice.title')} description={t('common.loading')} help={t('page_help.dice_rules')} /><div className="h-64 animate-pulse rounded-lg bg-muted" /></div>);
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Dices} title={t('dice.title')} description={t('dice.subtitle')} help={t('page_help.dice_rules')}
        actions={<div data-tour="dice-actions" className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset}>{t('dice.reset_default')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t('common.saving') : t('dice.save_rules')}</Button>
        </div>} />
      {localRules && (
        <div data-tour="dice-rule-groups">
          <Accordion type="multiple" value={accordionValue} onValueChange={setAccordionValue}>
            {DICE_RULE_GROUPS.map((group) => (
              <DiceRuleGroupPanel key={group.id} group={group} rules={localRules} onFieldChange={handleFieldChange} />
            ))}
          </Accordion>
        </div>
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
