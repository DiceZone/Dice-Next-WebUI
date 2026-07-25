import React from 'react';
import type { DiceRuleGroup, DiceRules } from '@/types/dice';
interface DiceRuleGroupPanelProps {
    group: DiceRuleGroup;
    rules: DiceRules;
    onFieldChange: (key: string, value: boolean | number | string) => void;
}
export declare const DiceRuleGroupPanel: React.FC<DiceRuleGroupPanelProps>;
export default DiceRuleGroupPanel;
