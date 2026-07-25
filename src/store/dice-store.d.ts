import type { DiceRules } from '@/types/dice';
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
export declare const zustandDiceStore: import("zustand").UseBoundStore<import("zustand").StoreApi<DiceState>>;
export {};
