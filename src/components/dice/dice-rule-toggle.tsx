import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DiceRuleField } from '@/types/dice';

interface DiceRuleToggleProps {
  field: DiceRuleField;
  value: boolean | number | string | undefined;
  onChange: (value: boolean | number | string) => void;
}

export const DiceRuleToggle: React.FC<DiceRuleToggleProps> = ({ field, value, onChange }) => {
  if (field.type === 'boolean') {
    const boolVal = typeof value === 'boolean' ? value : !!field.defaultValue;
    return (
      <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <Label className="cursor-pointer text-sm">{field.label}</Label>
        </div>
        <Switch checked={boolVal} onCheckedChange={(v) => onChange(v)} />
      </div>
    );
  }

  if (field.type === 'number') {
    const numVal = typeof value === 'number' ? value : (field.defaultValue as number) ?? 0;
    return (
      <div className="flex items-center justify-between rounded-md border px-3 py-2.5 gap-4">
        <Label className="cursor-pointer text-sm shrink-0">{field.label}</Label>
        <Input
          type="number"
          min={field.min}
          max={field.max}
          value={numVal}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) {
              const clamped = field.max !== undefined ? Math.min(v, field.max) : v;
              const final = field.min !== undefined ? Math.max(clamped, field.min) : clamped;
              onChange(final);
            }
          }}
          className="w-24 h-8 text-sm"
        />
      </div>
    );
  }

  if (field.type === 'select') {
    const strVal = typeof value === 'string' ? value : String(field.defaultValue ?? '');
    return (
      <div className="flex items-center justify-between rounded-md border px-3 py-2.5 gap-4">
        <Label className="cursor-pointer text-sm shrink-0">{field.label}</Label>
        <Select value={strVal} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="h-8 w-auto min-w-[8rem]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return null;
};

export default DiceRuleToggle;
