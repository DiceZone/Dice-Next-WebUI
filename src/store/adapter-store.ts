import { create } from 'zustand';
import apiClient from '@/lib/api-client';
import type { Adapter, AdapterFormData } from '@/types/adapter';

interface AdapterState {
  adapters: Adapter[];
  loading: boolean;
  error: string | null;

  fetchAdapters: () => Promise<void>;
  createAdapter: (data: AdapterFormData) => Promise<Adapter>;
  updateAdapter: (id: string, data: Partial<AdapterFormData>) => Promise<void>;
  deleteAdapter: (id: string) => Promise<void>;
  toggleAdapter: (id: string) => Promise<void>;
  reconnectAdapter: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<{ success: boolean; message: string }>;
  clearError: () => void;
}

export const zustandAdapterStore = create<AdapterState>()((set, get) => ({
  adapters: [],
  loading: false,
  error: null,

  fetchAdapters: async () => {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get<Adapter[]>('/adapters');
      set({ adapters: res.data, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取适配器列表失败';
      set({ error: message, loading: false });
    }
  },

  createAdapter: async (data: AdapterFormData) => {
    set({ error: null });
    const res = await apiClient.post<Adapter>('/adapters', data);
    const adapter = res.data;
    set((s) => ({ adapters: [...s.adapters, adapter] }));
    return adapter;
  },

  updateAdapter: async (id: string, data: Partial<AdapterFormData>) => {
    set({ error: null });
    const res = await apiClient.put<Adapter>(`/adapters/${id}`, data);
    set((s) => ({
      adapters: s.adapters.map((a) => (a.id === id ? res.data : a)),
    }));
  },

  deleteAdapter: async (id: string) => {
    set({ error: null });
    await apiClient.delete(`/adapters/${id}`);
    set((s) => ({ adapters: s.adapters.filter((a) => a.id !== id) }));
  },

  toggleAdapter: async (id: string) => {
    set({ error: null });
    const existing = get().adapters.find((a) => a.id === id);
    if (!existing) return;
    const res = await apiClient.patch<Adapter>(`/adapters/${id}`, {
      enabled: !existing.enabled,
    });
    set((s) => ({
      adapters: s.adapters.map((a) => (a.id === id ? res.data : a)),
    }));
  },

  reconnectAdapter: async (id: string) => {
    // C#38: manually resume a timed-out adapter (resets backoff). Status refreshes on next poll.
    set({ error: null });
    await apiClient.post(`/adapters/${id}/reconnect`);
    set((s) => ({
      adapters: s.adapters.map((a) => (a.id === id ? { ...a, status: 'connecting' as const } : a)),
    }));
  },

  testConnection: async (id: string) => {
    set({ error: null });
    const res = await apiClient.post<{ success: boolean; message: string }>(
      `/adapters/${id}/test`
    );
    // Update the adapter status after test
    if (res.data.success) {
      set((s) => ({
        adapters: s.adapters.map((a) =>
          a.id === id ? { ...a, status: 'connected' as const, lastActive: new Date().toISOString() } : a
        ),
      }));
    }
    return res.data;
  },

  clearError: () => set({ error: null }),
}));
