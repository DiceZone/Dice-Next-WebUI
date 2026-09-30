import type { ReplyRule, ReplyFormData } from '@/types/reply';
import { type ReplySettingsScope } from '@/lib/reply-scope';
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
export declare const zustandReplyStore: import("zustand").UseBoundStore<import("zustand").StoreApi<ReplyState>>;
export {};
