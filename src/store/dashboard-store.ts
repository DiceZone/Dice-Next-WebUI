import { create } from 'zustand';
import apiClient from '@/lib/api-client';
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

export const zustandDashboardStore = create<DashboardState>()((set) => ({
  stats: null,
  recentLogs: [],
  loading: false,
  error: null,

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get<DashboardStats>('/dashboard/stats');
      set({ stats: res.data, loading: false });
    } catch (error) {
      // Preserve the last real snapshot; never replace it with invented zeroes.
      set({ loading: false, error: error instanceof Error ? error.message : '获取运行概览失败' });
    }
  },

  addLog: (entry: RecentLogEntry) => {
    set((state) => {
      const updated = [entry, ...state.recentLogs];
      // Keep only the most recent 500 entries to limit memory usage
      const trimmed = updated.slice(0, 500);
      return { recentLogs: trimmed };
    });
  },

  clearError: () => set({ error: null }),
}));
