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
    options?: {
        label: string;
        value: string | number;
    }[];
    min?: number;
    max?: number;
}
/** Default dice rules configuration. */
export declare const DEFAULT_DICE_RULES: DiceRules;
/** Predefined rule groups for the dice settings UI. */
export declare const DICE_RULE_GROUPS: DiceRuleGroup[];
