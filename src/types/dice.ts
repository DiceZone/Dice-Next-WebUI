/**
 * Dice rule type definitions.
 *
 * Configuration types for dice-rolling rules across different
 * tabletop RPG systems (COC, D&D, Fate, L5R, custom).
 */

export interface DiceRules {
  coc_enabled: boolean;
  coc_critical_range: number;
  coc_fumble_range: number;
  dnd_enabled: boolean;
  fate_enabled: boolean;
  l5r_enabled: boolean;
  default_dice_sides: number;
  command_prefix: string;
}

export interface DiceRuleGroup {
  id: string;
  label: string;
  description: string;
  fields: DiceRuleField[];
}

export interface DiceRuleField {
  key: string;
  label: string;
  type: 'boolean' | 'number' | 'select';
  defaultValue?: boolean | number | string;
  options?: { label: string; value: string | number }[];
  min?: number;
  max?: number;
}

/** Default dice rules configuration. */
export const DEFAULT_DICE_RULES: DiceRules = {
  coc_enabled: true,
  coc_critical_range: 1,
  coc_fumble_range: 95,
  dnd_enabled: true,
  fate_enabled: false,
  l5r_enabled: false,
  default_dice_sides: 100,
  command_prefix: '.',
};

/** Predefined rule groups for the dice settings UI. */
export const DICE_RULE_GROUPS: DiceRuleGroup[] = [
  {
    id: 'coc',
    label: 'CoC 克苏鲁的呼唤',
    description: '检定规则：掷出 ≤ 技能值即为成功。支持大成功/大失败范围判定。',
    fields: [
      { key: 'coc_enabled', label: '启用 CoC 规则', type: 'boolean', defaultValue: true },
      { key: 'coc_critical_range', label: '大成功范围', type: 'number', defaultValue: 1, min: 1, max: 10 },
      { key: 'coc_fumble_range', label: '大失败范围', type: 'number', defaultValue: 95, min: 90, max: 100 },
    ],
  },
  {
    id: 'dnd',
    label: 'D&D 龙与地下城',
    description: 'd20 检定，支持优势/劣势掷骰。',
    fields: [
      { key: 'dnd_enabled', label: '启用 D&D 规则', type: 'boolean', defaultValue: true },
    ],
  },
  {
    id: 'fate',
    label: 'Fate',
    description: '4dF 命运骰子，结果范围 -4 到 +4。',
    fields: [
      { key: 'fate_enabled', label: '启用 Fate 规则', type: 'boolean', defaultValue: false },
    ],
  },
  {
    id: 'general',
    label: '通用设置',
    description: '默认骰子面数及指令前缀。',
    fields: [
      { key: 'default_dice_sides', label: '默认骰子面数', type: 'number', defaultValue: 100, min: 2, max: 1000 },
      { key: 'command_prefix', label: '指令前缀', type: 'select', defaultValue: '.', options: [{label:'. (英文句号)',value:'.'},{label:'。 (中文句号)',value:'。'},{label:'! (英文感叹号)',value:'!'}] },
      { key: 'l5r_enabled', label: '启用 L5R 规则', type: 'boolean', defaultValue: false },
    ],
  },
];
