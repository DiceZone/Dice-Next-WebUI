import React from 'react';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { DiceRuleToggle } from '@/components/dice/dice-rule-toggle';
import type { DiceRuleGroup, DiceRules } from '@/types/dice';

interface DiceRuleGroupPanelProps {
  group: DiceRuleGroup;
  rules: DiceRules;
  onFieldChange: (key: string, value: boolean | number | string) => void;
}

export const DiceRuleGroupPanel: React.FC<DiceRuleGroupPanelProps> = ({
  group,
  rules,
  onFieldChange,
}) => {
  return (
    <AccordionItem value={group.id}>
      <AccordionTrigger>
        <div className="flex flex-col items-start text-left gap-0.5">
          <span className="font-medium">{group.label}</span>
          <span className="text-xs text-muted-foreground font-normal">
            {group.description}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pt-1">
          {group.fields.map((field) => {
            const currentValue = (rules as unknown as Record<string, unknown>)[field.key];
            return (
              <DiceRuleToggle
                key={field.key}
                field={field}
                value={(currentValue ?? field.defaultValue) as boolean | number | string | undefined}
                onChange={(val) => onFieldChange(field.key, val)}
              />
            );
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default DiceRuleGroupPanel;
