import type { DashboardStats, RecentLogEntry } from '@/types/dashboard';
interface DashboardState {
    stats: DashboardStats | null;
    recentLogs: RecentLogEntry[];
    loading: boolean;
    error: string | null;
    fetchStats: () => Promise<void>;
    addLog: (entry: RecentLogEntry) => void;
    clearError: () => void;
}
export declare const zustandDashboardStore: import("zustand").UseBoundStore<import("zustand").StoreApi<DashboardState>>;
export {};
