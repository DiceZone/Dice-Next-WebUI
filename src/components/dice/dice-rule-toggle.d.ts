import React from 'react';
import type { DiceRuleField } from '@/types/dice';
interface DiceRuleToggleProps {
    field: DiceRuleField;
    value: boolean | number | string | undefined;
    onChange: (value: boolean | number | string) => void;
}
export declare const DiceRuleToggle: React.FC<DiceRuleToggleProps>;
export default DiceRuleToggle;
