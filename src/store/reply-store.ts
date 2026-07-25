import { create } from 'zustand';
import apiClient from '@/lib/api-client';
import type { ReplyRule, ReplyFormData } from '@/types/reply';

interface ReplyState {
  replies: ReplyRule[];
  loading: boolean;
  error: string | null;

  fetchReplies: () => Promise<void>;
  createReply: (data: ReplyFormData) => Promise<ReplyRule>;
  updateReply: (id: string, data: Partial<ReplyFormData>) => Promise<void>;
  deleteReply: (id: string) => Promise<void>;
  toggleReply: (id: string) => Promise<void>;
  clearError: () => void;
}

export const zustandReplyStore = create<ReplyState>()((set, get) => ({
  replies: [],
  loading: false,
  error: null,

  fetchReplies: async () => {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get<ReplyRule[]>('/replies');
      set({ replies: res.data, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取回复规则失败';
      set({ error: message, loading: false });
    }
  },

  createReply: async (data: ReplyFormData) => {
    set({ error: null });
    const res = await apiClient.post<ReplyRule>('/replies', data);
    const reply = res.data;
    set((s) => ({ replies: [...s.replies, reply] }));
    return reply;
  },

  updateReply: async (id: string, data: Partial<ReplyFormData>) => {
    set({ error: null });
    const res = await apiClient.put<ReplyRule>(`/replies/${id}`, data);
    set((s) => ({
      replies: s.replies.map((r) => (r.id === id ? res.data : r)),
    }));
  },

  deleteReply: async (id: string) => {
    set({ error: null });
    await apiClient.delete(`/replies/${id}`);
    set((s) => ({ replies: s.replies.filter((r) => r.id !== id) }));
  },

  toggleReply: async (id: string) => {
    set({ error: null });
    const existing = get().replies.find((r) => r.id === id);
    if (!existing) return;
    const updated = { ...existing, enabled: !existing.enabled };
    const res = await apiClient.put<ReplyRule>(`/replies/${id}`, { enabled: updated.enabled });
    set((s) => ({
      replies: s.replies.map((r) => (r.id === id ? res.data : r)),
    }));
  },

  clearError: () => set({ error: null }),
}));
