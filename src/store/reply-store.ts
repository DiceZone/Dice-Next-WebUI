import { create } from 'zustand';
import i18n from 'i18next';
import apiClient from '@/lib/api-client';
import type { ReplyRule, ReplyFormData } from '@/types/reply';
import { globalReplyScope, replyScopeKey, replyScopeQuery, type ReplySettingsScope } from '@/lib/reply-scope';

interface ReplyState {
  replies: ReplyRule[];
  loading: boolean;
  error: string | null;
  scope: ReplySettingsScope;

  fetchReplies: (scope?: ReplySettingsScope) => Promise<void>;
  createReply: (data: ReplyFormData) => Promise<ReplyRule>;
  updateReply: (id: string, data: Partial<ReplyFormData>) => Promise<ReplyRule>;
  deleteReply: (id: string) => Promise<void>;
  toggleReply: (id: string) => Promise<void>;
  clearError: () => void;
}

export const zustandReplyStore = create<ReplyState>()((set, get) => {
  let request = 0;
  let scopeVerified = false;
  const currentScope = (scope: ReplySettingsScope) => replyScopeKey(get().scope) === replyScopeKey(scope);
  return {
    replies: [],
    scope: globalReplyScope,
    loading: false,
    error: null,

    fetchReplies: async (scope = get().scope) => {
      const ticket = ++request;
      scopeVerified = false;
      const changed = !currentScope(scope);
      set({ scope, loading: true, error: null, ...(changed ? { replies: [] } : {}) });
      try {
        const res = await apiClient.get<ReplyRule[]>('/replies?' + replyScopeQuery(scope));
        const acknowledged = (res as typeof res & { replyScope?: Pick<ReplySettingsScope, 'scope' | 'target'> }).replyScope;
        // Old servers ignore query/body scope fields. Refuse scoped editing even
        // when an empty legacy list looks valid, rather than save a global rule.
        if (scope.scope !== 'global' && (acknowledged?.scope !== scope.scope || acknowledged?.target !== scope.target))
          throw new Error(i18n.t('replies.scope_backend_required'));
        if (ticket === request) {
          scopeVerified = true;
          set({ replies: res.data, loading: false });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '获取回复规则失败';
        if (ticket === request) set({ error: message, loading: false });
      }
    },

    createReply: async (data: ReplyFormData) => {
      const scope = get().scope;
      if (!scopeVerified) throw new Error(i18n.t('replies.scope_load_first'));
      set({ error: null });
      const res = await apiClient.post<ReplyRule>('/replies', { ...data, channelScope: scope.scope, channelTarget: scope.target });
      const reply = res.data;
      if (!currentScope(scope)) return reply;
      if (reply.deduplicated) {
        await get().fetchReplies(scope);
      } else {
        set((s) => ({ replies: [...s.replies.filter((item) => item.id !== reply.id), reply] }));
      }
      return reply;
    },

    updateReply: async (id: string, data: Partial<ReplyFormData>) => {
      const scope = get().scope;
      set({ error: null });
      const res = await apiClient.put<ReplyRule>(`/replies/${id}`, data);
      if (!currentScope(scope)) return res.data;
      if (res.data.deduplicated) {
        await get().fetchReplies(scope);
      } else {
        set((s) => ({ replies: s.replies.map((r) => (r.id === id ? res.data : r)) }));
      }
      return res.data;
    },

    deleteReply: async (id: string) => {
      const scope = get().scope;
      set({ error: null });
      await apiClient.delete(`/replies/${id}`);
      if (currentScope(scope)) set((s) => ({ replies: s.replies.filter((r) => r.id !== id) }));
    },

    toggleReply: async (id: string) => {
      set({ error: null });
      const existing = get().replies.find((r) => r.id === id);
      if (!existing) return;
      await get().updateReply(id, { enabled: !existing.enabled });
    },

    clearError: () => set({ error: null }),
  };
});
