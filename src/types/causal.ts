/**
 * C#29: Causal rule engine — TypeScript types
 */

export type CausalCondType =
  | 'keyword'
  | 'prefix'
  | 'regex'
  | 'search'
  | 'user_filter'
  | 'group_filter'
  | 'cooldown'
  | 'counter_check';

export type CausalActionType =
  | 'reply'
  | 'counter_set'
  | 'counter_add'
  | 'counter_reset'
  | 'api_call';

export type CausalScope = 'global' | 'group' | 'user';
export type CausalLogic = 'and' | 'or';
export type CooldownKeyType = 'per-user' | 'per-group' | 'global';

export interface CausalCondition {
  type: CausalCondType;
  content: string;
  op?: string;
  value?: number;
  counterName?: string;
}

export interface CausalAction {
  type: CausalActionType;
  replies?: string[];
  counterName?: string;
  counterScope?: string;
  counterDelta?: number;
  apiUrl?: string;
  apiVar?: string;
}

export interface CausalRule {
  id: number;
  name: string;
  scope: CausalScope;
  scopeIds: string[];
  enabled: boolean;
  priority: number;
  cooldownMs: number;
  cooldownKey: CooldownKeyType;
  conditions: CausalCondition[];
  logic: CausalLogic;
  actions: CausalAction[];
  createdAt: string;
  updatedAt: string;
}

export interface CausalMatchResult {
  matched: boolean;
  reply: string;
  ruleId: number;
  ruleName: string;
  counterChanges: CounterChange[];
}

export interface CounterChange {
  name: string;
  oldValue: number;
  newValue: number;
}

export interface CounterEntry {
  key: string;
  value: number;
  updatedAt: string;
  ruleId: number;
  counterName: string;
  scope: string;
  scopeId: string;
}

/** Default empty rule for the editor */
export const emptyCausalRule: CausalRule = {
  id: 0,
  name: '',
  scope: 'global',
  scopeIds: [],
  enabled: true,
  priority: 100,
  cooldownMs: 0,
  cooldownKey: 'per-user',
  conditions: [],
  logic: 'or',
  actions: [],
  createdAt: '',
  updatedAt: '',
};
