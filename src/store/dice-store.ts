import { create } from 'zustand';
import apiClient from '@/lib/api-client';
import type { DiceRules } from '@/types/dice';
import { DEFAULT_DICE_RULES } from '@/types/dice';

interface DiceState {
  rules: DiceRules | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  lastRollResult: string | null;

  fetchRules: () => Promise<void>;
  updateRules: (rules: DiceRules) => Promise<void>;
  resetRules: () => void;
  testRoll: (expression: string) => Promise<string>;
  clearError: () => void;
}

export const zustandDiceStore = create<DiceState>()((set) => ({
  rules: null,
  loading: false,
  saving: false,
  error: null,
  lastRollResult: null,

  fetchRules: async () => {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get<DiceRules>('/dice/rules');
      set({ rules: res.data, loading: false });
    } catch {
      // Fall back to defaults if API not available
      set({ rules: { ...DEFAULT_DICE_RULES }, loading: false });
    }
  },

  updateRules: async (rules: DiceRules) => {
    set({ saving: true, error: null });
    try {
      const res = await apiClient.put<DiceRules>('/dice/rules', rules);
      set({ rules: res.data, saving: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存规则失败';
      set({ error: message, saving: false });
      throw err;
    }
  },

  resetRules: () => {
    set({ rules: { ...DEFAULT_DICE_RULES }, error: null });
  },

  testRoll: async (expression: string) => {
    set({ error: null });
    try {
      const res = await apiClient.post<{ result: string }>('/dice/roll', { expression });
      const result = res.data.result;
      set({ lastRollResult: result });
      return result;
    } catch {
      // Client-side simulation when backend unavailable
      const simulated = `🎲 ${expression} → 模拟结果: ${Math.floor(Math.random() * 100) + 1}`;
      set({ lastRollResult: simulated });
      return simulated;
    }
  },

  clearError: () => set({ error: null }),
}));
